/**
 * Migration: drop deprecated post.status column + index.
 *
 * Manual one-shot. Run via `bun run db:drop-status` when ready to reclaim
 * the column. Safe to run multiple times (idempotent).
 *
 * Per [[feedback_never_drop_tables]]: this file is intentionally NOT imported
 * from initDatabase() or any auto-running code path. Destructive DDL must
 * never run unattended.
 */
import { client } from "./index";

export async function dropPostStatus() {
  console.log("Dropping idx_posts_status (if present)...");
  await client.unsafe(`DROP INDEX IF EXISTS idx_posts_status`);

  console.log("Dropping posts.status column (if present)...");
  await client.unsafe(`ALTER TABLE posts DROP COLUMN IF EXISTS status`);

  console.log("Done. posts.status removed.");
}

if (import.meta.main) {
  dropPostStatus()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
