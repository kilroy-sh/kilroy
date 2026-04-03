/**
 * Bun test preload — runs before any test file imports.
 * Forces DATABASE_URL to the test database so that module-level
 * postgres client initialization in src/db/index.ts never touches production.
 */
const prodUrl = process.env.DATABASE_URL || "";
if (prodUrl) {
  // Replace the database name in the URL with kilroy_test
  const testUrl = prodUrl.replace(/\/kilroy(\?|$)/, "/kilroy_test$1");
  process.env.DATABASE_URL = testUrl;
} else {
  process.env.DATABASE_URL = "postgres://kilroy:kilroy@localhost:5432/kilroy_test";
}
