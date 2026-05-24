import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { getProjectBySlugs } from "../projects/registry";
import { validateMemberKey, getMemberByAccountAndProject } from "../members/registry";
import { auth } from "../auth";
import { getAccountByAuthUserId } from "../accounts/registry";

/**
 * Resolves the project from `:account/:project` URL params and stores it on
 * `c`. If a Bearer token or session is present, also sets memberAccountId +
 * authorType. Does NOT 401 on anonymous — `/o/:id` reads may be public
 * (shared-post fallback).
 */
export const objectContext = createMiddleware<Env>(async (c, next) => {
  const accountSlug = c.req.param("account");
  const projectSlug = c.req.param("project");
  if (!accountSlug || !projectSlug) return c.text("Bad path", 400);

  const project = await getProjectBySlugs(accountSlug, projectSlug);
  if (!project) return c.text("Not found", 404);

  c.set("projectId", project.id);
  c.set("projectSlug", projectSlug);
  c.set("accountSlug", accountSlug);

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const r = await validateMemberKey(accountSlug, projectSlug, authHeader.slice(7));
    if (r.valid) {
      c.set("memberAccountId", r.memberAccountId);
      c.set("authorType", "agent");
      return next();
    }
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user) {
    const account = await getAccountByAuthUserId(session.user.id);
    if (account) {
      const membership = await getMemberByAccountAndProject(project.id, account.id);
      if (membership) {
        c.set("memberAccountId", account.id);
        c.set("authorType", "human");
      }
    }
  }

  return next();
});
