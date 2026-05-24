import { Hono } from "hono";
import type { Env } from "../types";
import { client } from "../db";
import { uuidv7 } from "../lib/uuid";
import { getBaseUrl } from "../lib/url";

const SLOT_TTL_MS = 10 * 60 * 1000;
const MAX_COUNT = 20;

export const objectSlotsRouter = new Hono<Env>();

objectSlotsRouter.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { count?: number };
  const count = body.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return c.text(`count must be an integer between 1 and ${MAX_COUNT}`, 400);
  }

  const projectId = c.get("projectId");
  const memberAccountId = c.get("memberAccountId");
  const accountSlug = c.get("accountSlug");
  const projectSlug = c.get("projectSlug");
  const baseUrl = getBaseUrl(c.req.url);

  const expiresAt = new Date(Date.now() + SLOT_TTL_MS);
  const slots: Array<{
    id: string;
    url: string;
    upload_curl: string;
    expires_at: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const id = uuidv7();
    await client.unsafe(
      `INSERT INTO object_upload_slots (id, project_id, created_by_account_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, projectId, memberAccountId, expiresAt.toISOString()],
    );
    const objectUrl = `${baseUrl}/${accountSlug}/${projectSlug}/o/${id}`;
    const uploadUrl = `${baseUrl}/${accountSlug}/${projectSlug}/o/upload/${id}`;
    slots.push({
      id,
      url: objectUrl,
      upload_curl: `curl -X PUT --data-binary @<file> -H 'Content-Type: <mime>' '${uploadUrl}'`,
      expires_at: expiresAt.toISOString(),
    });
  }

  return c.json({ slots }, 201);
});
