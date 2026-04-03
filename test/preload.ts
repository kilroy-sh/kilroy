/**
 * Bun test preload — runs before any test file imports.
 * Forces DATABASE_URL to the kilroy_test database on RDS so that
 * module-level postgres client initialization never touches production.
 *
 * Reads .env directly because bun may not have loaded it at preload time.
 */
const { readFileSync } = require("fs") as typeof import("fs");
const { resolve } = require("path") as typeof import("path");

let dbUrl = process.env.DATABASE_URL || "";

// If DATABASE_URL isn't set yet, read it from .env
if (!dbUrl) {
  try {
    const raw = readFileSync(resolve(__dirname, "..", ".env"), "utf-8");
    const m = raw.match(/^DATABASE_URL=(.+)$/m);
    if (m) dbUrl = m[1].trim();
  } catch (e) {
    console.error("[preload] Failed to read .env:", e);
  }
}

// Rewrite to test database
if (dbUrl && !dbUrl.includes("kilroy_test")) {
  process.env.DATABASE_URL = dbUrl.replace(/\/kilroy(\?|$)/, "/kilroy_test$1");
} else if (!dbUrl) {
  console.error("[preload] WARNING: No DATABASE_URL found, using localhost fallback");
  process.env.DATABASE_URL = "postgres://kilroy:kilroy@localhost:5432/kilroy_test";
}
