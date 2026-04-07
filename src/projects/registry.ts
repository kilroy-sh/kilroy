import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { projects, accounts } from "../db/schema";
import { uuidv7 } from "../lib/uuid";
import { addMember } from "../members/registry";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

const RESERVED_PROJECT_SLUGS = new Set([
  "api",
  "settings",
  "mcp",
  "join",
  "install",
  "browse",
  "search",
  "post",
  "new",
]);

function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validateProjectSlug(slug: string): { valid: boolean; error?: string } {
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      error: "Slug must be 3-40 characters, lowercase alphanumeric and hyphens, cannot start or end with a hyphen",
    };
  }
  if (RESERVED_PROJECT_SLUGS.has(slug)) {
    return { valid: false, error: `Slug "${slug}" is reserved` };
  }
  return { valid: true };
}

export async function createProject(accountId: string, slug: string): Promise<{
  slug: string;
  id: string;
  memberKey: string;
  inviteToken: string;
}> {
  const validation = validateProjectSlug(slug);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.accountId, accountId), eq(projects.slug, slug)));
  if (existing) {
    throw new Error(`Project "${slug}" already exists in this account`);
  }

  const id = uuidv7();
  const inviteToken = generateInviteToken();

  await db.insert(projects).values({
    id,
    slug,
    accountId,
    inviteToken,
  });

  // Create owner membership
  const member = await addMember(id, accountId, "owner");

  return { slug, id, memberKey: member.memberKey, inviteToken };
}

export async function getProjectInviteToken(projectId: string): Promise<string | null> {
  const [project] = await db
    .select({ inviteToken: projects.inviteToken })
    .from(projects)
    .where(eq(projects.id, projectId));
  return project?.inviteToken ?? null;
}

export async function regenerateInviteToken(projectId: string): Promise<string> {
  const newToken = generateInviteToken();
  await db
    .update(projects)
    .set({ inviteToken: newToken })
    .where(eq(projects.id, projectId));
  return newToken;
}

export async function validateInviteToken(
  accountSlug: string,
  projectSlug: string,
  token: string
): Promise<{ valid: true; projectId: string } | { valid: false }> {
  const rows = await db
    .select({ projectId: projects.id })
    .from(projects)
    .innerJoin(accounts, eq(projects.accountId, accounts.id))
    .where(
      and(
        eq(accounts.slug, accountSlug),
        eq(projects.slug, projectSlug),
        eq(projects.inviteToken, token)
      )
    );

  if (rows.length === 0) return { valid: false };
  return { valid: true, projectId: rows[0].projectId };
}

export async function getProjectBySlugs(
  accountSlug: string,
  projectSlug: string
): Promise<{ id: string; slug: string; accountId: string | null; createdAt: string } | null> {
  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      accountId: projects.accountId,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(accounts, eq(projects.accountId, accounts.id))
    .where(and(eq(accounts.slug, accountSlug), eq(projects.slug, projectSlug)));

  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    slug: rows[0].slug,
    accountId: rows[0].accountId,
    createdAt: rows[0].createdAt.toISOString(),
  };
}

export async function listProjectsByAccount(accountId: string) {
  return db.select().from(projects).where(eq(projects.accountId, accountId));
}
