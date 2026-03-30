import { eq } from "drizzle-orm";
import { db, sqlite } from "../db";
import { teams } from "../db/schema";
import { uuidv7 } from "../lib/uuid";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

const RESERVED_SLUGS = new Set([
  "api",
  "app",
  "admin",
  "www",
  "status",
  "mcp",
  "assets",
  "teams",
  "join",
  "health",
  "static",
  "login",
  "signup",
  "settings",
]);

function hashKey(key: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(key);
  return hasher.digest("hex");
}

function generateProjectKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `klry_proj_${hex}`;
}

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      error:
        "Slug must be 3-40 characters, lowercase alphanumeric and hyphens, cannot start or end with a hyphen",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: `Slug "${slug}" is reserved` };
  }
  return { valid: true };
}

export function createTeam(slug: string): {
  slug: string;
  id: string;
  projectKey: string;
} {
  const validation = validateSlug(slug);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const existing = db.select().from(teams).where(eq(teams.slug, slug)).get();
  if (existing) {
    throw new Error(`Team "${slug}" already exists`);
  }

  const id = uuidv7();
  const projectKey = generateProjectKey();
  const now = new Date().toISOString();

  db.insert(teams)
    .values({
      id,
      slug,
      projectKeyHash: hashKey(projectKey),
      createdAt: now,
    })
    .run();

  return { slug, id, projectKey };
}

export function validateKey(
  slug: string,
  key: string
): { valid: true; teamId: string } | { valid: false } {
  const team = db.select().from(teams).where(eq(teams.slug, slug)).get();
  if (!team) {
    return { valid: false };
  }

  const keyHash = hashKey(key);
  if (keyHash !== team.projectKeyHash) {
    return { valid: false };
  }

  return { valid: true, teamId: team.id };
}

export function teamExists(slug: string): boolean {
  const team = db.select().from(teams).where(eq(teams.slug, slug)).get();
  return !!team;
}

export function getTeamBySlug(
  slug: string
): { id: string; slug: string; createdAt: string } | null {
  const team = db.select().from(teams).where(eq(teams.slug, slug)).get();
  if (!team) return null;
  return { id: team.id, slug: team.slug, createdAt: team.createdAt };
}
