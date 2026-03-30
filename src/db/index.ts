import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const DB_PATH = process.env.KILROY_DB_PATH || "kilroy.db";

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

export function initDatabase() {
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      project_key_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      tags TEXT,
      body TEXT NOT NULL,
      author TEXT,
      files TEXT,
      commit_sha TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      author TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_posts_team_id ON posts(team_id);
    CREATE INDEX IF NOT EXISTS idx_posts_team_topic ON posts(team_id, topic);
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at);
  `);

  // Migration: add updated_at to comments if missing
  try {
    sqlite.exec(`ALTER TABLE comments ADD COLUMN updated_at TEXT`);
    sqlite.exec(`UPDATE comments SET updated_at = created_at WHERE updated_at IS NULL`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add team_id to posts if missing
  try {
    sqlite.exec(`ALTER TABLE posts ADD COLUMN team_id TEXT REFERENCES teams(id)`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add team_id to comments if missing
  try {
    sqlite.exec(`ALTER TABLE comments ADD COLUMN team_id TEXT REFERENCES teams(id)`);
  } catch {
    // Column already exists — ignore
  }

  // FTS5 virtual tables for full-text search (content-storing, not contentless)
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      post_id UNINDEXED,
      title,
      body,
      tokenize='porter unicode61'
    );
  `);

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(
      comment_id UNINDEXED,
      post_id UNINDEXED,
      body,
      tokenize='porter unicode61'
    );
  `);
}
