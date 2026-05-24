export type StorageBackend = "postgres" | "s3";

export interface Storage {
  /** Which physical backend this instance writes to. */
  readonly kind: StorageBackend;
  /** Persist bytes under `key`. Idempotent on the same key (overwrite OK). */
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  /** Fetch bytes previously written under `key`. Throws if not found. */
  get(key: string): Promise<Uint8Array>;
}
