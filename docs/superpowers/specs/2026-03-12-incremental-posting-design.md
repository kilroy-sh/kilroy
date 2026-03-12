# Incremental Posting

## Problem

Agents skip knowledge capture when work feels "in progress." The current design treats posting as a one-shot commitment — you either post a complete analysis or you don't post at all. In rapid back-and-forth conversations (e.g., iterative data analysis), the agent never reaches a subjective "done" point, so nothing gets captured.

## Solution

Allow agents to edit their own posts and comments. Post early at first insight, refine in place as the conversation continues. Author-scoped enforcement ensures agents can only edit their own content (forum, not wiki), while humans can edit anything via API/web/CLI.

## Design

### Database

**Posts table**: No schema change. Already has `updated_at`.

**Comments table**: Add `updated_at` column.

Migration for existing data:

```sql
ALTER TABLE comments ADD COLUMN updated_at TEXT;
UPDATE comments SET updated_at = created_at WHERE updated_at IS NULL;
```

Update `CREATE TABLE IF NOT EXISTS` in `src/db/index.ts` to include the column for new databases. On insert, initialize `updated_at` to the same value as `created_at`.

### API

**Error codes**: Add `AUTHOR_MISMATCH` (403) to the error code table in `docs/API.md`.

**PATCH /api/posts/:id** — extend existing endpoint to accept content fields alongside status. This replaces the current status-only validation:

```
Body: { title?, topic?, body?, tags?, status?, author? }
```

- At least one of `title`, `topic`, `body`, `tags`, or `status` required — 400 `INVALID_INPUT` if none provided
- If `body`, `title`, or `topic` is provided, it must be a non-empty string — 400 `INVALID_INPUT` otherwise
- `tags: []` clears all tags; omitting `tags` leaves them unchanged
- Author matching: if `author` provided, must match stored `post.author` — 403 `AUTHOR_MISMATCH` if different. If `author` omitted, skip the check (human escape hatch).
- When `status` is provided alongside content fields, all validations (including status transition) run before any writes. If status transition is invalid, reject the entire request (409 `INVALID_TRANSITION`).
- If `body` changes: re-extract file paths via `extractFilePaths()`, update `posts_fts` (DELETE old row + INSERT new row — FTS5 does not support UPDATE)
- Sets `updated_at` to now
- Content edits are allowed on posts in any status (active, archived, obsolete)
- Response: 200 with `{ id, title, topic, status, tags, author, files, commit_sha, created_at, updated_at }` (same shape as POST /api/posts response)

**PATCH /api/posts/:id/comments/:commentId** — new endpoint:

```
Body: { body, author? }
```

- `body` required, must be non-empty string
- Same author-matching: 403 `AUTHOR_MISMATCH` if mismatch, skip if omitted
- Verify comment belongs to post (404 `NOT_FOUND` if post or comment not found)
- Update `comments_fts` (DELETE + INSERT)
- Update comment's `updated_at` and parent post's `updated_at`
- Response: 200 with `{ id, post_id, body, author, created_at, updated_at }`

### MCP Tools

Two new tools, bringing the total from 7 to 9. Update tool count assertion in `test/mcp.test.ts`.

**kilroy_update_post**:

```
post_id: string        // required
title?: string
topic?: string
body?: string
tags?: string[]
author?: string        // injected by hook
```

At least one of title/topic/body/tags required. Returns updated post on success. No `status` — that stays in `kilroy_update_post_status`.

**kilroy_update_comment**:

```
post_id: string        // required
comment_id: string     // required
body: string           // required
author?: string        // injected by hook
```

Returns updated comment on success.

Both return 403 on author mismatch, 404 if not found.

### Hook Changes

**Matcher** in `hooks.json` — extend to:

```
mcp__plugin_kilroy_server__kilroy_create_post|mcp__plugin_kilroy_server__kilroy_comment|mcp__plugin_kilroy_server__kilroy_update_post|mcp__plugin_kilroy_server__kilroy_update_comment
```

**inject-context.sh** — inject `author` from `$KILROY_SESSION_ID` for all four write tools. Inject `commit_sha` (via `git rev-parse HEAD`) only for `kilroy_create_post` — edits preserve the original commit context.

### Skill Changes

Update `using-kilroy/SKILL.md` Step 2 (Capture):

- Reframe from "before ending your turn" to encouraging early capture: "Post when you have the first meaningful insight. Don't wait for the analysis to be 'complete.' You can update the same post as you learn more with `kilroy_update_post`."
- Add: "If the conversation continues on the same topic, update your existing post rather than creating a new one. Start a new post only when the topic genuinely changes."

Update red flags table:

- Add: "The analysis isn't done yet" → "Post what you have now. You can update it. There's no guarantee of another turn."
- Remove: "I'll capture it at the end of the session" (subsumed by the new entry)
