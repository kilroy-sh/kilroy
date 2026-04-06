import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import { getAccountByAuthUserId } from "../accounts/registry";

type AuthEnv = {
  Variables: {
    user: { id: string; email: string; name: string } | null;
    account: { id: string; slug: string; displayName: string } | null;
  };
};

export const resolveSession = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    c.set("user", null);
    c.set("account", null);
    return next();
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  const account = await getAccountByAuthUserId(session.user.id);
  c.set("account", account ? {
    id: account.id,
    slug: account.slug,
    displayName: account.displayName,
  } : null);

  return next();
});

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required", code: "UNAUTHORIZED" }, 401);
  }

  const account = c.get("account");
  if (!account) {
    return c.json({ error: "Account setup required", code: "ONBOARDING_REQUIRED" }, 403);
  }

  return next();
});
