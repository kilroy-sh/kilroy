import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { resetDb, testProjectId, testAccountId } from "./helpers";
import { objectsRouter } from "../src/routes/objects";
import { client } from "../src/db";
import { uuidv7 } from "../src/lib/uuid";
import type { Env } from "../src/types";

// Mirrors what `objectContext` middleware sets on the real server (Step 3a).
function appWithObjects() {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("projectId", testProjectId);
    c.set("projectSlug", "test-workspace");
    c.set("accountSlug", "test-account");
    c.set("memberAccountId", testAccountId);
    c.set("authorType", "agent" as const);
    await next();
  });
  app.route("/o", objectsRouter);
  return app;
}

async function provisionSlot(opts: { expired?: boolean } = {}) {
  const id = uuidv7();
  const expiresAt = opts.expired
    ? "now() - interval '1 minute'"
    : "now() + interval '10 minutes'";
  await client.unsafe(`
    INSERT INTO object_upload_slots (id, project_id, created_by_account_id, expires_at)
    VALUES ('${id}', '${testProjectId}', '${testAccountId}', ${expiresAt})
  `);
  return id;
}

describe("POST /o/upload/:slotId", () => {
  beforeEach(resetDb);

  it("consumes a slot, persists the object, returns id+url; object id == slot id", async () => {
    const slot = await provisionSlot();
    const app = appWithObjects();

    const res = await app.request(`/o/upload/${slot}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello world",
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBe(slot); // identity invariant
    expect(body.url).toMatch(new RegExp(`/o/${slot}$`));
    expect(body.size_bytes).toBe(11);
    expect(body.sha256).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );

    const [slotRow] = await client.unsafe(
      `SELECT consumed_at FROM object_upload_slots WHERE id = '${slot}'`
    );
    expect(slotRow!.consumed_at).not.toBeNull();

    const [objectRow] = await client.unsafe(
      `SELECT id, project_id, sha256 FROM objects WHERE id = '${slot}'`
    );
    expect(objectRow).toBeDefined();
    expect(objectRow!.sha256).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
  });

  it("rejects a second upload to the same slot", async () => {
    const slot = await provisionSlot();
    const app = appWithObjects();
    const first = await app.request(`/o/upload/${slot}`, {
      method: "POST", body: "first", headers: { "Content-Type": "text/plain" },
    });
    expect(first.status).toBe(201);
    const second = await app.request(`/o/upload/${slot}`, {
      method: "POST", body: "second", headers: { "Content-Type": "text/plain" },
    });
    expect(second.status).toBe(410); // Gone: slot already consumed
  });

  it("rejects an expired slot", async () => {
    const slot = await provisionSlot({ expired: true });
    const app = appWithObjects();
    const res = await app.request(`/o/upload/${slot}`, {
      method: "POST", body: "x", headers: { "Content-Type": "text/plain" },
    });
    expect(res.status).toBe(410);
  });

  it("rejects an unknown slot", async () => {
    const app = appWithObjects();
    const res = await app.request(`/o/upload/${uuidv7()}`, {
      method: "POST", body: "x", headers: { "Content-Type": "text/plain" },
    });
    expect(res.status).toBe(404);
  });

  it("rejects bodies larger than 10 MB", async () => {
    const slot = await provisionSlot();
    const app = appWithObjects();
    const tooBig = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await app.request(`/o/upload/${slot}`, {
      method: "POST", body: tooBig, headers: { "Content-Type": "application/octet-stream" },
    });
    expect(res.status).toBe(413);
  });
});
