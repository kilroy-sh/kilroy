# `kilroy_edit_post` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single find/replace edit tool for posts so agents can make targeted body changes without re-sending the entire body. Mirrors the shape of Claude Code's `Edit` tool.

**Architecture:** A new HTTP endpoint `POST /api/posts/:id/edit` accepts `{old_string, new_string, replace_all?}` and applies the replacement to the post body server-side (validating uniqueness). A new MCP tool `kilroy_edit_post` wraps it. `kilroy_update_post` stays as-is for full rewrites; its description is tweaked to steer agents toward `kilroy_edit_post` for targeted changes. PATCH `/api/posts/:id` is untouched — it remains the full-replace contract.

**Tech Stack:** Bun, Hono, Drizzle ORM, Zod (already in use), `@modelcontextprotocol/sdk` (already in use).

**Locked design decisions:**
- Mirror Claude Code's `Edit` tool surface exactly: one edit per call, `old_string` / `new_string` / `replace_all` (default false). No array, no batch — posts are small and edits per turn are typically one.
- Separate HTTP endpoint (`POST /:id/edit`) rather than overloading PATCH. PATCH = full replace; edit = patch. Mixing them muddles the contract and the response shape.
- `replace_all: false` (default) requires the `old_string` to appear **exactly once** in the body. Zero matches → 422 `NOT_FOUND_IN_BODY`. Multiple matches → 422 `AMBIGUOUS_MATCH`. Either error leaves the body unchanged.
- `replace_all: true` replaces every occurrence; zero matches still errors (`NOT_FOUND_IN_BODY`) so the tool never silently no-ops.
- Reuse the existing author-match check from PATCH `/posts/:id`. No new ACL.
- Empty `new_string` is allowed (deletion is a legitimate edit).
- Empty `old_string` is rejected (would match infinitely / be ambiguous).
- Resulting body must be non-empty (mirrors PATCH validation — posts can't have empty bodies).
- Response shape is the full updated post — same as PATCH `/posts/:id`, so the MCP `enrichPost` helper Just Works.

**File structure:**

| File | Responsibility | Status |
|---|---|---|
| `src/routes/posts.ts` | Add `POST /:id/edit` route handler | Modify |
| `src/mcp/server.ts` | Register `kilroy_edit_post`; tweak `kilroy_update_post` description | Modify |
| `test/api.test.ts` | HTTP-level tests for `POST /api/posts/:id/edit` | Modify |
| `test/mcp.test.ts` | MCP-tool-level tests for `kilroy_edit_post`; bump expected tool count to 12 | Modify |

---

### Task 1: HTTP endpoint `POST /api/posts/:id/edit`

**Files:**
- Modify: `src/routes/posts.ts` (add handler after the existing PATCH `/:id` handler around line 290)
- Modify: `test/api.test.ts` (add test block before the share-endpoint tests; mirrors the existing `describe("PATCH /api/posts/:id (content editing)")` pattern at line 338)

- [ ] **Step 1: Write the failing tests**

Append the following block to `test/api.test.ts`, immediately after the existing `describe("PATCH /api/posts/:id (author matching)")` block (around line 482):

```ts
// ─── POST /api/posts/:id/edit (find/replace patch) ──────────────

describe("POST /api/posts/:id/edit", () => {
  beforeEach(setup);

  it("applies a single find/replace and returns the updated post", async () => {
    const post = await createPost({ body: "The quick brown fox jumps over the lazy dog." });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "brown fox", new_string: "red panda" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.id).toBe(post.id);
    expect(updated.body).toBe("The quick red panda jumps over the lazy dog.");
  });

  it("updates updated_at when body changes", async () => {
    const post = await createPost({ body: "before edit" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "before", new_string: "after" }),
    });

    const updated = await res.json();
    expect(updated.updated_at).not.toBe(post.created_at);
  });

  it("updates the FTS index when body changes", async () => {
    const post = await createPost({ body: "marker-alpha is in this post" });

    await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "marker-alpha", new_string: "marker-omega" }),
    });

    const oldSearch = await (await app.request("/api/search?query=marker-alpha")).json();
    expect(oldSearch.results).toHaveLength(0);

    const newSearch = await (await app.request("/api/search?query=marker-omega")).json();
    expect(newSearch.results).toHaveLength(1);
  });

  it("returns 422 NOT_FOUND_IN_BODY when old_string does not appear", async () => {
    const post = await createPost({ body: "hello world" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "goodbye", new_string: "hi" }),
    });

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("NOT_FOUND_IN_BODY");
  });

  it("returns 422 AMBIGUOUS_MATCH when old_string appears more than once (default)", async () => {
    const post = await createPost({ body: "foo bar foo baz foo" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "foo", new_string: "qux" }),
    });

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("AMBIGUOUS_MATCH");

    // Body must be unchanged
    const reread = await (await app.request(`/api/posts/${post.id}`)).json();
    expect(reread.body).toBe("foo bar foo baz foo");
  });

  it("replaces all occurrences when replace_all is true", async () => {
    const post = await createPost({ body: "foo bar foo baz foo" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "foo", new_string: "qux", replace_all: true }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("qux bar qux baz qux");
  });

  it("returns 422 NOT_FOUND_IN_BODY when replace_all matches zero", async () => {
    const post = await createPost({ body: "hello world" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "goodbye", new_string: "hi", replace_all: true }),
    });

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("NOT_FOUND_IN_BODY");
  });

  it("allows empty new_string (deletion)", async () => {
    const post = await createPost({ body: "keep this DELETEME and this too" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: " DELETEME", new_string: "" }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("keep this and this too");
  });

  it("rejects empty old_string", async () => {
    const post = await createPost();

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "", new_string: "x" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("rejects missing old_string", async () => {
    const post = await createPost();

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_string: "x" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("rejects missing new_string", async () => {
    const post = await createPost();

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "x" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("rejects edit that would empty the body", async () => {
    const post = await createPost({ body: "onlytext" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "onlytext", new_string: "" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_INPUT");
  });

  it("returns 404 for non-existent post", async () => {
    const res = await app.request(`/api/posts/does-not-exist/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "a", new_string: "b" }),
    });

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("returns full post shape in response (matches PATCH shape)", async () => {
    const post = await createPost({ body: "hello world" });

    const res = await app.request(`/api/posts/${post.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_string: "world", new_string: "kilroy" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.id).toBeTruthy();
    expect(updated.title).toBeTruthy();
    expect(updated.tags).toBeDefined();
    expect(updated.author).toBeDefined();
    expect(updated.author.account_id).toBe(testAccountId);
    expect(updated.created_at).toBeTruthy();
    expect(updated.updated_at).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun test test/api.test.ts -t "POST /api/posts/:id/edit"
```
Expected: All new tests FAIL with 404 (route not yet mounted).

- [ ] **Step 3: Implement the route handler**

In `src/routes/posts.ts`, insert the following handler immediately after the existing `postsRouter.patch("/:id", ...)` handler (after line 290, before the `POST /:id/share` handler at line 293):

```ts
// POST /posts/:id/edit — Apply a single find/replace to a post body.
// Sibling to PATCH /:id (which is full-replace). Mirrors the shape of
// the Edit code tool: old_string must occur exactly once unless
// replace_all is true; either way zero matches errors so the call is
// never a silent no-op.
postsRouter.post("/:id/edit", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const oldString = body.old_string;
  const newString = body.new_string;
  const replaceAll = body.replace_all === true;

  if (typeof oldString !== "string" || oldString.length === 0) {
    return c.json(
      { error: "Field 'old_string' must be a non-empty string", code: "INVALID_INPUT" },
      400,
    );
  }
  if (typeof newString !== "string") {
    return c.json(
      { error: "Field 'new_string' must be a string", code: "INVALID_INPUT" },
      400,
    );
  }

  const projectId = c.get("projectId");
  const memberAccountId = c.get("memberAccountId");
  const baseUrl = getBaseUrl(c.req.url);

  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.projectId, projectId)));
  if (!post) {
    return c.json({ error: "Post not found", code: "NOT_FOUND" }, 404);
  }

  if (post.authorAccountId && post.authorAccountId !== memberAccountId) {
    return c.json(
      { error: "You can only edit your own posts", code: "AUTHOR_MISMATCH" },
      403,
    );
  }

  // Count occurrences of oldString in the current body. split-length-minus-1
  // is the simplest way to count non-overlapping literal occurrences without
  // regex escaping.
  const matchCount = post.body.split(oldString).length - 1;

  if (matchCount === 0) {
    return c.json(
      { error: `old_string not found in post body`, code: "NOT_FOUND_IN_BODY" },
      422,
    );
  }
  if (matchCount > 1 && !replaceAll) {
    return c.json(
      {
        error: `old_string appears ${matchCount} times; use replace_all to replace all occurrences or provide more context to make it unique`,
        code: "AMBIGUOUS_MATCH",
      },
      422,
    );
  }

  // Apply replacement. split+join handles both the single-match and the
  // replace_all cases with one expression — and the matchCount checks above
  // guarantee we're never silently doing nothing.
  const nextBody = post.body.split(oldString).join(newString);

  if (nextBody.length === 0) {
    return c.json(
      { error: "Edit would empty the post body", code: "INVALID_INPUT" },
      400,
    );
  }

  await db
    .update(posts)
    .set({ body: nextBody, updatedAt: new Date() })
    .where(eq(posts.id, postId));

  const [updated] = await db.select().from(posts).where(eq(posts.id, postId));
  const display = await getAccountDisplay(updated.authorAccountId);
  return c.json(formatPost(updated, display, baseUrl));
});
```

- [ ] **Step 4: Run tests to verify they pass**

```
bun test test/api.test.ts -t "POST /api/posts/:id/edit"
```
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the full api test file to confirm no regressions**

```
bun test test/api.test.ts
```
Expected: all tests pass (existing PATCH tests untouched).

- [ ] **Step 6: Commit**

```bash
git add src/routes/posts.ts test/api.test.ts
git commit -m "feat(posts): POST /api/posts/:id/edit — single find/replace patch"
```

---

### Task 2: MCP tool `kilroy_edit_post` + steer description on `kilroy_update_post`

**Files:**
- Modify: `src/mcp/server.ts` (register new tool after the existing `kilroy_update_post` block at line 331; tweak the existing tool's description)
- Modify: `test/mcp.test.ts` (bump expected tool count from 11 to 12; add `"kilroy_edit_post"` to the expected names list at line 38; add `describe("kilroy_edit_post")` block)

- [ ] **Step 1: Write the failing tests**

In `test/mcp.test.ts`, update the registration test at line 35 to expect 12 tools and include the new name. Replace the existing `it("registers all 11 tools", ...)` block (lines 35–51) with:

```ts
  it("registers all 12 tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "kilroy_comment",
      "kilroy_create_post",
      "kilroy_create_project",
      "kilroy_delete_post",
      "kilroy_edit_post",
      "kilroy_get_upload_file_command",
      "kilroy_list_projects",
      "kilroy_read_post",
      "kilroy_search",
      "kilroy_tags",
      "kilroy_update_comment",
      "kilroy_update_post",
    ]);
  });
```

Then append the following block at the end of `test/mcp.test.ts`:

```ts
// ─── kilroy_edit_post ─────────────────────────────────────────

describe("kilroy_edit_post", () => {
  beforeEach(setupMcp);

  it("applies a find/replace and returns the updated post", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Edit me",
      body: "The quick brown fox jumps.",
      tags: ["test"],
    });

    const { data, isError } = await callTool("kilroy_edit_post", {
      project: TEST_PROJECT,
      post_id: post.id,
      old_string: "brown fox",
      new_string: "red panda",
    });

    expect(isError).toBeFalsy();
    expect(data.id).toBe(post.id);
    expect(data.body).toBe("The quick red panda jumps.");
    expect(data.url).toContain(`/post/${post.id}`);
  });

  it("returns error when old_string is not found", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Edit me",
      body: "hello world",
      tags: ["test"],
    });

    const { data, isError } = await callTool("kilroy_edit_post", {
      project: TEST_PROJECT,
      post_id: post.id,
      old_string: "goodbye",
      new_string: "hi",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND_IN_BODY");
  });

  it("returns error when old_string is ambiguous and replace_all is false", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Edit me",
      body: "foo bar foo baz foo",
      tags: ["test"],
    });

    const { data, isError } = await callTool("kilroy_edit_post", {
      project: TEST_PROJECT,
      post_id: post.id,
      old_string: "foo",
      new_string: "qux",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("AMBIGUOUS_MATCH");
  });

  it("replaces all when replace_all is true", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Edit me",
      body: "foo bar foo baz foo",
      tags: ["test"],
    });

    const { data, isError } = await callTool("kilroy_edit_post", {
      project: TEST_PROJECT,
      post_id: post.id,
      old_string: "foo",
      new_string: "qux",
      replace_all: true,
    });

    expect(isError).toBeFalsy();
    expect(data.body).toBe("qux bar qux baz qux");
  });

  it("returns error for non-existent post", async () => {
    const { data, isError } = await callTool("kilroy_edit_post", {
      project: TEST_PROJECT,
      post_id: "nonexistent",
      old_string: "a",
      new_string: "b",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun test test/mcp.test.ts -t "kilroy_edit_post"
bun test test/mcp.test.ts -t "registers all 12 tools"
```
Expected: All new tests FAIL — the registration test fails on the missing name; the `kilroy_edit_post` tests fail on `Error: Tool kilroy_edit_post not found` (or similar).

- [ ] **Step 3: Register the new MCP tool**

In `src/mcp/server.ts`, insert the following block immediately after the existing `kilroy_update_post` registration (after the closing `);` around line 358, before `mcp.registerTool("kilroy_update_comment", ...)` at line 360):

```ts
  mcp.registerTool(
    "kilroy_edit_post",
    {
      description:
        "Apply a single find/replace edit to a post's body. Prefer this over `kilroy_update_post` for targeted changes — much cheaper than re-sending the full body. `old_string` must appear exactly once in the body unless `replace_all` is true (set `replace_all: true` to replace every occurrence). If `old_string` is not unique, include surrounding context to disambiguate. To delete, pass an empty `new_string`. You can only edit your own posts.",
      inputSchema: {
        project: projectParam,
        post_id: z.string().describe("The post to edit."),
        old_string: z.string().min(1).describe("Exact substring to find in the body. Must be non-empty."),
        new_string: z.string().describe("Replacement text. Can be empty to delete."),
        replace_all: z.boolean().optional().describe("Replace every occurrence (default false)."),
      },
    },
    async (args) => {
      try {
        return await withProject(args.project, async (app, projectUrl) => {
          const { status, data } = await app("POST", `/api/posts/${args.post_id}/edit`, {
            old_string: args.old_string,
            new_string: args.new_string,
            replace_all: args.replace_all,
          });
          return result(enrichPost(data, projectUrl), status >= 400);
        });
      } catch (err: any) {
        return result({ error: err.message }, true);
      }
    },
  );
```

- [ ] **Step 4: Tweak the `kilroy_update_post` description to steer toward `kilroy_edit_post`**

In `src/mcp/server.ts`, change the existing `kilroy_update_post` description at line 334 from:

```ts
      description: "Update an existing post's content. You can only edit your own posts.",
```

to:

```ts
      description:
        "Replace the full content of an existing post (title, body, and/or tags). For targeted changes to the body, prefer `kilroy_edit_post` — it's much cheaper than re-sending the whole body. Use this tool when restructuring the post or rewriting it from scratch. You can only edit your own posts.",
```

- [ ] **Step 5: Run tests to verify they pass**

```
bun test test/mcp.test.ts
```
Expected: all tests pass, including the 5 new `kilroy_edit_post` tests and the updated `registers all 12 tools` test.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```
bun test
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/server.ts test/mcp.test.ts
git commit -m "feat(mcp): kilroy_edit_post — single find/replace edit for posts"
```

---

## Out of scope (explicitly deferred)

- **Multi-edit (`kilroy_multi_edit_post`).** Not shipping until we see agents actually batching edits. Single-edit is the canonical idiom and posts are small.
- **`kilroy_edit_comment`.** Comments are usually one paragraph; the value of a patch tool there is much lower. `kilroy_update_comment` stays as-is.
- **Title / tags via the edit tool.** Edits target the body only. Title and tags continue to flow through `kilroy_update_post` (full replace) — short fields where re-sending costs nothing.
- **Web UI client wiring.** The web editor already does full-body PATCH on save; no reason to switch. This plan ships the agent-facing capability only.
