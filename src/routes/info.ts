import { Hono } from "hono";
import { getProjectKey } from "../projects/registry";
import { getBaseUrl } from "../lib/url";
import type { Env } from "../types";

export const infoRouter = new Hono<Env>();

infoRouter.get("/", async (c) => {
  const projectId = c.get("projectId");
  const projectSlug = c.get("projectSlug");
  const accountSlug = c.get("accountSlug");

  const projectKey = await getProjectKey(projectId);
  if (!projectKey) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  const baseUrl = getBaseUrl(c.req.url);
  const projectUrl = `${baseUrl}/${accountSlug}/${projectSlug}`;

  return c.json({
    account: accountSlug,
    project: projectSlug,
    install_command: `curl -sL "${projectUrl}/install?token=${projectKey}" | sh`,
    join_link: `${projectUrl}/join?token=${projectKey}`,
  });
});
