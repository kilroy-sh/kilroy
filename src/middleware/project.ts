import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { getProjectBySlugs } from "../projects/registry";
import { validateMemberKey, getMemberByAccountAndProject } from "../members/registry";
import { auth } from "../auth";
import { getAccountByAuthUserId } from "../accounts/registry";

export const projectAuth = createMiddleware<Env>(async (c, next) => {
  const accountSlug = c.req.param("account");
  const projectSlug = c.req.param("project");

  if (!accountSlug || !projectSlug) {
    return c.json(
      { error: "Missing account or project identifier", code: "BAD_REQUEST" },
      400
    );
  }

  // Try Bearer token from Authorization header (agents, MCP)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await validateMemberKey(accountSlug, projectSlug, token);
    if (result.valid) {
      c.set("projectId", result.projectId);
      c.set("projectSlug", projectSlug);
      c.set("accountSlug", accountSlug);
      c.set("memberAccountId", result.memberAccountId);
      c.set("authorType", "agent");
      return next();
    }
  }

  // Try Better Auth session (web UI)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session?.user) {
    const account = await getAccountByAuthUserId(session.user.id);
    if (account) {
      const project = await getProjectBySlugs(accountSlug, projectSlug);
      if (project) {
        const membership = await getMemberByAccountAndProject(project.id, account.id);
        if (membership) {
          c.set("projectId", project.id);
          c.set("projectSlug", projectSlug);
          c.set("accountSlug", accountSlug);
          c.set("memberAccountId", account.id);
          c.set("authorType", "human");
          return next();
        }
      }
    }
  }

  return c.json(
    { error: "Invalid or missing project key", code: "UNAUTHORIZED" },
    401
  );
});
