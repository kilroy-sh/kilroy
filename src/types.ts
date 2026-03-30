import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Database } from "bun:sqlite";

export type Env = {
  Variables: {
    teamId: string;
    teamSlug: string;
  };
};
