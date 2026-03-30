import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://kilroy:kilroy@localhost:5432/kilroy";

export const client = postgres(DATABASE_URL);
export const db = drizzle(client, { schema });

export async function initDatabase() {
  // Create tables
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      project_key_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
      search_vector TSVECTOR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      author TEXT,
      search_vector TSVECTOR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Indexes
  await client.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_posts_team_id ON posts(team_id);
    CREATE INDEX IF NOT EXISTS idx_posts_team_topic ON posts(team_id, topic);
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS idx_comments_search ON comments USING GIN(search_vector);
  `);

  // Full-text search triggers for posts
  await client.unsafe(`
    CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
    CREATE TRIGGER posts_search_vector_trigger
      BEFORE INSERT OR UPDATE OF title, body ON posts
      FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
  `);

  // Full-text search triggers for comments
  await client.unsafe(`
    CREATE OR REPLACE FUNCTION comments_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english', coalesce(NEW.body, ''));
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS comments_search_vector_trigger ON comments;
    CREATE TRIGGER comments_search_vector_trigger
      BEFORE INSERT OR UPDATE OF body ON comments
      FOR EACH ROW EXECUTE FUNCTION comments_search_vector_update();
  `);

  // Backfill search_vector for any existing rows that have NULL vectors
  await client.unsafe(`
    UPDATE posts SET search_vector =
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(body, '')), 'B')
    WHERE search_vector IS NULL;

    UPDATE comments SET search_vector =
      to_tsvector('english', coalesce(body, ''))
    WHERE search_vector IS NULL;
  `);
}
