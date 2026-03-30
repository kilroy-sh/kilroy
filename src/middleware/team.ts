import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { validateKey, getTeamBySlug } from "../teams/registry";

export const teamAuth = createMiddleware<Env>(async (c, next) => {
  const slug = c.req.param("team");
  if (!slug) {
    return c.json(
      { error: "Missing team identifier", code: "BAD_REQUEST" },
      400
    );
  }

  // Try Bearer token from Authorization header (agents, CLI, MCP)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = validateKey(slug, token);
    if (result.valid) {
      c.set("teamId", result.teamId);
      c.set("teamSlug", slug);
      return next();
    }
  }

  // Try session cookie (web UI)
  const cookie = getCookie(c.req.raw, "klry_session");
  if (cookie) {
    const result = validateKey(slug, cookie);
    if (result.valid) {
      c.set("teamId", result.teamId);
      c.set("teamSlug", slug);
      return next();
    }
  }

  return c.json(
    { error: "Invalid or missing project key", code: "UNAUTHORIZED" },
    401
  );
});

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("Cookie");
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
