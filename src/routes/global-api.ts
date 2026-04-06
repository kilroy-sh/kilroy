import { Hono } from "hono";
import { createProject, validateProjectSlug, listProjectsByAccount } from "../projects/registry";
import { createAccount, validateAccountSlug, suggestSlug } from "../accounts/registry";
import { getBaseUrl } from "../lib/url";

type AuthEnv = {
  Variables: {
    user: { id: string; email: string; name: string } | null;
    account: { id: string; slug: string; displayName: string } | null;
  };
};

export const globalApi = new Hono<AuthEnv>();

// GET /api/account
globalApi.get("/account", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated", code: "UNAUTHORIZED" }, 401);

  const account = c.get("account");
  if (!account) {
    return c.json({ has_account: false, user: { email: user.email, name: user.name } });
  }

  return c.json({
    has_account: true,
    account: { id: account.id, slug: account.slug, display_name: account.displayName },
  });
});

// POST /api/account
globalApi.post("/account", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated", code: "UNAUTHORIZED" }, 401);

  const existing = c.get("account");
  if (existing) return c.json({ error: "Account already exists", code: "CONFLICT" }, 409);

  const body = await c.req.json();
  if (!body.slug) return c.json({ error: "Missing slug", code: "INVALID_INPUT" }, 400);

  const validation = validateAccountSlug(body.slug);
  if (!validation.valid) return c.json({ error: validation.error, code: "INVALID_INPUT" }, 400);

  try {
    const account = await createAccount({
      slug: body.slug,
      displayName: body.display_name || user.name || body.slug,
      authUserId: user.id,
    });
    return c.json(account, 201);
  } catch (err: any) {
    if (err.message?.includes("already taken")) {
      return c.json({ error: err.message, code: "SLUG_TAKEN" }, 409);
    }
    throw err;
  }
});

// GET /api/account/slug-suggestion
globalApi.get("/account/slug-suggestion", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated", code: "UNAUTHORIZED" }, 401);

  const slug = suggestSlug("email", { email: user.email, name: user.name });
  return c.json({ suggestion: slug });
});

// GET /api/projects
globalApi.get("/projects", async (c) => {
  const account = c.get("account");
  if (!account) return c.json({ error: "Account required", code: "UNAUTHORIZED" }, 401);

  const projectList = await listProjectsByAccount(account.id);
  return c.json({
    projects: projectList.map((p) => ({
      id: p.id,
      slug: p.slug,
      created_at: p.createdAt.toISOString(),
    })),
  });
});

// POST /api/projects
globalApi.post("/projects", async (c) => {
  const account = c.get("account");
  if (!account) return c.json({ error: "Account required", code: "UNAUTHORIZED" }, 401);

  const body = await c.req.json();
  if (!body.slug) return c.json({ error: "Missing slug", code: "INVALID_INPUT" }, 400);

  const validation = validateProjectSlug(body.slug);
  if (!validation.valid) return c.json({ error: validation.error, code: "INVALID_INPUT" }, 400);

  try {
    const project = await createProject(account.id, body.slug);
    const baseUrl = getBaseUrl(c.req.url);

    return c.json({
      id: project.id,
      slug: project.slug,
      account_slug: account.slug,
      project_key: project.projectKey,
      project_url: `${baseUrl}/${account.slug}/${project.slug}`,
      install_url: `${baseUrl}/${account.slug}/${project.slug}/install?token=${project.projectKey}`,
    }, 201);
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      return c.json({ error: err.message, code: "SLUG_TAKEN" }, 409);
    }
    throw err;
  }
});
