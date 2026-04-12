import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import { posts, comments, accounts } from "../db/schema";
import { formatPost, formatComment } from "../lib/format";
import { getBaseUrl } from "../lib/url";

export const publicPostsRouter = new Hono();

async function getAccountDisplay(accountId: string | null) {
  if (!accountId) return null;
  const [row] = await db
    .select({ slug: accounts.slug, displayName: accounts.displayName })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  return row || null;
}

// GET /api/public/posts/:token — Read a publicly shared post
publicPostsRouter.get("/posts/:token", async (c) => {
  const token = c.req.param("token");
  const baseUrl = getBaseUrl(c.req.url);

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.publicShareToken, token));

  if (!post) {
    return c.json({ error: "Shared post not found", code: "NOT_FOUND" }, 404);
  }

  const postComments = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, post.id))
    .orderBy(asc(comments.createdAt));

  const accountIds = new Set<string>();
  if (post.authorAccountId) accountIds.add(post.authorAccountId);
  for (const comment of postComments) {
    if (comment.authorAccountId) accountIds.add(comment.authorAccountId);
  }

  const displayMap = new Map<string, { slug: string; displayName: string }>();
  for (const accountId of accountIds) {
    const display = await getAccountDisplay(accountId);
    if (display) displayMap.set(accountId, display);
  }

  const postDisplay = post.authorAccountId ? displayMap.get(post.authorAccountId) || null : null;

  return c.json({
    ...formatPost(post, postDisplay, baseUrl),
    body: post.body,
    comments: postComments.map((comment) => {
      const commentDisplay = comment.authorAccountId ? displayMap.get(comment.authorAccountId) || null : null;
      return formatComment(comment, commentDisplay);
    }),
  });
});
