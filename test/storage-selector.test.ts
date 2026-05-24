import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getStorage, _resetStorageForTests } from "../src/storage";

describe("getStorage selector", () => {
  const originalBucket = process.env.KILROY_S3_BUCKET;
  const originalPrefix = process.env.KILROY_S3_PREFIX;

  beforeEach(() => _resetStorageForTests());
  afterEach(() => {
    if (originalBucket === undefined) delete process.env.KILROY_S3_BUCKET;
    else process.env.KILROY_S3_BUCKET = originalBucket;
    if (originalPrefix === undefined) delete process.env.KILROY_S3_PREFIX;
    else process.env.KILROY_S3_PREFIX = originalPrefix;
    _resetStorageForTests();
  });

  it("returns Postgres backend when KILROY_S3_BUCKET is unset", () => {
    delete process.env.KILROY_S3_BUCKET;
    expect(getStorage().kind).toBe("postgres");
  });

  it("returns S3 backend when KILROY_S3_BUCKET and KILROY_S3_PREFIX are set", () => {
    process.env.KILROY_S3_BUCKET = "test-bucket";
    process.env.KILROY_S3_PREFIX = "test-prefix";
    expect(getStorage().kind).toBe("s3");
  });

  it("throws if KILROY_S3_BUCKET is set without KILROY_S3_PREFIX", () => {
    process.env.KILROY_S3_BUCKET = "test-bucket";
    delete process.env.KILROY_S3_PREFIX;
    expect(() => getStorage()).toThrow(/KILROY_S3_PREFIX/);
  });

  it("caches the instance across calls", () => {
    delete process.env.KILROY_S3_BUCKET;
    expect(getStorage()).toBe(getStorage());
  });
});
