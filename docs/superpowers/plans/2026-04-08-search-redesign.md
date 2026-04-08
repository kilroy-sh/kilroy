# Search Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Kilroy search so OR-ranked keyword queries across title, topic, tags, and body return relevant results instead of empty sets.

**Architecture:** Update the PostgreSQL tsvector trigger to index topic (weight A) and tags (weight B) alongside existing title/body. Change query semantics from AND to OR with `ts_rank` scoring. Backfill existing rows.

**Tech Stack:** PostgreSQL FTS (tsvector, GIN index, ts_rank), TypeScript/Bun, Hono

**Spec:** `docs/superpowers/specs/2026-04-08-search-redesign-design.md`

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/index.ts` | Modify (lines 198-213) | Trigger function + trigger definition |
| `src/routes/search.ts` | Modify (lines 32-214, 358-368) | FTS query logic, snippet null handling, `toTsquery` |
| `src/mcp/server.ts` | Modify (line 96) | Tool description text |
| `test/api.test.ts` | Modify (add tests after line 376) | New search tests |

---

### Task 1: Update the tsvector trigger to index topic and tags

**Files:**
- Modify: `src/db/index.ts:198-213`

- [ ] **Step 1: Write a failing test — search by topic keyword**

In `test/api.test.ts`, add these tests after the existing `"returns empty results for no matches"` test (after line 376):

```typescript
  it("finds posts by topic keyword", async () => {
    await createPost({
      title: "TikTok campaign performance",
      topic: "marketing/tiktok",
      body: "Campaign metrics for March",
    });
    await createPost({
      title: "Auth migration notes",
      topic: "engineering/auth",
      body: "Migration steps for OAuth",
    });

    const res = await app.request("/api/search?query=marketing");
    const data = await res.json();

    expect(data.results.length).toBeGreaterThanOrEqual(1);
    expect(data.results[0].topic).toBe("marketing/tiktok");
  });

  it("finds posts by tag keyword", async () => {
    await createPost({
      title: "Deployment runbook",
      topic: "ops",
      body: "Standard deployment steps",
      tags: ["runbook", "infrastructure"],
    });

    const res = await app.request("/api/search?query=infrastructure");
    const data = await res.json();

    expect(data.results.length).toBeGreaterThanOrEqual(1);
    expect(data.results[0].title).toBe("Deployment runbook");
  });

  it("finds posts when tag keyword is not in title or body", async () => {
    await createPost({
      title: "API performance report",
      topic: "analytics",
      body: "Response times were stable",
      tags: ["latency", "monitoring"],
    });

    const res = await app.request("/api/search?query=monitoring");
    const data = await res.json();

    expect(data.results.length).toBeGreaterThanOrEqual(1);
    expect(data.results[0].title).toBe("API performance report");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/api.test.ts -t "finds posts by topic keyword"`
Expected: FAIL — "marketing" is not in the search_vector, so zero results.

- [ ] **Step 3: Update the trigger function in `src/db/index.ts`**

Replace lines 198-213 with:

```typescript
  // Full-text search triggers for posts
  await client.unsafe(`
    CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', replace(coalesce(NEW.topic, ''), '/', ' ')), 'A') ||
        setweight(to_tsvector('english',
          CASE WHEN NEW.tags IS NOT NULL AND NEW.tags != ''
            THEN array_to_string(ARRAY(
              SELECT jsonb_array_elements_text(NEW.tags::jsonb)
            ), ' ')
            ELSE ''
          END), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
    CREATE TRIGGER posts_search_vector_trigger
      BEFORE INSERT OR UPDATE OF title, body, topic, tags ON posts
      FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
  `);
```

Key changes:
- Added `replace(coalesce(NEW.topic, ''), '/', ' ')` at weight A — splits `marketing/tiktok` into two tokens
- Added tags parsing with null guard at weight B — extracts JSON array elements into a space-separated string
- Trigger now fires on `title, body, topic, tags` (was `title, body`)

- [ ] **Step 4: Run all search tests to verify topic/tag tests pass**

Run: `bun test test/api.test.ts -t "search"`
Expected: The three new tests PASS. Existing tests may still fail (AND semantics issue addressed in Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/db/index.ts test/api.test.ts
git commit -m "feat: index topic and tags in search_vector trigger"
```

---

### Task 2: Switch query semantics from AND to OR

**Files:**
- Modify: `src/routes/search.ts:362-368` (`toTsquery` function)
- Modify: `src/routes/search.ts:46-67` (`ftsSearch` query)

- [ ] **Step 1: Write a failing test — OR semantics**

Add to `test/api.test.ts` after the Task 1 tests:

```typescript
  it("matches posts containing any search term (OR semantics)", async () => {
    await createPost({
      title: "TikTok campaign performance",
      topic: "marketing/tiktok",
      body: "Campaign metrics and spend analysis",
    });
    await createPost({
      title: "Subscriber cohort retention",
      topic: "analytics/churn",
      body: "Cohort analysis for March subscribers",
    });
    await createPost({
      title: "Unrelated auth bug",
      topic: "engineering",
      body: "Fixed a login timeout issue",
    });

    const res = await app.request("/api/search?query=marketing+campaign+cohorts");
    const data = await res.json();

    // Should match both marketing and cohort posts, not the auth post
    expect(data.results.length).toBeGreaterThanOrEqual(2);
    const titles = data.results.map((r: any) => r.title);
    expect(titles).toContain("TikTok campaign performance");
    expect(titles).toContain("Subscriber cohort retention");
  });

  it("ranks posts with more matching terms higher", async () => {
    await createPost({
      title: "Only matches one term",
      topic: "misc",
      body: "This post mentions campaign once",
    });
    await createPost({
      title: "TikTok campaign cohort analysis",
      topic: "marketing/tiktok",
      body: "Campaign cohort performance for marketing spend",
    });

    const res = await app.request("/api/search?query=marketing+campaign+cohorts");
    const data = await res.json();

    // Post matching more terms should rank first
    expect(data.results[0].title).toBe("TikTok campaign cohort analysis");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/api.test.ts -t "matches posts containing any search term"`
Expected: FAIL — AND semantics returns empty or incomplete results.

- [ ] **Step 3: Change `toTsquery` from AND to OR**

In `src/routes/search.ts`, replace the `toTsquery` function (lines 362-368):

```typescript
/**
 * Convert a user search query into a PostgreSQL tsquery string.
 * Each word is joined with | (OR) for matching any term.
 */
function toTsquery(query: string): string {
  return query
    .replace(/['"\\:&|!()]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" | ");
}
```

Single change: `.join(" & ")` becomes `.join(" | ")`.

- [ ] **Step 4: Update the FTS query to use `ts_rank` with normalization**

In `src/routes/search.ts`, replace the post search query in `ftsSearch` (lines 49-67):

```typescript
  // Search posts using tsvector with OR semantics
  const postMatches = await client.unsafe(`
    SELECT
      p.id as post_id,
      ts_headline('english', p.body, to_tsquery('english', $1),
        'StartSel=**, StopSel=**, MaxFragments=1, MaxWords=40') as snippet,
      ts_rank(p.search_vector, to_tsquery('english', $1), 32) as rank,
      ts_headline('english', p.title, to_tsquery('english', $1),
        'StartSel=**, StopSel=**') as title_headline,
    FROM posts p
    WHERE p.search_vector @@ to_tsquery('english', $1)
      AND p.project_id = $2
    ORDER BY rank DESC
    LIMIT $3
  `, [tsquery, projectId, limit * 2]) as Array<{
    post_id: string;
    snippet: string;
    rank: number;
    title_headline: string;
  }>;
```

Key change: `ts_rank` now uses normalization flag `32` (was `0` implicitly).

- [ ] **Step 5: Update the comment search query similarly**

In `src/routes/search.ts`, replace the comment search query (lines 70-87):

```typescript
  // Search comments using tsvector with OR semantics
  const commentMatches = await client.unsafe(`
    SELECT
      cm.post_id,
      cm.id as comment_id,
      ts_headline('english', cm.body, to_tsquery('english', $1),
        'StartSel=**, StopSel=**, MaxFragments=1, MaxWords=40') as snippet,
      ts_rank(cm.search_vector, to_tsquery('english', $1), 32) as rank
    FROM comments cm
    WHERE cm.search_vector @@ to_tsquery('english', $1)
      AND cm.project_id = $2
    ORDER BY rank DESC
    LIMIT $3
  `, [tsquery, projectId, limit * 2]) as Array<{
    post_id: string;
    comment_id: string;
    snippet: string;
    rank: number;
  }>;
```

- [ ] **Step 6: Run all search tests**

Run: `bun test test/api.test.ts -t "search"`
Expected: All tests PASS, including the new OR semantics tests.

- [ ] **Step 7: Commit**

```bash
git add src/routes/search.ts test/api.test.ts
git commit -m "feat: switch search from AND to OR semantics with ts_rank normalization"
```

---

### Task 3: Snippet null when no body match

**Files:**
- Modify: `src/routes/search.ts:95-105` (post match merging logic)

- [ ] **Step 1: Write a failing test — snippet is null when match is only in topic/tags**

Add to `test/api.test.ts`:

```typescript
  it("returns null snippet when match is only in topic or tags", async () => {
    await createPost({
      title: "General notes",
      topic: "marketing/skan",
      body: "These are internal notes about iOS setup",
      tags: ["skan"],
    });

    const res = await app.request("/api/search?query=skan");
    const data = await res.json();

    expect(data.results).toHaveLength(1);
    // "skan" appears in topic and tags but not in body text as a standalone word
    // The snippet should reflect body content or be null
    // Since "skan" IS in topic/tags and ts_headline won't highlight it in body,
    // the snippet should be null
    expect(data.results[0].snippet).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/api.test.ts -t "returns null snippet when match is only"`
Expected: FAIL — currently returns an unhighlighted body fragment instead of null.

- [ ] **Step 3: Update snippet logic in the post match merging**

In `src/routes/search.ts`, update the post match loop (around lines 95-105). Replace:

```typescript
  for (const m of postMatches) {
    const existing = bestByPost.get(m.post_id);
    if (!existing || m.rank > existing.rank) {
      bestByPost.set(m.post_id, {
        snippet: m.snippet,
        rank: m.rank,
        match_location: m.title_headline?.includes("**") ? "title" : "body",
      });
    }
  }
```

With:

```typescript
  for (const m of postMatches) {
    const existing = bestByPost.get(m.post_id);
    if (!existing || m.rank > existing.rank) {
      // snippet is null if body didn't actually match (match was in topic/tags only)
      const bodyHasMatch = m.snippet?.includes("**") ?? false;
      bestByPost.set(m.post_id, {
        snippet: bodyHasMatch ? m.snippet : null,
        rank: m.rank,
        match_location: m.title_headline?.includes("**") ? "title" : bodyHasMatch ? "body" : "metadata",
      });
    }
  }
```

The key insight: `ts_headline` wraps matching terms in `**`. If the snippet contains no `**` markers, the body didn't actually match — the match was in topic or tags only. Return `null` in that case.

- [ ] **Step 4: Run all search tests**

Run: `bun test test/api.test.ts -t "search"`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/search.ts test/api.test.ts
git commit -m "feat: return null snippet when search match is only in topic/tags"
```

---

### Task 4: Update MCP tool description

**Files:**
- Modify: `src/mcp/server.ts:96`

- [ ] **Step 1: Update the tool description**

In `src/mcp/server.ts`, replace line 96:

```typescript
    "Full-text search across post titles, post bodies, and comment bodies.",
```

With:

```typescript
    "Search posts by keyword or phrase. Returns the best matches across titles, bodies, topics, and tags. Multi-word queries match any term — results with more matches rank higher.",
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/server.ts
git commit -m "docs: update kilroy_search tool description for OR semantics"
```

---

### Task 5: Backfill existing posts and verify on prod data

**Files:**
- Modify: `src/db/index.ts` (add backfill after trigger creation)

- [ ] **Step 1: Add backfill migration after trigger creation**

In `src/db/index.ts`, add this block immediately after the posts trigger creation (after the `);` that closes the trigger SQL, around line 213):

```typescript
  // Backfill: recompute search_vector for all existing posts using new trigger
  await client.unsafe(`UPDATE posts SET updated_at = updated_at`);
```

This fires the BEFORE UPDATE trigger on every row, recomputing the search_vector with the new formula (now including topic + tags). The `updated_at = updated_at` assignment is a no-op on actual data.

- [ ] **Step 2: Run the full test suite**

Run: `bun test`
Expected: All tests PASS.

- [ ] **Step 3: Build the server**

Run: `bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Restart the server and verify against real data**

Restart the server (this applies the trigger changes and runs the backfill):

Run: `./restart.sh`

Then verify the original failing query now returns results:

```bash
curl -s "http://localhost:7432/api/search?query=marketing+campaign+cohorts" \
  -H "Authorization: Bearer <token>" | jq '.results[:3] | .[] | {title, topic, snippet}'
```

Expected: Results from `marketing/*` topics appear, with relevant snippets or null snippets for topic-only matches.

- [ ] **Step 5: Commit**

```bash
git add src/db/index.ts
git commit -m "feat: backfill search_vector for existing posts on startup"
```

---

### Task 6: Run full test suite and verify no regressions

- [ ] **Step 1: Run all tests**

Run: `bun test`
Expected: All tests PASS with no regressions.

- [ ] **Step 2: Verify existing search behavior is preserved**

Run the existing test patterns manually to confirm:
- Single keyword search still works
- Topic filter still works
- Tag filter still works
- Regex search still works (bypasses FTS)
- Comment search still works
- Pagination still works

Run: `bun test test/api.test.ts -t "search"`
Expected: All search tests PASS.

- [ ] **Step 3: Final commit if any cleanup needed**

If any adjustments were needed, commit them:

```bash
git add -A
git commit -m "fix: search redesign cleanup and regression fixes"
```
