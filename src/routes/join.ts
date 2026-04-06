import { Hono } from "hono";
import { validateProjectKey } from "../projects/registry";
import { getBaseUrl } from "../lib/url";

export const joinHandler = new Hono();

joinHandler.get("/", async (c) => {
  const url = new URL(c.req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const accountSlug = segments[0];
  const projectSlug = segments[1];
  const token = c.req.query("token");

  if (!token) {
    return c.json(
      { error: "Missing required parameter: token", code: "INVALID_INPUT" },
      400
    );
  }

  const result = await validateProjectKey(accountSlug, projectSlug, token);
  if (!result.valid) {
    return c.json(
      { error: "Invalid project key", code: "UNAUTHORIZED" },
      401
    );
  }

  const baseUrl = getBaseUrl(c.req.url);
  const projectUrl = `${baseUrl}/${accountSlug}/${projectSlug}`;

  return c.json({
    account: accountSlug,
    project: projectSlug,
    project_url: projectUrl,
    install_command: `curl -sL "${projectUrl}/install?token=${token}" | sh`,
  });
});
