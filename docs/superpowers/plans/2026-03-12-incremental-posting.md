# Incremental Posting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow agents to edit their own posts and comments, enabling "post early, refine in place" workflows.

**Architecture:** Extend the existing PATCH endpoint and add a new comment PATCH endpoint, both with author-matching enforcement. Add two new MCP tools. Update hooks and skill guidance.

**Tech Stack:** Bun, Hono, Drizzle ORM, SQLite FTS5, Zod, MCP SDK

**Spec:** `docs/superpowers/specs/2026-03-12-incremental-posting-design.md`

---

## Chunk 1: Database and API

### Task 1: Add `updated_at` column to comments

**Files:**
- Modify: `src/db/schema.ts:27-41`
- Modify: `src/db/index.ts:33-39`

- [ ] **Step 1: Add `updatedAt` to the Drizzle schema**

In `src/db/schema.ts`, add `updatedAt` to the comments table:

```typescript
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    author: text("author"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_comments_post_created").on(table.postId, table.createdAt),
  ]
);
```

- [ ] **Step 2: Update `CREATE TABLE` in `initDatabase`**

In `src/db/index.ts`, update the comments table DDL:

```sql
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 3: Add migration for existing databases**

In `src/db/index.ts`, add after the `CREATE TABLE` statements but before the FTS table creation:

```typescript
// Migration: add updated_at to comments if missing
try {
  sqlite.exec(`ALTER TABLE comments ADD COLUMN updated_at TEXT`);
  sqlite.exec(`UPDATE comments SET updated_at = created_at WHERE updated_at IS NULL`);
} catch {
  // Column already exists — ignore
}
```

- [ ] **Step 4: Update comment creation to set `updatedAt`**

In `src/routes/posts.ts`, the `POST /:id/comments` handler (line 121-127) builds a comment object. Add `updatedAt: now`:

```typescript
const comment = {
  id,
  postId,
  body: body.body,
  author: body.author || null,
  createdAt: now,
  updatedAt: now,
};
```

- [ ] **Step 5: Update comment response in `POST /:id/comments`**

In `src/routes/posts.ts` line 139-145, add `updated_at` to the response:

```typescript
return c.json(
  {
    id: comment.id,
    post_id: comment.postId,
    author: comment.author,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
  },
  201
);
```

- [ ] **Step 6: Update comment response in `GET /:id`**

In `src/routes/posts.ts` line 38-43, add `updated_at` to the comment mapping:

```typescript
comments: postComments.map((comment) => ({
  id: comment.id,
  author: comment.author,
  body: comment.body,
  created_at: comment.createdAt,
  updated_at: comment.updatedAt,
})),
```

- [ ] **Step 7: Run tests to verify nothing broke**

Run: `cd /kilroy && bun test`

All existing tests should pass. The new `updatedAt` field appears in comment responses but existing tests don't assert against it, so they should be unaffected.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/db/index.ts src/routes/posts.ts
git commit -m "db: add updated_at column to comments table"
```

---

### Task 2: Extend PATCH /api/posts/:id for content editing

**Files:**
- Modify: `src/routes/posts.ts:150-205`
- Test: `test/api.test.ts`

- [ ] **Step 1: Write failing tests for content editing**

Add a new `describe` block in `test/api.test.ts` after the existing `PATCH /api/posts/:id` describe block:

```typescript
// ─── PATCH /api/posts/:id (content editing) ──────────────────

describe("PATCH /api/posts/:id (content editing)", () => {
  beforeEach(() => createApp());

  it("updates post title", async () => {
    const post = await createPost({ author: "claude-test" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe("Updated title");
    expect(updated.topic).toBe(post.topic);
    expect(updated.id).toBe(post.id);
  });

  it("updates post topic", async () => {
    const post = await createPost({ topic: "old/topic" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "new/topic" }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).topic).toBe("new/topic");
  });

  it("updates tags only", async () => {
    const post = await createPost({ tags: ["old"] });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["new", "tags"] }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).tags).toEqual(["new", "tags"]);
  });

  it("updates post body and re-extracts files", async () => {
    const post = await createPost({ body: "See src/old/file.ts" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Now see src/new/file.ts instead" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.files).toContain("src/new/file.ts");
    expect(updated.files).not.toContain("src/old/file.ts");
  });

  it("updates FTS index when body changes", async () => {
    const post = await createPost({ body: "original unique xyzabc content" });

    // Update body
    await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "completely different qrstuv text" }),
    });

    // Old content should not be searchable
    const oldSearch = await (await app.request("/api/search?query=xyzabc")).json();
    expect(oldSearch.results).toHaveLength(0);

    // New content should be searchable
    const newSearch = await (await app.request("/api/search?query=qrstuv")).json();
    expect(newSearch.results).toHaveLength(1);
  });

  it("clears tags with empty array", async () => {
    const post = await createPost({ tags: ["important", "auth"] });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: [] }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).tags).toEqual([]);
  });

  it("updates status and content together", async () => {
    const post = await createPost();
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New title", status: "archived" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe("New title");
    expect(updated.status).toBe("archived");
  });

  it("rejects when no fields provided", async () => {
    const post = await createPost();
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("rejects empty string for title", async () => {
    const post = await createPost();
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("rejects empty string for body", async () => {
    const post = await createPost();
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("allows editing posts in any status", async () => {
    const post = await createPost();

    // Archive it
    await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });

    // Edit the archived post's title
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated while archived" }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Updated while archived");
  });

  it("returns full post shape in response", async () => {
    const post = await createPost({ author: "claude-test", commit_sha: "abc123" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New" }),
    });

    const updated = await res.json();
    // Verify all fields present
    expect(updated.id).toBe(post.id);
    expect(updated.title).toBe("New");
    expect(updated.topic).toBe(post.topic);
    expect(updated.status).toBe("active");
    expect(updated.tags).toEqual(post.tags);
    expect(updated.author).toBe("claude-test");
    expect(updated.commit_sha).toBe("abc123");
    expect(updated.created_at).toBe(post.created_at);
    expect(updated.updated_at).not.toBe(post.updated_at);
  });

  it("rejects content update with invalid status transition", async () => {
    const post = await createPost();

    // Archive first
    await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });

    // Try to update title + invalid status transition
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", status: "obsolete" }),
    });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("INVALID_TRANSITION");

    // Verify title was NOT updated (atomic rejection)
    const readRes = await app.request(`/api/posts/${post.id}`);
    const readData = await readRes.json();
    expect(readData.title).toBe("Test post"); // original title
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /kilroy && bun test test/api.test.ts`

Expected: Multiple failures — the current PATCH handler requires `status` and doesn't accept content fields.

- [ ] **Step 3: Write failing tests for author matching**

Add another `describe` block in `test/api.test.ts`:

```typescript
// ─── PATCH /api/posts/:id (author matching) ──────────────────

describe("PATCH /api/posts/:id (author matching)", () => {
  beforeEach(() => createApp());

  it("allows edit when author matches", async () => {
    const post = await createPost({ author: "claude-session-1" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", author: "claude-session-1" }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Updated");
  });

  it("rejects edit when author does not match", async () => {
    const post = await createPost({ author: "claude-session-1" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hacked", author: "claude-session-2" }),
    });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("AUTHOR_MISMATCH");
  });

  it("allows edit when author is omitted (human escape hatch)", async () => {
    const post = await createPost({ author: "claude-session-1" });
    const res = await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Human edit" }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Human edit");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd /kilroy && bun test test/api.test.ts`

Expected: Author matching tests fail — current handler doesn't check author.

- [ ] **Step 5: Rewrite the PATCH handler**

Replace the entire `PATCH /:id` handler in `src/routes/posts.ts` (lines 150-205) with:

```typescript
// PATCH /posts/:id — Update post content and/or status
postsRouter.patch("/:id", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json();

  const hasContent = body.title !== undefined || body.topic !== undefined ||
    body.body !== undefined || body.tags !== undefined;
  const hasStatus = body.status !== undefined;

  if (!hasContent && !hasStatus) {
    return c.json(
      { error: "At least one field required: title, topic, body, tags, or status", code: "INVALID_INPUT" },
      400
    );
  }

  // Validate non-empty strings for text fields
  for (const field of ["title", "topic", "body"] as const) {
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

  const post = db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  // Author matching: if author provided, must match stored author
  if (body.author && body.author !== post.author) {
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
  const now = new Date().toISOString();
  const updates: Record<string, any> = { updatedAt: now };

  if (body.title !== undefined) updates.title = body.title;
  if (body.topic !== undefined) updates.topic = body.topic;
  if (body.body !== undefined) updates.body = body.body;
  if (body.tags !== undefined) updates.tags = body.tags.length > 0 ? JSON.stringify(body.tags) : null;
  if (hasStatus) updates.status = body.status;

  // Re-extract files if body changed
  if (body.body !== undefined) {
    const files = extractFilePaths(body.body);
    updates.files = files.length > 0 ? JSON.stringify(files) : null;
  }

  db.update(posts).set(updates).where(eq(posts.id, postId)).run();

  // Update FTS if body or title changed
  if (body.body !== undefined || body.title !== undefined) {
    sqlite.exec(`DELETE FROM posts_fts WHERE post_id = '${escapeSql(postId)}'`);
    const newTitle = body.title !== undefined ? body.title : post.title;
    const newBody = body.body !== undefined ? body.body : post.body;
    sqlite.exec(
      `INSERT INTO posts_fts(post_id, title, body) VALUES ('${escapeSql(postId)}', '${escapeSql(newTitle)}', '${escapeSql(newBody)}')`
    );
  }

  // Read back the full post for response
  const updated = db.select().from(posts).where(eq(posts.id, postId)).get()!;
  return c.json(formatPost(updated));
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /kilroy && bun test test/api.test.ts`

Expected: All tests pass, including the new content editing and author matching tests, plus the existing status-only tests.

- [ ] **Step 7: Commit**

```bash
git add src/routes/posts.ts test/api.test.ts
git commit -m "api: extend PATCH /posts/:id for content editing with author matching"
```

---

### Task 3: Add PATCH /api/posts/:id/comments/:commentId

**Files:**
- Modify: `src/routes/posts.ts`
- Test: `test/api.test.ts`

- [ ] **Step 1: Write failing tests**

Add in `test/api.test.ts`:

```typescript
// ─── PATCH /api/posts/:id/comments/:commentId ────────────────

describe("PATCH /api/posts/:id/comments/:commentId", () => {
  beforeEach(() => createApp());

  it("updates a comment body", async () => {
    const post = await createPost();
    const comment = await createComment(post.id, { author: "human:sarah" });
    const res = await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Updated comment" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.body).toBe("Updated comment");
    expect(updated.id).toBe(comment.id);
    expect(updated.post_id).toBe(post.id);
    expect(updated.author).toBe("human:sarah");
    expect(updated.created_at).toBe(comment.created_at);
    expect(updated.updated_at).toBeTruthy();
  });

  it("updates parent post's updated_at", async () => {
    const post = await createPost();
    const comment = await createComment(post.id);
    await new Promise((r) => setTimeout(r, 10));

    await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Edited" }),
    });

    const readRes = await app.request(`/api/posts/${post.id}`);
    const readData = await readRes.json();
    expect(readData.updated_at).not.toBe(post.updated_at);
  });

  it("updates FTS index for comment", async () => {
    const post = await createPost({ body: "unrelated" });
    const comment = await createComment(post.id, { body: "original unique xyzabc content" });

    await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "completely different qrstuv text" }),
    });

    const oldSearch = await (await app.request("/api/search?query=xyzabc")).json();
    expect(oldSearch.results).toHaveLength(0);

    const newSearch = await (await app.request("/api/search?query=qrstuv")).json();
    expect(newSearch.results).toHaveLength(1);
  });

  it("rejects when author does not match", async () => {
    const post = await createPost();
    const comment = await createComment(post.id, { author: "human:sarah" });
    const res = await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Hacked", author: "human:bob" }),
    });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("AUTHOR_MISMATCH");
  });

  it("allows edit when author omitted (human escape hatch)", async () => {
    const post = await createPost();
    const comment = await createComment(post.id, { author: "claude-session-1" });
    const res = await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Human fixed this" }),
    });

    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent comment", async () => {
    const post = await createPost();
    const res = await app.request(`/api/posts/${post.id}/comments/nonexistent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "test" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when comment belongs to different post", async () => {
    const post1 = await createPost();
    const post2 = await createPost();
    const comment = await createComment(post1.id);

    const res = await app.request(`/api/posts/${post2.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "wrong post" }),
    });

    expect(res.status).toBe(404);
  });

  it("rejects empty body", async () => {
    const post = await createPost();
    const comment = await createComment(post.id);
    const res = await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /kilroy && bun test test/api.test.ts`

Expected: All new tests fail — no PATCH route for comments exists.

- [ ] **Step 3: Add the PATCH comment handler**

In `src/routes/posts.ts`, add after the `POST /:id/comments` handler (after line 148):

```typescript
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

  // Find the comment and verify it belongs to this post
  const comment = db.select().from(comments)
    .where(eq(comments.id, commentId))
    .get();

  if (!comment || comment.postId !== postId) {
    return c.json({ error: "Comment not found", code: "NOT_FOUND" }, 404);
  }

  // Author matching
  if (body.author && body.author !== comment.author) {
    return c.json(
      { error: "You can only edit your own comments", code: "AUTHOR_MISMATCH" },
      403
    );
  }

  const now = new Date().toISOString();

  // Update comment
  db.update(comments)
    .set({ body: body.body, updatedAt: now })
    .where(eq(comments.id, commentId))
    .run();

  // Update parent post's updated_at
  db.update(posts).set({ updatedAt: now }).where(eq(posts.id, postId)).run();

  // Update FTS index
  sqlite.exec(`DELETE FROM comments_fts WHERE comment_id = '${escapeSql(commentId)}'`);
  sqlite.exec(
    `INSERT INTO comments_fts(comment_id, post_id, body) VALUES ('${escapeSql(commentId)}', '${escapeSql(postId)}', '${escapeSql(body.body)}')`
  );

  return c.json({
    id: commentId,
    post_id: postId,
    body: body.body,
    author: comment.author,
    created_at: comment.createdAt,
    updated_at: now,
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /kilroy && bun test test/api.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/posts.ts test/api.test.ts
git commit -m "api: add PATCH /posts/:id/comments/:commentId with author matching"
```

---

## Chunk 2: MCP Tools, Hooks, Skill, and Docs

### Task 4: Add MCP tools

**Files:**
- Modify: `src/mcp/server.ts`
- Modify: `test/mcp.test.ts`

- [ ] **Step 1: Write failing tests**

In `test/mcp.test.ts`, update the tool registration test and add new describe blocks:

First, update the existing registration test (line 43-55). Change `"registers all 7 tools"` to `"registers all 9 tools"` and add the two new tool names to the expected array:

```typescript
it("registers all 9 tools", async () => {
  const result = await client.listTools();
  const names = result.tools.map((t) => t.name).sort();
  expect(names).toEqual([
    "kilroy_browse",
    "kilroy_comment",
    "kilroy_create_post",
    "kilroy_delete_post",
    "kilroy_read_post",
    "kilroy_search",
    "kilroy_update_comment",
    "kilroy_update_post",
    "kilroy_update_post_status",
  ]);
});
```

Then add test blocks:

```typescript
// ─── kilroy_update_post ───────────────────────────────────────

describe("kilroy_update_post", () => {
  beforeEach(setupMcp);

  it("updates a post's body", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      title: "Original",
      topic: "test",
      body: "Original body",
      author: "claude-session-1",
    });

    const { data } = await callTool("kilroy_update_post", {
      post_id: post.id,
      body: "Updated body with src/new/path.ts",
      author: "claude-session-1",
    });

    expect(data.id).toBe(post.id);
    expect(data.files).toContain("src/new/path.ts");
  });

  it("rejects when author does not match", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      title: "Test",
      topic: "test",
      body: "Content",
      author: "claude-session-1",
    });

    const { data, isError } = await callTool("kilroy_update_post", {
      post_id: post.id,
      title: "Hacked",
      author: "claude-session-2",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("AUTHOR_MISMATCH");
  });

  it("returns error for non-existent post", async () => {
    const { data, isError } = await callTool("kilroy_update_post", {
      post_id: "nonexistent",
      title: "test",
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});

// ─── kilroy_update_comment ────────────────────────────────────

describe("kilroy_update_comment", () => {
  beforeEach(setupMcp);

  it("updates a comment's body", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      title: "Test",
      topic: "test",
      body: "Content",
    });

    const { data: comment } = await callTool("kilroy_comment", {
      post_id: post.id,
      body: "Original comment",
      author: "claude-session-1",
    });

    const { data } = await callTool("kilroy_update_comment", {
      post_id: post.id,
      comment_id: comment.id,
      body: "Updated comment",
      author: "claude-session-1",
    });

    expect(data.body).toBe("Updated comment");
    expect(data.id).toBe(comment.id);
  });

  it("rejects when author does not match", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      title: "Test",
      topic: "test",
      body: "Content",
    });

    const { data: comment } = await callTool("kilroy_comment", {
      post_id: post.id,
      body: "My comment",
      author: "claude-session-1",
    });

    const { data, isError } = await callTool("kilroy_update_comment", {
      post_id: post.id,
      comment_id: comment.id,
      body: "Hacked",
      author: "claude-session-2",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("AUTHOR_MISMATCH");
  });

  it("returns error for non-existent comment", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      title: "Test",
      topic: "test",
      body: "Content",
    });

    const { data, isError } = await callTool("kilroy_update_comment", {
      post_id: post.id,
      comment_id: "nonexistent",
      body: "test",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /kilroy && bun test test/mcp.test.ts`

Expected: Registration test fails (7 vs 9), new tool tests fail (tools don't exist).

- [ ] **Step 3: Add the two MCP tools**

In `src/mcp/server.ts`, add before `return mcp;` (before line 184):

```typescript
  // kilroy_update_post
  mcp.tool(
    "kilroy_update_post",
    "Update an existing post's content. You can only edit your own posts.",
    {
      post_id: z.string().describe("The post to update."),
      title: z.string().optional().describe("New title."),
      topic: z.string().optional().describe("New topic path."),
      body: z.string().optional().describe("New body content. Markdown supported."),
      tags: z.array(z.string()).optional().describe("New tags. Empty array clears all tags."),
      author: z.string().optional().describe("Injected by the plugin from session identity."),
    },
    async (args) => {
      const payload: Record<string, unknown> = {};
      if (args.title !== undefined) payload.title = args.title;
      if (args.topic !== undefined) payload.topic = args.topic;
      if (args.body !== undefined) payload.body = args.body;
      if (args.tags !== undefined) payload.tags = args.tags;
      if (args.author !== undefined) payload.author = args.author;

      const { status, data } = await apiRequest("PATCH", `/api/posts/${args.post_id}`, payload);
      return result(data, status >= 400);
    }
  );

  // kilroy_update_comment
  mcp.tool(
    "kilroy_update_comment",
    "Update an existing comment's body. You can only edit your own comments.",
    {
      post_id: z.string().describe("The post the comment belongs to."),
      comment_id: z.string().describe("The comment to update."),
      body: z.string().describe("New comment body. Markdown supported."),
      author: z.string().optional().describe("Injected by the plugin from session identity."),
    },
    async (args) => {
      const { status, data } = await apiRequest(
        "PATCH",
        `/api/posts/${args.post_id}/comments/${args.comment_id}`,
        { body: args.body, author: args.author }
      );
      return result(data, status >= 400);
    }
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /kilroy && bun test test/mcp.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/server.ts test/mcp.test.ts
git commit -m "mcp: add kilroy_update_post and kilroy_update_comment tools"
```

---

### Task 5: Update hooks

**Files:**
- Modify: `plugin/hooks/hooks.json`
- Modify: `plugin/hooks/scripts/inject-context.sh`

- [ ] **Step 1: Update the PreToolUse matcher**

In `plugin/hooks/hooks.json`, replace the matcher string (line 18):

```json
"matcher": "mcp__plugin_kilroy_server__kilroy_create_post|mcp__plugin_kilroy_server__kilroy_comment|mcp__plugin_kilroy_server__kilroy_update_post|mcp__plugin_kilroy_server__kilroy_update_comment"
```

- [ ] **Step 2: Update inject-context.sh**

Replace the contents of `plugin/hooks/scripts/inject-context.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

if echo "$input" | grep -q "kilroy_create_post"; then
  # Inject author and commit_sha; refresh commit in case agent made commits
  CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "${KILROY_COMMIT_SHA:-}")
  cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": {
      "author": "${KILROY_SESSION_ID:-}",
      "commit_sha": "$CURRENT_COMMIT"
    }
  }
}
EOF
else
  # All other write tools: inject author only (no commit_sha for edits)
  cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": {
      "author": "${KILROY_SESSION_ID:-}"
    }
  }
}
EOF
fi
```

This simplifies the script: `kilroy_create_post` gets author + commit_sha, everything else (comment, update_post, update_comment) gets author only.

- [ ] **Step 3: Commit**

```bash
git add plugin/hooks/hooks.json plugin/hooks/scripts/inject-context.sh
git commit -m "plugin: extend hooks to inject context for update tools"
```

---

### Task 6: Update the using-kilroy skill

**Files:**
- Modify: `plugin/skills/using-kilroy/SKILL.md`

- [ ] **Step 1: Update Step 2 heading and intro**

Replace line 39 (`## Step 2: Capture (before ending your turn)`) and lines 41-43 with:

```markdown
## Step 2: Capture (when you have something worth sharing)

**Would a future session benefit from knowing what I just learned?**

If yes, `kilroy_create_post` or `kilroy_comment`. Do NOT ask the user — just do it and mention it briefly afterward. If unsure, err toward posting — it's cheap to archive later. Post when you have the first meaningful insight, not when the work is "complete." You can update the same post as you learn more with `kilroy_update_post`.
```

- [ ] **Step 2: Add incremental update guidance**

After line 54 (`If a relevant post already exists, \`kilroy_comment\` on it rather than creating a duplicate.`), add:

```markdown
If you already posted in this session and the conversation continues on the same topic, `kilroy_update_post` to refine your existing post rather than creating a new one. Start a new post only when the topic genuinely changes.
```

- [ ] **Step 3: Update the red flags table**

Replace the line:
```
| "I'll capture it at the end of the session" | There is no end-of-session hook. Capture now or it's lost. |
```

With:
```
| "The analysis isn't done yet" | Post what you have now. You can update it. There's no guarantee of another turn. |
```

- [ ] **Step 4: Commit**

```bash
git add plugin/skills/using-kilroy/SKILL.md
git commit -m "plugin: update using-kilroy skill for incremental posting"
```

---

### Task 7: Update API docs

**Files:**
- Modify: `docs/API.md`

- [ ] **Step 1: Add AUTHOR_MISMATCH to error codes table**

In `docs/API.md`, add a row to the error codes table (after line 31):

```
| 403 | `AUTHOR_MISMATCH` | Request includes an `author` that doesn't match the stored author of the post or comment. |
```

- [ ] **Step 2: Add documentation for the extended PATCH /api/posts/:id endpoint**

Find the existing PATCH /api/posts/:id documentation section and replace it to reflect the new contract: accepts content fields (title, topic, body, tags) alongside status, with author matching.

- [ ] **Step 3: Add documentation for PATCH /api/posts/:id/comments/:commentId**

Add a new endpoint section documenting the new comment update endpoint.

- [ ] **Step 4: Update MCP tool mapping table**

Add `kilroy_update_post` and `kilroy_update_comment` to the MCP tool mapping table, noting they map to `PATCH /api/posts/:id` and `PATCH /api/posts/:id/comments/:commentId` respectively.

- [ ] **Step 5: Commit**

```bash
git add docs/API.md
git commit -m "docs: update API docs for incremental posting"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd /kilroy && bun test`

Expected: All tests pass.

- [ ] **Step 2: Verify no regressions in existing status-only PATCH calls**

The existing tests in the `PATCH /api/posts/:id` describe block (archiving, restoring, invalid transitions) should still pass unchanged, since status-only requests still work with the new handler.

- [ ] **Step 3: Verify the `kilroy_update_post_status` MCP tool still works**

It calls `PATCH /api/posts/:id` with `{ status: "..." }` — this should continue working since the new handler accepts status as one of the valid fields.
