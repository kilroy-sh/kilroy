import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { validateProjectKey, getProjectBySlugs } from "../projects/registry";
import { auth } from "../auth";

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
    const result = await validateProjectKey(accountSlug, projectSlug, token);
    if (result.valid) {
      c.set("projectId", result.projectId);
      c.set("projectSlug", projectSlug);
      c.set("accountSlug", accountSlug);
      return next();
    }
  }

  // Try Better Auth session (web UI)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session?.user) {
    const project = await getProjectBySlugs(accountSlug, projectSlug);
    if (project) {
      c.set("projectId", project.id);
      c.set("projectSlug", projectSlug);
      c.set("accountSlug", accountSlug);
      return next();
    }
  }

  return c.json(
    { error: "Invalid or missing project key", code: "UNAUTHORIZED" },
    401
  );
});
