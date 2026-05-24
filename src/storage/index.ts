import { PostgresStorage } from "./postgres";
import { S3Storage } from "./s3";
import type { Storage } from "./types";

export type { Storage, StorageBackend } from "./types";

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (instance) return instance;
  const bucket = process.env.KILROY_S3_BUCKET;
  if (bucket) {
    if (!process.env.KILROY_S3_PREFIX) {
      throw new Error("KILROY_S3_PREFIX is required when KILROY_S3_BUCKET is set");
    }
    instance = new S3Storage();
  } else {
    instance = new PostgresStorage();
  }
  return instance;
}

/** Human-readable banner about the active backend — printed at server boot. */
export function describeStorage(): string {
  const bucket = process.env.KILROY_S3_BUCKET;
  if (bucket) {
    return `Object store: S3 (bucket=${bucket}, prefix=${process.env.KILROY_S3_PREFIX})`;
  }
  return "Object store: Postgres bytea (no KILROY_S3_BUCKET set)";
}

/** Test-only: clear cached singleton so env changes take effect. */
export function _resetStorageForTests(): void {
  instance = null;
}
