import { client } from "../db";
import type { Storage } from "./types";

export class PostgresStorage implements Storage {
  readonly kind = "postgres" as const;

  async put(key: string, bytes: Uint8Array, _mime: string): Promise<void> {
    // ON CONFLICT (object_id) DO UPDATE handles idempotent overwrites; FK to objects(id) enforces the metadata-first invariant.
    await client`
      INSERT INTO object_bytes (object_id, bytes)
      VALUES (${key}, ${Buffer.from(bytes)})
      ON CONFLICT (object_id) DO UPDATE SET bytes = EXCLUDED.bytes
    `;
  }

  async get(key: string): Promise<Uint8Array> {
    const rows = await client`SELECT bytes FROM object_bytes WHERE object_id = ${key}`;
    if (rows.length === 0) {
      throw new Error(`object_bytes: key not found: ${key}`);
    }
    const buf = rows[0]!.bytes as Buffer;
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
}
