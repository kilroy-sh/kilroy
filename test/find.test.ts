import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";

import { resetDb, createTestApp, testAccountId } from "./helpers";
import { client } from "../src/db";
import type { Env } from "../src/types";

let app: Hono<Env>;

async function setup() {
  await resetDb();
  app = createTestApp();
}

function request(path: string) {
  return app.request(`http://localhost/api${path}`);
}

async function createPost(overrides: Record<string, any> = {}) {
  const body = {
    title: "Test post",
    topic: "test",
    body: "test body",
    ...overrides,
  };
  const res = await app.request("http://localhost/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── GET /api/find ────────────────────────────────────────────

describe("GET /api/find", () => {
  beforeEach(setup);

  it("requires at least one filter", async () => {
    const res = await request("/find");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_INPUT");
  });

  it("filters by author (account_id)", async () => {
    await createPost({ title: "My post" });

    // Import testAccountId after resetDb populates it
    const { testAccountId: accountId } = await import("./helpers");
    const res = await request(`/find?author=${accountId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("My post");
  });

  it("filters by tag", async () => {
    await createPost({ tags: ["gotcha", "auth"], title: "Tagged" });
    await createPost({ tags: ["other"], title: "Other" });

    const res = await request("/find?tag=gotcha");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("Tagged");
  });

  it("filters by multiple tags (AND)", async () => {
    await createPost({ tags: ["gotcha", "auth"], title: "Both tags" });
    await createPost({ tags: ["gotcha"], title: "One tag" });

    const res = await request("/find?tag=gotcha&tag=auth");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("Both tags");
  });

  it("filters by since (date)", async () => {
    const old = await createPost({ title: "Old post" });
    // Manually backdate using PostgreSQL
    await client.unsafe(`UPDATE posts SET updated_at = '2026-01-01T00:00:00Z', created_at = '2026-01-01T00:00:00Z' WHERE id = $1`, [old.id]);
    await createPost({ title: "New post" });

    const res = await request("/find?since=2026-03-01");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("New post");
  });

  it("filters by before (date)", async () => {
    const old = await createPost({ title: "Old post" });
    await client.unsafe(`UPDATE posts SET updated_at = '2026-01-01T00:00:00Z', created_at = '2026-01-01T00:00:00Z' WHERE id = $1`, [old.id]);
    await createPost({ title: "New post" });

    const res = await request("/find?before=2026-02-01");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("Old post");
  });

  it("filters by status", async () => {
    const active = await createPost({ title: "Active post", topic: "status-test" });
    const toArchive = await createPost({ title: "Archived post", topic: "status-test" });
    // Archive one post
    await app.request(`http://localhost/api/posts/${toArchive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });

    // Default (active only)
    const res = await request("/find?topic=status-test");
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("Active post");

    // All statuses
    const res2 = await request("/find?topic=status-test&status=all");
    const data2 = await res2.json();
    expect(data2.results.length).toBe(2);
  });

  it("filters by topic (prefix match)", async () => {
    await createPost({ topic: "auth/google", title: "Auth post" });
    await createPost({ topic: "deploy", title: "Deploy post" });

    const res = await request("/find?topic=auth");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("Auth post");
  });

  it("combines filters (AND)", async () => {
    await createPost({ topic: "auth", tags: ["gotcha"], title: "Match" });
    await createPost({ topic: "auth", tags: ["other"], title: "Wrong tag" });
    await createPost({ topic: "deploy", tags: ["gotcha"], title: "Wrong topic" });

    const res = await request("/find?topic=auth&tag=gotcha");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].title).toBe("Match");
  });

  it("supports pagination", async () => {
    const { testAccountId: accountId } = await import("./helpers");
    for (let i = 0; i < 5; i++) {
      await createPost({ title: `Post ${i}` });
    }

    const res = await request(`/find?author=${accountId}&limit=2`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(2);
    expect(data.has_more).toBe(true);
    expect(data.next_cursor).toBeDefined();

    const res2 = await request(`/find?author=${accountId}&limit=2&cursor=${data.next_cursor}`);
    const data2 = await res2.json();
    expect(data2.results.length).toBe(2);
  });

  it("returns post metadata in results", async () => {
    const { testAccountId: accountId } = await import("./helpers");
    await createPost({ tags: ["gotcha"], title: "Full result", topic: "auth" });

    const res = await request(`/find?author=${accountId}`);
    const data = await res.json();
    const r = data.results[0];
    expect(r.id).toBeDefined();
    expect(r.title).toBe("Full result");
    expect(r.topic).toBe("auth");
    expect(r.status).toBe("active");
    expect(r.tags).toEqual(["gotcha"]);
    expect(r.author.account_id).toBe(accountId);
    expect(r.updated_at).toBeDefined();
    expect(r.created_at).toBeDefined();
  });
});
