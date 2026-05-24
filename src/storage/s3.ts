import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { Storage } from "./types";

function getBucket(): string {
  const b = process.env.KILROY_S3_BUCKET;
  if (!b) throw new Error("KILROY_S3_BUCKET not set");
  return b;
}

function getPrefix(): string {
  // Required when S3 is selected. Validated again at getStorage() time
  // so server boot fails loudly if the operator forgets it.
  const p = process.env.KILROY_S3_PREFIX;
  if (!p) {
    throw new Error("KILROY_S3_PREFIX is required when KILROY_S3_BUCKET is set");
  }
  return p.replace(/^\/+|\/+$/g, "");
}

function prefixedKey(key: string): string {
  return `${getPrefix()}/${key}`;
}

export class S3Storage implements Storage {
  readonly kind = "s3" as const;
  // AWS S3 only — no custom endpoint / path-style support in v1.
  private client = new S3Client({
    region: process.env.AWS_REGION,
  });

  async put(key: string, bytes: Uint8Array, mime: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: getBucket(),
      Key: prefixedKey(key),
      Body: bytes,
      ContentType: mime,
    }));
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await this.client.send(new GetObjectCommand({
      Bucket: getBucket(),
      Key: prefixedKey(key),
    }));
    if (!res.Body) throw new Error(`s3: empty body for key: ${key}`);
    return new Uint8Array(await res.Body.transformToByteArray());
  }
}
