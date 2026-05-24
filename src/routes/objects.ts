import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types";
import { client } from "../db";
import { getStorage } from "../storage";
import { sha256Hex } from "../lib/sha256";
import { getBaseUrl } from "../lib/url";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const objectsRouter = new Hono<Env>();

// Upload consumption — the slot UUID IS the eventual object UUID, so the
// returned URL is stable from the moment the slot was provisioned.
// The slot row carries the uploader's account id (set at provision time);
// no member credentials are required here — the slot is the bearer.
objectsRouter.put("/upload/:slotId", async (c) => {
  const slotId = c.req.param("slotId");
  const projectId = c.get("projectId");

  const slotRows = await client.unsafe(
    `SELECT id, project_id, created_by_account_id, consumed_at, expires_at
     FROM object_upload_slots WHERE id = $1`,
    [slotId],
  );
  const slot = slotRows[0];
  if (!slot) return c.text("Unknown upload slot", 404);
  if (slot.project_id !== projectId) return c.text("Unknown upload slot", 404);
  if (slot.consumed_at !== null) return c.text("Slot already consumed", 410);
  if (new Date(slot.expires_at as string).getTime() < Date.now()) {
    return c.text("Slot expired", 410);
  }

  const buf = new Uint8Array(await c.req.raw.arrayBuffer());
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    return c.text(`Body exceeds ${MAX_UPLOAD_BYTES} bytes`, 413);
  }

  const mime = c.req.header("Content-Type") ?? "application/octet-stream";
  const rawFilename = c.req.header("X-Kilroy-Filename") ?? null;
  // Defensive: reject C0 controls / DEL (HTTP-header-unsafe), NUL (Postgres
  // TEXT-unsafe), and `"` / `\` (Content-Disposition quoted-string unsafe).
  // Also bound length to keep storage sane.
  const filename =
    rawFilename === null
      ? null
      : rawFilename.length > 0 &&
          rawFilename.length <= 255 &&
          !/[\x00-\x1F\x7F"\\]/.test(rawFilename)
        ? rawFilename
        : null;
  const storage = getStorage();
  const objectId = slot.id as string; // slot uuid == object uuid
  const hash = sha256Hex(buf);

  // Atomically mark the slot consumed AND insert object metadata. The slot
  // update uses `consumed_at IS NULL` so concurrent uploads to the same slot
  // can't both succeed. Storage put happens AFTER commit; if it fails the
  // metadata row is orphaned (no bytes), but the slot is gone — an
  // observable, non-replayable failure rather than a silent inconsistency.
  await client.begin(async (tx) => {
    const updated = await tx.unsafe(
      `UPDATE object_upload_slots
       SET consumed_at = now()
       WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()
       RETURNING id`,
      [slotId],
    );
    if (updated.length === 0) {
      throw new Error("Slot already consumed or expired (race)");
    }
    await tx.unsafe(
      `INSERT INTO objects (id, project_id, mime, size_bytes, sha256, storage_backend, storage_key, created_by_account_id, filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [objectId, projectId, mime, String(buf.byteLength), hash, storage.kind, objectId, slot.created_by_account_id, filename],
    );
  });

  await storage.put(objectId, buf, mime);

  const baseUrl = getBaseUrl(c.req.url);
  const url = `${baseUrl}/${c.get("accountSlug")}/${c.get("projectSlug")}/o/${objectId}`;
  return c.json({ id: objectId, url, sha256: hash, size_bytes: buf.byteLength, filename }, 201);
});

async function handleGetOrHead(c: Context<Env>, includeBody: boolean) {
  const id = c.req.param("id");
  const projectId = c.get("projectId");

  const rows = await client.unsafe(
    `SELECT id, project_id, mime, size_bytes, sha256, storage_backend, storage_key, filename, created_at
     FROM objects WHERE id = $1`,
    [id],
  );
  const obj = rows[0];
  if (!obj) return c.text("Not found", 404);
  if (obj.project_id !== projectId) return c.text("Not found", 404);

  // Members may always read. Anonymous (no memberAccountId) is allowed only
  // when the object is referenced from a publicly-shared post in this project.
  const memberAccountId = c.get("memberAccountId");
  if (!memberAccountId) {
    const objectUrlSuffix = `/o/${id}`;
    const ref = await client.unsafe(
      `SELECT 1 FROM posts
       WHERE project_id = $1
         AND public_share_token IS NOT NULL
         AND body LIKE $2
       LIMIT 1`,
      [projectId, `%${objectUrlSuffix}%`],
    );
    if (ref.length === 0) return c.text("Forbidden", 403);
  }

  const headers: Record<string, string> = {
    "Content-Type": obj.mime as string,
    "Content-Length": String(obj.size_bytes),
    "ETag": `"${obj.sha256}"`,
    "Last-Modified": new Date(obj.created_at as string | Date).toUTCString(),
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (obj.filename && !/["\\\r\n\x00-\x1F\x7F]/.test(obj.filename as string)) {
    // T1 input sanitizer normally guarantees this is safe to interpolate, but
    // we guard at emit time too — if a future write path skips the sanitizer,
    // we'd rather drop the header than emit a malformed/injected one.
    headers["Content-Disposition"] = `attachment; filename="${obj.filename}"`;
  }

  if (!includeBody) {
    return new Response(null, { status: 200, headers });
  }

  const storage =
    obj.storage_backend === "postgres"
      ? new (await import("../storage/postgres")).PostgresStorage()
      : new (await import("../storage/s3")).S3Storage();

  const bytes = await storage.get(obj.storage_key as string);
  return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers });
}

objectsRouter.get("/:id", (c) => handleGetOrHead(c, true));
objectsRouter.on("HEAD", "/:id", (c) => handleGetOrHead(c, false));
