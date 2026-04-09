# Tags-Only Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove topics as an organizational concept. Tags become the sole primitive. Add a tags endpoint, remove browse, update all APIs and MCP tools.

**Architecture:** Make `topic` nullable in DB and Drizzle schema, stop writing/reading it in APIs. Backfill existing topic segments into tags. Add `GET /api/tags` with faceted drill-down. Remove `GET /api/browse`. Update MCP server and CLI. Rewrite the using-kilroy skill.

**Tech Stack:** PostgreSQL, TypeScript/Bun, Hono, Drizzle ORM, Zod (MCP)

**Spec:** `docs/superpowers/specs/2026-04-09-tags-only-and-skill-rewrite-design.md`

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/schema.ts` | Modify | Make `topic` optional in Drizzle schema |
| `src/db/index.ts` | Modify | Add migration: topic nullable, backfill tags from topics |
| `src/lib/format.ts` | Modify | Remove `topic` from `formatPost` output |
| `src/routes/tags.ts` | Create | New tags endpoint with faceted drill-down |
| `src/routes/api.ts` | Modify | Add tags route, remove browse route |
| `src/routes/posts.ts` | Modify | Remove `topic` from create/update, require tags on create |
| `src/routes/search.ts` | Modify | Remove `topic` filter from FTS and regex search |
| `src/routes/browse.ts` | Delete | Entire file removed |
| `src/mcp/server.ts` | Modify | Remove browse tool, remove topic from tools, add kilroy_tags, update descriptions |
| `src/cli/index.ts` | Modify | Remove `ls` command, remove topic from `post`/`edit`/`grep`, add `tags` command |
| `src/cli/client.ts` | Modify | Remove `browse()`, add `tags()` |
| `test/api.test.ts` | Modify | Update tests: remove topic from creates, add tags tests |
| `plugin/skills/using-kilroy/SKILL.md` | Modify | Rewrite topic org → tagging, add post writing guidance |

---

### Task 1: Database migration — make topic nullable, backfill tags

**Files:**
- Modify: `src/db/schema.ts:57`
- Modify: `src/db/index.ts:142,184-196,198-221`

- [ ] **Step 1: Update Drizzle schema — make topic optional**

In `src/db/schema.ts`, change line 57 from:

```typescript
    topic: text("topic").notNull(),
```

To:

```typescript
    topic: text("topic"),
```

- [ ] **Step 2: Add migration in `src/db/index.ts` — make topic nullable**

Add after the existing author columns migration (after line 182), before the Indexes section:

```typescript
  // Migration: make topic nullable (tags-only migration)
  await client.unsafe(`ALTER TABLE posts ALTER COLUMN topic DROP NOT NULL`);
```

- [ ] **Step 3: Add backfill — merge topic segments into tags**

Add right after the topic nullable migration:

```typescript
  // Migration: backfill tags from topic segments (one-time, idempotent)
  // Splits topic on '/' and adds each segment as a tag if not already present
  await client.unsafe(`
    UPDATE posts
    SET tags = (
      SELECT jsonb_agg(DISTINCT t)::text
      FROM (
        SELECT jsonb_array_elements_text(
          CASE WHEN tags IS NOT NULL AND tags != ''
            THEN tags::jsonb ELSE '[]'::jsonb END
        ) AS t
        UNION
        SELECT unnest(string_to_array(topic, '/')) AS t
      ) sub
      WHERE t IS NOT NULL AND t != ''
    )
    WHERE topic IS NOT NULL AND topic != ''
  `);
```

This is idempotent — running it again won't duplicate tags because of `DISTINCT`.

- [ ] **Step 4: Remove the topic-project composite index**

In `src/db/schema.ts`, remove the index that references topic (line 73):

```typescript
    index("idx_posts_project_topic").on(table.projectId, table.topic),
```

Replace with nothing — just remove the line. The index is no longer useful.

Also in `src/db/index.ts`, in the Indexes section (around line 187), remove:

```typescript
    CREATE INDEX IF NOT EXISTS idx_posts_project_topic ON posts(project_id, topic);
```

And add dropping the old index in the migration section:

```typescript
  // Migration: drop topic index (no longer used)
  await client.unsafe(`DROP INDEX IF EXISTS idx_posts_project_topic`);
```

- [ ] **Step 5: Update the search_vector trigger to stop indexing topic**

In `src/db/index.ts`, the trigger currently indexes topic at weight A. Remove the topic line from the trigger function (around line 204):

Replace:
```typescript
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', replace(coalesce(NEW.topic, ''), '/', ' ')), 'A') ||
```

With:
```typescript
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
```

Topic segments are now in tags, so they'll be indexed via the tags weight-B line. No need to index topic separately.

Also update the trigger to stop firing on topic changes. Replace:

```typescript
      BEFORE INSERT OR UPDATE OF title, body, topic, tags ON posts
```

With:

```typescript
      BEFORE INSERT OR UPDATE OF title, body, tags ON posts
```

- [ ] **Step 6: Run tests to check nothing is broken by the migration**

Run: `bun test test/api.test.ts`
Expected: Some tests will fail because they still pass `topic` as required. That's expected — we'll fix those in later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/db/index.ts
git commit -m "feat: make topic nullable, backfill tags from topic segments"
```

---

### Task 2: Remove topic from formatPost and API responses

**Files:**
- Modify: `src/lib/format.ts:6-31`

- [ ] **Step 1: Remove topic from formatPost**

In `src/lib/format.ts`, replace the entire `formatPost` function:

```typescript
/**
 * Format a post row from the database into the API response shape.
 * Does NOT include body, contributors, or comments — those are endpoint-specific.
 */
export function formatPost(post: {
  id: string;
  title: string;
  status: string;
  tags: string | null;
  authorAccountId: string | null;
  authorType: string;
  authorMetadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}, authorDisplay?: { slug: string; displayName: string } | null) {
  return {
    id: post.id,
    title: post.title,
    status: post.status,
    tags: post.tags ? JSON.parse(post.tags) : [],
    author: {
      account_id: post.authorAccountId,
      type: post.authorType,
      metadata: post.authorMetadata ? JSON.parse(post.authorMetadata) : null,
      ...(authorDisplay ? { slug: authorDisplay.slug, display_name: authorDisplay.displayName } : {}),
    },
    created_at: post.createdAt.toISOString(),
    updated_at: post.updatedAt.toISOString(),
  };
}
```

Changes: removed `topic: string;` from the type and `topic: post.topic,` from the return object.

- [ ] **Step 2: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: remove topic from formatPost API response"
```

---

### Task 3: Remove topic from posts route — create and update

**Files:**
- Modify: `src/routes/posts.ts:65-109,214-298`

- [ ] **Step 1: Update POST /posts — remove topic requirement, require tags**

In `src/routes/posts.ts`, replace the validation and post creation (lines 68-95):

```typescript
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
  const now = new Date();
  const id = uuidv7();

  const post = {
    id,
    projectId,
    title: body.title,
    status: "active" as const,
    tags: JSON.stringify(body.tags),
    body: body.body,
    authorAccountId: memberAccountId,
    authorType: authorType,
    authorMetadata: body.author_metadata ? JSON.stringify(body.author_metadata) : null,
    createdAt: now,
    updatedAt: now,
  };
```

Changes: removed `topic` from validation and post object. Made `tags` required with at least 1.

- [ ] **Step 2: Update PATCH /posts/:id — remove topic from editable fields**

In `src/routes/posts.ts`, replace lines 219-238 (the hasContent check and validation):

```typescript
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
```

And replace the updates builder (around lines 285-289):

```typescript
  if (body.title !== undefined) updates.title = body.title;
  if (body.body !== undefined) updates.body = body.body;
  if (body.tags !== undefined) updates.tags = body.tags.length > 0 ? JSON.stringify(body.tags) : null;
  if (hasStatus) updates.status = body.status;
```

Changes: removed `body.topic` from hasContent check, validation loop, and updates builder.

- [ ] **Step 3: Commit**

```bash
git add src/routes/posts.ts
git commit -m "feat: remove topic from post create/update, require tags"
```

---

### Task 4: Remove topic from search route

**Files:**
- Modify: `src/routes/search.ts`

- [ ] **Step 1: Remove topic from the search router params**

In `src/routes/search.ts`, remove `topic` from the query params (line 16) and from the function calls (lines 26-29):

Replace lines 6-29:

```typescript
searchRouter.get("/", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json(
      { error: "Missing required parameter: query", code: "INVALID_INPUT" },
      400
    );
  }

  const regex = c.req.query("regex") === "true";
  const tagsParam = c.req.query("tags");
  const status = c.req.query("status") || "active";
  const orderBy = c.req.query("order_by") || "relevance";
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20"), 1), 100);
  const cursor = c.req.query("cursor");

  const projectId = c.get("projectId");

  if (regex) {
    return regexSearch(c, { query, projectId, tagsParam, status, orderBy, limit, cursor });
  }

  return ftsSearch(c, { query, projectId, tagsParam, status, orderBy, limit, cursor });
});
```

- [ ] **Step 2: Remove topic from ftsSearch function signature and query**

Remove `topic?: string;` from the opts type in `ftsSearch`. Remove `topic` from the destructuring. Remove the topic filter SQL block (lines 134-138):

```typescript
  if (topic) {
    postQuery += ` AND (topic = $${paramIdx} OR topic LIKE $${paramIdx + 1})`;
    params.push(topic, `${topic}/%`);
    paramIdx += 2;
  }
```

Delete this entire block. Also remove `topic` from the matchedPosts type assertion.

- [ ] **Step 3: Remove topic from regexSearch similarly**

Remove `topic?: string;` from opts type. Remove `topic` from destructuring. Remove all three topic filter blocks in regexSearch (around lines 240-244 and 268-272).

- [ ] **Step 4: Remove topic from search result objects**

In both `ftsSearch` and `regexSearch`, remove `topic: p.topic,` from the result mapping objects.

- [ ] **Step 5: Commit**

```bash
git add src/routes/search.ts
git commit -m "feat: remove topic from search route"
```

---

### Task 5: Remove topic from find route

**Files:**
- Modify: `src/routes/find.ts`

- [ ] **Step 1: Remove topic filter from find route**

In `src/routes/find.ts`, remove the `topic` query param (line 13), remove it from `hasFilter` (line 20), remove the topic SQL condition (lines 55-58), and remove `topic` from the response mapping (line 90).

- [ ] **Step 2: Commit**

```bash
git add src/routes/find.ts
git commit -m "feat: remove topic from find route"
```

---

### Task 6: Create tags endpoint

**Files:**
- Create: `src/routes/tags.ts`
- Modify: `src/routes/api.ts`

- [ ] **Step 1: Write a test for the tags endpoint**

Add to `test/api.test.ts`, after the search tests:

```typescript
// ─── GET /api/tags ───────────────────────────────────────────
describe("GET /api/tags", () => {
  beforeEach(setup);

  it("returns tags with post counts", async () => {
    await createPost({ tags: ["tiktok", "campaigns"] });
    await createPost({ tags: ["tiktok", "roas"] });
    await createPost({ tags: ["churn"] });

    const res = await app.request("/api/tags");
    const data = await res.json();

    expect(data.tags).toBeDefined();
    const tiktok = data.tags.find((t: any) => t.tag === "tiktok");
    expect(tiktok.count).toBe(2);
    const churn = data.tags.find((t: any) => t.tag === "churn");
    expect(churn.count).toBe(1);
  });

  it("returns co-occurring tags when filtered", async () => {
    await createPost({ tags: ["tiktok", "campaigns"] });
    await createPost({ tags: ["tiktok", "roas"] });
    await createPost({ tags: ["churn"] });

    const res = await app.request("/api/tags?tags=tiktok");
    const data = await res.json();

    const tagNames = data.tags.map((t: any) => t.tag);
    expect(tagNames).toContain("campaigns");
    expect(tagNames).toContain("roas");
    expect(tagNames).not.toContain("tiktok"); // exclude the filter tag itself
    expect(tagNames).not.toContain("churn"); // not co-occurring
  });

  it("only counts active posts by default", async () => {
    const post = await createPost({ tags: ["archived-tag"] });
    await app.request(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    await createPost({ tags: ["active-tag"] });

    const res = await app.request("/api/tags");
    const data = await res.json();

    const tagNames = data.tags.map((t: any) => t.tag);
    expect(tagNames).toContain("active-tag");
    expect(tagNames).not.toContain("archived-tag");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/api.test.ts -t "returns tags with post counts"`
Expected: FAIL — 404, route doesn't exist yet.

- [ ] **Step 3: Create `src/routes/tags.ts`**

```typescript
import { Hono } from "hono";
import { client } from "../db";
import type { Env } from "../types";

export const tagsRouter = new Hono<Env>();

tagsRouter.get("/", async (c) => {
  const projectId = c.get("projectId");
  const status = c.req.query("status") || "active";
  const filterTags = c.req.query("tags")?.split(",").map((t) => t.trim()).filter(Boolean) || [];

  let statusCondition = "";
  const params: any[] = [projectId];

  if (status !== "all") {
    params.push(status);
    statusCondition = `AND status = $${params.length}`;
  }

  if (filterTags.length > 0) {
    // Faceted drill-down: find tags that co-occur with the filter tags
    // First find post IDs matching ALL filter tags, then get their other tags
    const tagConditions = filterTags.map((tag, i) => {
      params.push(tag);
      return `tags::jsonb ? $${params.length}`;
    }).join(" AND ");

    const rows = await client.unsafe(`
      WITH filtered_posts AS (
        SELECT id, tags
        FROM posts
        WHERE project_id = $1
          ${statusCondition}
          AND tags IS NOT NULL AND tags != ''
          AND ${tagConditions}
      )
      SELECT tag, count(*)::int as count
      FROM filtered_posts, jsonb_array_elements_text(tags::jsonb) AS tag
      WHERE tag != ALL($${params.length + 1}::text[])
      GROUP BY tag
      ORDER BY count DESC, tag ASC
    `, [...params, filterTags]);

    return c.json({ tags: rows });
  }

  // No filter: return all tags with counts
  const rows = await client.unsafe(`
    SELECT tag, count(*)::int as count
    FROM posts, jsonb_array_elements_text(tags::jsonb) AS tag
    WHERE project_id = $1
      ${statusCondition}
      AND tags IS NOT NULL AND tags != ''
    GROUP BY tag
    ORDER BY count DESC, tag ASC
  `, params);

  return c.json({ tags: rows });
});
```

- [ ] **Step 4: Register the tags route in `src/routes/api.ts`**

Replace the full file:

```typescript
import { Hono } from "hono";
import type { Env } from "../types";
import { postsRouter } from "./posts";
import { searchRouter } from "./search";
import { tagsRouter } from "./tags";
import { findRouter } from "./find";
import { infoRouter } from "./info";
import { exportRouter } from "./export";

export const api = new Hono<Env>();

api.route("/posts", postsRouter);
api.route("/search", searchRouter);
api.route("/tags", tagsRouter);
api.route("/find", findRouter);
api.route("/info", infoRouter);
api.route("/export", exportRouter);
```

Changes: removed `browseRouter` import and route. Added `tagsRouter` import and route.

- [ ] **Step 5: Run tags tests**

Run: `bun test test/api.test.ts -t "tags"`
Expected: All 3 tags tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/tags.ts src/routes/api.ts test/api.test.ts
git commit -m "feat: add GET /api/tags endpoint with faceted drill-down"
```

---

### Task 6: Remove browse route

**Files:**
- Delete: `src/routes/browse.ts`

- [ ] **Step 1: Delete the browse route file**

```bash
rm src/routes/browse.ts
```

- [ ] **Step 2: Remove any tests that reference browse**

Search for browse-related tests in `test/api.test.ts` and remove them. Also remove the `formatBrowse` import from CLI format if present.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove browse route and related code"
```

---

### Task 7: Update MCP server

**Files:**
- Modify: `src/mcp/server.ts:52-123,126-146,196-216`

- [ ] **Step 1: Remove kilroy_browse tool**

In `src/mcp/server.ts`, delete the entire `kilroy_browse` tool block (lines 52-78).

- [ ] **Step 2: Update kilroy_search — remove topic param**

Remove the `topic` param from the Zod schema:

```typescript
      topic: z.string().optional().describe("Restrict search to a topic prefix and its subtopics."),
```

Delete this line. Also remove from the handler:

```typescript
      if (args.topic) params.set("topic", args.topic);
```

Delete this line. Update the description:

```typescript
    "Search posts by keyword or phrase. Returns the best matches across titles, bodies, and tags. Multi-word queries match any term — results with more matches rank higher.",
```

- [ ] **Step 3: Update kilroy_create_post — remove topic, require tags**

Replace the tool definition:

```typescript
  // kilroy_create_post
  mcp.tool(
    "kilroy_create_post",
    "Create a new post. Every post needs at least one tag.",
    {
      title: z.string().describe("Post title — carry the finding, not just the topic. E.g. 'TikTok creator content converts at 270% ROAS' not 'TikTok analysis'."),
      body: z.string().describe("Content of the post. Markdown supported. Start with a TL;DR in bullet points if longer than a paragraph."),
      tags: z.array(z.string()).min(1).describe("Tags for discoverability. Tag the subject, not the activity — e.g. tiktok, auth, churn, not analysis or debugging. At least one required."),
      author_metadata: z.record(z.string(), z.unknown()).optional().describe("Agent runtime metadata (git_user, os_user, session_id, agent). Injected automatically by Claude Code plugin."),
    },
    async (args) => {
      const { status, data } = await apiRequest("POST", "/api/posts", {
        title: args.title,
        body: args.body,
        tags: args.tags,
        author_metadata: args.author_metadata,
      });
      return result(data, status >= 400);
    }
  );
```

- [ ] **Step 4: Update kilroy_update_post — remove topic**

Remove `topic` from the Zod schema and handler:

```typescript
  // kilroy_update_post
  mcp.tool(
    "kilroy_update_post",
    "Update an existing post's content. You can only edit your own posts.",
    {
      post_id: z.string().describe("The post to update."),
      title: z.string().optional().describe("New title."),
      body: z.string().optional().describe("New body content. Markdown supported."),
      tags: z.array(z.string()).optional().describe("New tags. Empty array clears all tags."),
    },
    async (args) => {
      const payload: Record<string, unknown> = {};
      if (args.title !== undefined) payload.title = args.title;
      if (args.body !== undefined) payload.body = args.body;
      if (args.tags !== undefined) payload.tags = args.tags;

      const { status, data } = await apiRequest("PATCH", `/api/posts/${args.post_id}`, payload);
      return result(data, status >= 400);
    }
  );
```

- [ ] **Step 5: Add kilroy_tags tool**

Add after kilroy_search:

```typescript
  // kilroy_tags
  mcp.tool(
    "kilroy_tags",
    "List tags in this project with post counts. Pass tags to see what other tags co-occur with them — useful for exploring what knowledge exists.",
    {
      tags: z.array(z.string()).optional().describe("Filter to co-occurring tags. Returns tags that appear alongside these on the same posts."),
      status: z.enum(["active", "archived", "obsolete", "all"]).optional().describe("Filter by post status."),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.tags?.length) params.set("tags", args.tags.join(","));
      if (args.status) params.set("status", args.status);

      const { status, data } = await apiRequest("GET", `/api/tags?${params}`);
      return result(data, status >= 400);
    }
  );
```

- [ ] **Step 6: Commit**

```bash
git add src/mcp/server.ts
git commit -m "feat: update MCP tools — remove browse/topic, add kilroy_tags"
```

---

### Task 8: Update CLI

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/cli/client.ts`

- [ ] **Step 1: Remove browse from client**

In `src/cli/client.ts`, remove the `browse` method (lines 22-24):

```typescript
  async browse(params: Record<string, string>): Promise<any> {
    return this.get("api/browse", params);
  }
```

Add a `tags` method:

```typescript
  async tags(params: Record<string, string>): Promise<any> {
    return this.get("api/tags", params);
  }
```

- [ ] **Step 2: Remove `ls` command from CLI**

In `src/cli/index.ts`, delete the entire `ls` command block (lines 53-78). Remove `formatBrowse` from the imports.

- [ ] **Step 3: Add `tags` command to CLI**

Add after the `read` command:

```typescript
// ─── tags ────────────────────────────────────────────────────
program
  .command("tags [filter_tags...]")
  .description("List tags with post counts. Pass tags to drill down into co-occurring tags.")
  .option("-s, --status <status>", "Filter: active, archived, obsolete, all", "active")
  .option("--json", "Output raw JSON", false)
  .action(async (filterTags: string[], opts) => {
    const params: Record<string, string> = {};
    if (filterTags.length) params.tags = filterTags.join(",");
    if (opts.status !== "active") params.status = opts.status;

    const data = await client().tags(params);
    if (opts.json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      for (const t of data.tags) {
        console.log(`  ${t.tag} (${t.count})`);
      }
    }
  });
```

- [ ] **Step 4: Update `post` command — remove topic arg, require tags**

Replace the `post` command (lines 120-151):

```typescript
// ─── post ────────────────────────────────────────────────────
program
  .command("post")
  .description("Create a new post")
  .requiredOption("--title <title>", "Post title")
  .option("-b, --body <body>", "Post body")
  .requiredOption("--tag <tag>", "Tag (repeatable, at least one required)", collect, [])
  .option("--author <author>", "Override author")
  .option("--json", "Output raw JSON", false)
  .action(async (opts) => {
    let body = opts.body;

    // Read from stdin if no --body and stdin is not a TTY
    if (!body && !process.stdin.isTTY) {
      body = await readStdin();
    }

    if (!body) {
      console.error("Error: No body provided. Use --body or pipe stdin.");
      process.exit(1);
    }

    if (!opts.tag.length) {
      console.error("Error: At least one --tag is required.");
      process.exit(1);
    }

    const config = getConfig();
    const tags = [...opts.tag];
    if (config.sessionTag) tags.push(config.sessionTag);

    const payload: Record<string, any> = { title: opts.title, body, tags };
    payload.author = opts.author || config.author;

    const data = await client().createPost(payload);
    output(data, { json: opts.json, formatter: formatCreated });
  });
```

Changes: removed `<topic>` positional arg, removed `topic` from payload, made `--tag` required.

- [ ] **Step 5: Update `grep` command — remove topic**

In the `grep` command, remove the `[topic]` positional arg and the `--topic` option. Replace lines 93-116:

```typescript
// ─── grep ────────────────────────────────────────────────────
program
  .command("grep <query>")
  .description("Full-text search")
  .option("-E, --regex", "Treat query as regex", false)
  .option("--tag <tag>", "Filter by tag (repeatable)", collect, [])
  .option("--sort <field>", "Sort: relevance, updated_at, created_at", "relevance")
  .option("--order <dir>", "Sort direction: asc, desc", "desc")
  .option("-n, --limit <n>", "Max results (1-100)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("-q, --quiet", "Post IDs only", false)
  .option("--json", "Output raw JSON", false)
  .action(async (query: string, opts) => {
    const params: Record<string, string> = { query };
    if (opts.regex) params.regex = "true";
    if (opts.tag.length) params.tags = opts.tag.join(",");
    if (opts.sort !== "relevance") params.order_by = opts.sort;
    if (opts.order !== "desc") params.order = opts.order;
    if (opts.limit !== "20") params.limit = opts.limit;
    if (opts.cursor) params.cursor = opts.cursor;

    const data = await client().search(params);
    output(data, { json: opts.json, quiet: opts.quiet, formatter: formatSearch });
  });
```

- [ ] **Step 6: Update `edit` command — remove topic**

In the `edit` command, remove `--topic` option and `topic` from payload. Remove line 275:

```typescript
  .option("--topic <topic>", "Move to new topic (posts only)")
```

And remove from payload building (line 308):

```typescript
      if (opts.topic) payload.topic = opts.topic;
```

And update the error message (line 312):

```typescript
        console.error("Error: At least one field required: --title, --body, --tag.");
```

- [ ] **Step 7: Update `find` command — remove topic**

In the `find` command, remove `[topic]` positional arg. Replace lines 222-265:

```typescript
// ─── find ───────────────────────────────────────────────────
program
  .command("find")
  .description("Search posts by metadata")
  .option("-a, --author <author>", "Filter by author")
  .option("--tag <tag>", "Filter by tag (repeatable)", collect, [])
  .option("--since <date>", "Posts updated after date (ISO 8601)")
  .option("--before <date>", "Posts updated before date")
  .option("-s, --status <status>", "Filter: active, archived, obsolete, all", "active")
  .option("--sort <field>", "Sort: updated_at, created_at, title", "updated_at")
  .option("--order <dir>", "Sort direction: asc, desc", "desc")
  .option("-n, --limit <n>", "Max results (1-100)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("-q, --quiet", "Post IDs only", false)
  .option("--json", "Full JSON response", false)
  .action(async (opts) => {
    const hasFilter = !!(
      opts.author ||
      opts.tag.length ||
      opts.since ||
      opts.before
    );

    if (!hasFilter) {
      console.error("Error: At least one filter required (--author, --tag, --since, --before).");
      process.exit(1);
    }

    const params: Record<string, string | string[]> = {};
    if (opts.author) params.author = opts.author;
    if (opts.tag.length) params.tag = opts.tag;
    if (opts.since) params.since = opts.since;
    if (opts.before) params.before = opts.before;
    if (opts.status !== "active") params.status = opts.status;
    if (opts.sort !== "updated_at") params.order_by = opts.sort;
    if (opts.order !== "desc") params.order = opts.order;
    if (opts.limit !== "20") params.limit = opts.limit;
    if (opts.cursor) params.cursor = opts.cursor;

    const data = await client().find(params);
    output(data, { json: opts.json, quiet: opts.quiet, formatter: formatFind });
  });
```

- [ ] **Step 8: Update imports — remove formatBrowse**

In `src/cli/index.ts`, remove `formatBrowse` from the imports:

```typescript
import {
  output,
  formatPost,
  formatSearch,
  formatFind,
  formatCreated,
  formatStatus,
  formatDeleted,
} from "./format";
```

- [ ] **Step 9: Commit**

```bash
git add src/cli/index.ts src/cli/client.ts
git commit -m "feat: update CLI — remove ls/topic, add tags command"
```

---

### Task 9: Update tests

**Files:**
- Modify: `test/api.test.ts`

- [ ] **Step 1: Update createPost helper — remove topic default**

In `test/api.test.ts`, update the `createPost` helper (lines 14-29):

```typescript
async function createPost(
  overrides: Record<string, any> = {}
): Promise<any> {
  const defaults = {
    title: "Test post",
    body: "Test body content",
    tags: ["test"],
  };
  const res = await app.request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...defaults, ...overrides }),
  });
  return res.json();
}
```

Changes: removed `topic: "test"` from defaults.

- [ ] **Step 2: Remove topic from search tests that reference it**

Remove the "filters by topic" test entirely (the one that passes `topic=auth`). Update any test that passes `topic` in createPost to remove it — all posts should use tags instead.

Search for all `topic:` references in the test file and remove them from createPost calls, keeping only the tests that still make sense without topics.

- [ ] **Step 3: Remove browse tests if any exist**

Remove any tests under `describe("GET /api/browse")`.

- [ ] **Step 4: Add a test for tags-required validation**

```typescript
  it("returns 400 when tags are missing", async () => {
    const res = await app.request("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No tags", body: "Some body" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("tag");
  });
```

- [ ] **Step 5: Run all tests**

Run: `bun test test/api.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add test/api.test.ts
git commit -m "test: update tests for tags-only migration"
```

---

### Task 10: Rewrite the using-kilroy skill

**Files:**
- Modify: `plugin/skills/using-kilroy/SKILL.md`

- [ ] **Step 1: Replace the skill content**

Replace the entire file with:

```markdown
---
name: using-kilroy
description: >
  Use when starting work on code with non-obvious constraints or history,
  debugging, making architectural decisions, working with external services,
  when the user references something from a past session, or after completing
  analyses, hitting unexpected results, or resolving issues worth sharing
  with future sessions.
---

<subagent-stop>
If you were dispatched as a subagent to execute a specific task, skip this.
</subagent-stop>

Kilroy is shared tribal knowledge — notes from past agent sessions, project members, and humans. It persists across sessions, machines, and the project. It is NOT your local auto-memory.

If Kilroy tools are failing or returning auth errors, re-run the install script from your project's web dashboard. Manual setups may still require `KILROY_URL` and `KILROY_TOKEN`.

## Step 1: Check (before starting work)

Quick `kilroy_search` (keyword) or `kilroy_tags` (explore what exists). Nothing relevant? Move on.

Check when:
- The task touches code with non-obvious constraints, history, or external dependencies
- Debugging — someone may have hit this before
- Making a decision — prior reasoning may exist
- Using external services or infrastructure
- The user references something from a past session

Skip when trivial (rename, typo fix) or already checked this session.

### Assessing what you find

- **`created_at`** — recent = more likely current
- **`author`** — human posts often carry deliberate decisions
- **`status`** — `active` (current), `archived` (stale), `obsolete` (wrong)

If a post is outdated, mark it `obsolete` or comment with what changed. If a post's content is wrong, comment with the correction (you can only update your own posts).

## Step 2: Capture (when you have something worth sharing)

**Would a future session benefit from knowing what I just learned?**

If yes, `kilroy_create_post` or `kilroy_comment`. Do NOT ask the user — just do it and mention it briefly afterward. If unsure, err toward posting — it's cheap to archive later. Post when you have the first meaningful insight, not when the work is "complete." You can update the same post as you learn more with `kilroy_update_post`.

Capture when:
- Completed a data analysis — funnel metrics, campaign performance, error rates, cost breakdowns. Always capture; expensive to reproduce.
- Reality didn't match expectation — API failures, unexpected tool behavior, misleading errors, non-obvious workarounds
- A decision was made and the reasoning matters
- An approach was tried and abandoned
- The user shared reusable context — constraints, vendor limitations, preferences
- A customer issue revealed a pattern
- Learned something operational — deployment quirks, environment setup

If a relevant post already exists, `kilroy_comment` on it rather than creating a duplicate.

If you already posted in this session and the conversation continues on the same topic, `kilroy_update_post` to refine your existing post rather than creating a new one. Start a new post only when the topic genuinely changes.

Skip when trivial and self-evident from code, or personal to this user's preferences (use local memory instead).

### Writing posts

**Hard rules:**
- **TL;DR for anything longer than a paragraph.** Bullet points at the top. The punchline, not a summary.
- **Title carries the finding, not the topic.** "TikTok creator content converts at 270% ROAS" not "TikTok campaign analysis." The title IS the search result.

**Principles:**
- **Put the useful thing first.** Conclusion, gotcha, root cause — whatever future-you needs. Context and methodology go below.
- **Write like you talk.** Plain English. Short sentences. You're a teammate leaving notes, not a consultant writing a deliverable.
- **One story per post.** A multi-finding analysis is fine if it's one coherent narrative. Two unrelated things are two posts.

### Tagging

Tags are how knowledge gets found. Every post needs at least one.

- **Tag the subject, not the activity.** `churn`, `tiktok`, `auth` — not `analysis`, `debugging`, `investigation`.
- **Check existing tags first** (`kilroy_tags`). Reuse before inventing. `tiktok` not `tiktok-ads`.
- **2-5 tags per post.** Enough to be findable from multiple angles, not so many that tags lose meaning.
- **Include the tool/service if relevant.** `posthog`, `appsflyer`, `revenuecat` — future agents searching by tool will find it.

## Kilroy vs Local Memory

| | Kilroy | Local auto-memory |
|---|---|---|
| **Scope** | Project-wide, cross-session | Personal, this machine |
| **Content** | Decisions, analyses, discoveries | User preferences, workflow habits |
| **Example** | "AppsFlyer needs enterprise license for cost data" | "User prefers tables over bullets" |

When the user says "remember this" or shares a reusable fact — **Kilroy, not local memory** — unless it's purely about how they want you to behave.

## Red Flags

| Thought | Reality |
|---------|---------|
| "This analysis isn't important enough to save" | If you made tables or drew conclusions, save it. |
| "The user didn't ask me to save this" | You don't ask before writing to local memory either. |
| "The analysis isn't done yet" | Post what you have now. You can update it. There's no guarantee of another turn. |
| "This is just a quick lookup, no need to check" | Quick lookups are exactly when Kilroy saves the most time. |
| "I already know about this topic" | Past agents may know things you don't. |
| "I'll post when I'm done" | Sessions end unexpectedly. Post the first insight now, update later. |
```

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/using-kilroy/SKILL.md
git commit -m "docs: rewrite using-kilroy skill — tags-only, post writing guidance"
```

---

### Task 11: Full regression check

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: All tests PASS (except the pre-existing install test issue).

- [ ] **Step 2: Build and restart**

Run: `bun run build:web && kill $(lsof -ti :7432) 2>/dev/null; sleep 1; bun run start &`

Wait for server to start, then verify:

```bash
# Tags endpoint works
curl -s "http://localhost:7432/srijan/sagaland/api/tags" \
  -H "Authorization: Bearer klry_proj_8bf42557abca01d07abfd77f3b0d5028" | python3 -m json.tool | head -20

# Search still works without topic
curl -s "http://localhost:7432/srijan/sagaland/api/search?query=marketing+campaign+cohorts" \
  -H "Authorization: Bearer klry_proj_8bf42557abca01d07abfd77f3b0d5028" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"results\"])} results')"

# Tags drill-down works
curl -s "http://localhost:7432/srijan/sagaland/api/tags?tags=tiktok" \
  -H "Authorization: Bearer klry_proj_8bf42557abca01d07abfd77f3b0d5028" | python3 -m json.tool
```

- [ ] **Step 3: Bump version**

Run: `./scripts/bump-version.sh 0.8.0`

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "chore: bump plugin version to 0.8.0"
git push
```
