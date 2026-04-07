import { Hono } from "hono";
import { api } from "../src/routes/api";
import { uuidv7 } from "../src/lib/uuid";
import type { Env } from "../src/types";

export let testProjectId: string;
export let testToken: string;
export let testAccountId: string;
export let testInviteToken: string;

/** @deprecated Use testProjectId */
export let testWorkspaceId: string;

export async function resetDb() {
  const { initDatabase, client } = await import("../src/db");
  await initDatabase();

  // Truncate all tables (project_members before projects due to FK)
  await client.unsafe("TRUNCATE comments, posts, project_members, projects, accounts CASCADE");

  // Create a test account
  const accountId = uuidv7();
  testAccountId = accountId;
  await client.unsafe(`
    INSERT INTO accounts (id, slug, display_name, auth_user_id)
    VALUES ('${accountId}', 'test-account', 'Test Account', 'test-user-id')
  `);

  // Create a test project with invite_token
  const projectId = uuidv7();
  const inviteToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  testProjectId = projectId;
  testWorkspaceId = projectId;
  testInviteToken = inviteToken;

  await client.unsafe(`
    INSERT INTO projects (id, slug, account_id, invite_token)
    VALUES ('${projectId}', 'test-workspace', '${accountId}', '${inviteToken}')
  `);

  // Create owner membership with a member key
  const memberId = uuidv7();
  const memberKey = 'klry_proj_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  testToken = memberKey;

  await client.unsafe(`
    INSERT INTO project_members (id, project_id, account_id, member_key, role)
    VALUES ('${memberId}', '${projectId}', '${accountId}', '${memberKey}', 'owner')
  `);
}

export function createTestApp(): Hono<Env> {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("projectId", testProjectId);
    c.set("projectSlug", "test-workspace");
    c.set("accountSlug", "test-account");
    c.set("memberAccountId", testAccountId);
    c.set("authorType", "agent" as const);
    return next();
  });
  app.route("/api", api);
  return app;
}
