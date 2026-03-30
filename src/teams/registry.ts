import { eq } from "drizzle-orm";
import { db } from "../db";
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

export async function createTeam(slug: string): Promise<{
  slug: string;
  id: string;
  projectKey: string;
}> {
  const validation = validateSlug(slug);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const [existing] = await db.select().from(teams).where(eq(teams.slug, slug));
  if (existing) {
    throw new Error(`Team "${slug}" already exists`);
  }

  const id = uuidv7();
  const projectKey = generateProjectKey();

  await db.insert(teams).values({
    id,
    slug,
    projectKeyHash: hashKey(projectKey),
  });

  return { slug, id, projectKey };
}

export async function validateKey(
  slug: string,
  key: string
): Promise<{ valid: true; teamId: string } | { valid: false }> {
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
  if (!team) {
    return { valid: false };
  }

  const keyHash = hashKey(key);
  if (keyHash !== team.projectKeyHash) {
    return { valid: false };
  }

  return { valid: true, teamId: team.id };
}

export async function teamExists(slug: string): Promise<boolean> {
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
  return !!team;
}

export async function getTeamBySlug(
  slug: string
): Promise<{ id: string; slug: string; createdAt: string } | null> {
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
  if (!team) return null;
  return { id: team.id, slug: team.slug, createdAt: team.createdAt.toISOString() };
}
