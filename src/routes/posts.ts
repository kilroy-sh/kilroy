import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db";
import { posts, comments, accounts } from "../db/schema";
import { uuidv7 } from "../lib/uuid";
import { getBaseUrl } from "../lib/url";
import { formatPost, formatComment } from "../lib/format";
import type { Env } from "../types";

export const postsRouter = new Hono<Env>();

function generatePublicShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `klry_post_${hex}`;
}

async function getAccountDisplay(accountId: string | null) {
  if (!accountId) return null;
  const [row] = await db.select({ slug: accounts.slug, displayName: accounts.displayName }).from(accounts).where(eq(accounts.id, accountId));
  return row || null;
}

// GET /posts/:id — Read a post with all comments
postsRouter.get("/:id", async (c) => {
  const postId = c.req.param("id");
  const projectId = c.get("projectId");
  const baseUrl = getBaseUrl(c.req.url);

  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  const postComments = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  // Compute contributors (account-based)
  const accountIds = new Set<string>();
  if (post.authorAccountId) accountIds.add(post.authorAccountId);
  for (const comment of postComments) {
    if (comment.authorAccountId) accountIds.add(comment.authorAccountId);
  }

  const displayMap = new Map<string, { slug: string; displayName: string }>();
  for (const id of accountIds) {
    const display = await getAccountDisplay(id);
    if (display) displayMap.set(id, display);
  }

  const contributors = Array.from(accountIds).map((id) => ({
    account_id: id,
    slug: displayMap.get(id)?.slug,
    display_name: displayMap.get(id)?.displayName,
  }));

  const postDisplay = post.authorAccountId ? displayMap.get(post.authorAccountId) || null : null;

  return c.json({
    ...formatPost(post, postDisplay, baseUrl),
    body: post.body,
    contributors,
    comments: postComments.map((comment) => {
      const commentDisplay = comment.authorAccountId ? displayMap.get(comment.authorAccountId) || null : null;
      return formatComment(comment, commentDisplay);
    }),
  });
});

// POST /posts — Create a new post
postsRouter.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.title || !body.body) {
    return c.json(
      { error: "Missing required fields: title, body", code: "INVALID_INPUT" },
      400
    );
  }

  if (!body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
    return c.json(
      { error: "At least one tag is required", code: "INVALID_INPUT" },
      400
    );
  }

  const projectId = c.get("projectId");
  const memberAccountId = c.get("memberAccountId");
  const authorType = c.get("authorType");
  const baseUrl = getBaseUrl(c.req.url);
  const now = new Date();
  const id = uuidv7();

  const post = {
    id,
    projectId,
    title: body.title,
    status: "active" as const,
    tags: body.tags ? JSON.stringify(body.tags) : null,
    body: body.body,
    authorAccountId: memberAccountId,
    authorType: authorType,
    authorMetadata: body.author_metadata ? JSON.stringify(body.author_metadata) : null,
    publicShareToken: null,
    publicSharedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(posts).values(post);

  // FTS search_vector is updated automatically by database trigger

  const display = await getAccountDisplay(memberAccountId);

  return c.json(
    {
      ...formatPost(post, display, baseUrl),
    },
    201
  );
});

// POST /posts/:id/comments — Add a comment to a post
postsRouter.post("/:id/comments", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json();

  if (!body.body) {
    return c.json(
      { error: "Missing required field: body", code: "INVALID_INPUT" },
      400
    );
  }

  const projectId = c.get("projectId");
  const memberAccountId = c.get("memberAccountId");
  const authorType = c.get("authorType");

  // Check post exists and belongs to this project
  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  const now = new Date();
  const id = uuidv7();

  const comment = {
    id,
    projectId,
    postId,
    body: body.body,
    authorAccountId: memberAccountId,
    authorType: authorType,
    authorMetadata: body.author_metadata ? JSON.stringify(body.author_metadata) : null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(comments).values(comment);

  // Update post's updated_at
  await db.update(posts).set({ updatedAt: now }).where(eq(posts.id, postId));

  // FTS search_vector is updated automatically by database trigger

  const display = await getAccountDisplay(memberAccountId);

  return c.json(
    formatComment(comment, display),
    201
  );
});

// PATCH /posts/:id/comments/:commentId — Update a comment
postsRouter.patch("/:id/comments/:commentId", async (c) => {
  const postId = c.req.param("id");
  const commentId = c.req.param("commentId");
  const body = await c.req.json();

  if (!body.body || typeof body.body !== "string" || body.body.length === 0) {
    return c.json(
      { error: "Field 'body' is required and must be a non-empty string", code: "INVALID_INPUT" },
      400
    );
  }

  const projectId = c.get("projectId");
  const memberAccountId = c.get("memberAccountId");

  // Find the comment and verify it belongs to this post and project
  const [comment] = await db.select().from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.projectId, projectId)));

  if (!comment || comment.postId !== postId) {
    return c.json({ error: "Comment not found", code: "NOT_FOUND" }, 404);
  }

  // Author matching: member can only edit their own comments
  if (comment.authorAccountId && comment.authorAccountId !== memberAccountId) {
    return c.json(
      { error: "You can only edit your own comments", code: "AUTHOR_MISMATCH" },
      403
    );
  }

  const now = new Date();

  // Update comment (trigger auto-updates search_vector)
  await db.update(comments)
    .set({ body: body.body, updatedAt: now })
    .where(eq(comments.id, commentId));

  // Update parent post's updated_at
  await db.update(posts).set({ updatedAt: now }).where(eq(posts.id, postId));

  const display = await getAccountDisplay(comment.authorAccountId);

  return c.json(formatComment({
    ...comment,
    body: body.body,
    updatedAt: now,
  }, display));
});

// PATCH /posts/:id — Update post content and/or status
postsRouter.patch("/:id", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json();

  const hasContent = body.title !== undefined ||
    body.body !== undefined || body.tags !== undefined;
  const hasStatus = body.status !== undefined;

  if (!hasContent && !hasStatus) {
    return c.json(
      { error: "At least one field required: title, body, tags, or status", code: "INVALID_INPUT" },
      400
    );
  }

  // Validate non-empty strings for text fields
  for (const field of ["title", "body"] as const) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length === 0)) {
      return c.json(
        { error: `Field '${field}' must be a non-empty string`, code: "INVALID_INPUT" },
        400
      );
    }
  }

  // Validate status enum if provided
  const validStatuses = ["active", "archived", "obsolete"];
  if (hasStatus && !validStatuses.includes(body.status)) {
    return c.json(
      { error: `Invalid status: ${body.status}. Must be one of: ${validStatuses.join(", ")}`, code: "INVALID_INPUT" },
      400
    );
  }

  const projectId = c.get("projectId");
  const memberAccountId = c.get("memberAccountId");
  const baseUrl = getBaseUrl(c.req.url);

  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  // Author matching: member can only edit their own posts
  if (post.authorAccountId && post.authorAccountId !== memberAccountId) {
    return c.json(
      { error: "You can only edit your own posts", code: "AUTHOR_MISMATCH" },
      403
    );
  }

  // Validate status transition if status is being changed
  if (hasStatus && body.status !== post.status) {
    const validTransitions: Record<string, string[]> = {
      active: ["archived", "obsolete"],
      archived: ["active"],
      obsolete: ["active"],
    };

    if (!validTransitions[post.status]?.includes(body.status)) {
      return c.json(
        { error: `Invalid transition: ${post.status} -> ${body.status}`, code: "INVALID_TRANSITION" },
        409
      );
    }
  }

  // Build update set
  const now = new Date();
  const updates: Record<string, any> = { updatedAt: now };

  if (body.title !== undefined) updates.title = body.title;
  if (body.body !== undefined) updates.body = body.body;
  if (body.tags !== undefined) updates.tags = body.tags.length > 0 ? JSON.stringify(body.tags) : null;
  if (hasStatus) updates.status = body.status;

  // Trigger auto-updates search_vector when title or body changes
  await db.update(posts).set(updates).where(eq(posts.id, postId));

  // Read back the full post for response
  const [updated] = await db.select().from(posts).where(eq(posts.id, postId));
  const display = await getAccountDisplay(updated.authorAccountId);
  return c.json(formatPost(updated, display, baseUrl));
});

// POST /posts/:id/share — Generate or return an existing public share link
postsRouter.post("/:id/share", async (c) => {
  const postId = c.req.param("id");
  const projectId = c.get("projectId");
  const baseUrl = getBaseUrl(c.req.url);

  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  let sharedPost = post;
  if (!post.publicShareToken) {
    const shareToken = generatePublicShareToken();
    const sharedAt = new Date();
    await db.update(posts)
      .set({ publicShareToken: shareToken, publicSharedAt: sharedAt })
      .where(eq(posts.id, postId));

    const [updated] = await db.select().from(posts).where(eq(posts.id, postId));
    sharedPost = updated;
  }

  return c.json({
    share: formatPost(sharedPost, null, baseUrl).share,
  });
});

// DELETE /posts/:id/share — Revoke a public share link
postsRouter.delete("/:id/share", async (c) => {
  const postId = c.req.param("id");
  const projectId = c.get("projectId");

  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  await db.update(posts)
    .set({ publicShareToken: null, publicSharedAt: null })
    .where(eq(posts.id, postId));

  return c.json({ share: null });
});

// DELETE /posts/:id — Permanently delete a post and all comments
postsRouter.delete("/:id", async (c) => {
  const postId = c.req.param("id");

  const projectId = c.get("projectId");
  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  // Delete comments then post (cascade should handle this, but be explicit)
  await db.delete(comments).where(eq(comments.postId, postId));
  await db.delete(posts).where(eq(posts.id, postId));

  return c.json({ deleted: true, post_id: postId });
});
