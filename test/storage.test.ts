import { describe, it, expect, beforeEach } from "bun:test";
import { resetDb, testProjectId, testAccountId } from "./helpers";
import { PostgresStorage } from "../src/storage/postgres";
import { uuidv7 } from "../src/lib/uuid";
import { client } from "../src/db";

async function insertObjectRow(id: string, backend: "postgres" | "s3") {
  await client.unsafe(`
    INSERT INTO objects (id, project_id, mime, size_bytes, sha256, storage_backend, storage_key, created_by_account_id)
    VALUES ('${id}', '${testProjectId}', 'application/octet-stream', '0', 'deadbeef', '${backend}', '${id}', '${testAccountId}')
  `);
}

describe("PostgresStorage", () => {
  beforeEach(resetDb);

  it("round-trips bytes via put/get", async () => {
    const storage = new PostgresStorage();
    const key = uuidv7();
    await insertObjectRow(key, "postgres");

    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    await storage.put(key, payload, "application/octet-stream");
    const out = await storage.get(key);

    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
  });

  it("overwrites bytes when put is called twice with the same key", async () => {
    const storage = new PostgresStorage();
    const key = uuidv7();
    await insertObjectRow(key, "postgres");

    await storage.put(key, new Uint8Array([1]), "application/octet-stream");
    await storage.put(key, new Uint8Array([2, 2]), "application/octet-stream");

    expect(Array.from(await storage.get(key))).toEqual([2, 2]);
  });

  it("throws on get of unknown key", async () => {
    const storage = new PostgresStorage();
    await expect(storage.get(uuidv7())).rejects.toThrow();
  });

  it("reports kind = 'postgres'", () => {
    expect(new PostgresStorage().kind).toBe("postgres");
  });
});
