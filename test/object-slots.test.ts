import { describe, it, expect, beforeEach } from "bun:test";
import { resetDb, testProjectId, createTestApp } from "./helpers";
import { client } from "../src/db";

describe("POST /api/o/slots", () => {
  beforeEach(resetDb);

  it("creates one slot by default with a ready-to-run curl command", async () => {
    const app = createTestApp();
    const res = await app.request("/api/o/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slots).toHaveLength(1);
    const slot = body.slots[0];
    expect(slot.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(slot.upload_curl).toContain(`/test-account/test-workspace/o/upload/${slot.id}`);
    expect(slot.upload_curl).toContain("--data-binary @<file>");
    expect(slot.upload_curl).toContain("-H 'Content-Type: <mime>'");
    expect(slot.url).toContain(`/test-account/test-workspace/o/${slot.id}`);
    expect(slot.url).not.toContain("/upload/");
    expect(new Date(slot.expires_at).getTime()).toBeGreaterThan(Date.now());

    const rows = await client.unsafe(
      `SELECT id FROM object_upload_slots WHERE project_id = '${testProjectId}'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(slot.id);
  });

  it("creates N slots when count is given", async () => {
    const app = createTestApp();
    const res = await app.request("/api/o/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 3 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slots).toHaveLength(3);
    const ids = new Set(body.slots.map((s: any) => s.id));
    expect(ids.size).toBe(3);
  });

  it("rejects count > 20", async () => {
    const app = createTestApp();
    const res = await app.request("/api/o/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 21 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects count < 1", async () => {
    const app = createTestApp();
    const res = await app.request("/api/o/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("upload_curl includes X-Kilroy-Filename placeholder", async () => {
    const app = createTestApp();
    const res = await app.request("/api/o/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slots).toHaveLength(1);
    expect(body.slots[0].upload_curl).toContain("X-Kilroy-Filename: <filename>");
  });
});
