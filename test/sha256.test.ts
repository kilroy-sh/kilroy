import { describe, it, expect } from "bun:test";
import { sha256Hex } from "../src/lib/sha256";

describe("sha256Hex", () => {
  it("matches the known hash of an empty input", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("matches the known hash of 'abc'", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
