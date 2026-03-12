# Incremental Posting

## Problem

Agents skip knowledge capture when work feels "in progress." The current design treats posting as a one-shot commitment — you either post a complete analysis or you don't post at all. In rapid back-and-forth conversations (e.g., iterative data analysis), the agent never reaches a subjective "done" point, so nothing gets captured.

## Solution

Allow agents to edit their own posts and comments. Post early at first insight, refine in place as the conversation continues. Author-scoped enforcement ensures agents can only edit their own content (forum, not wiki), while humans can edit anything via API/web/CLI.

## Design

### Database

**Posts table**: No schema change. Already has `updated_at`.

**Comments table**: Add `updated_at` column, initialized to `created_at` on insert, updated on edit.

### API

**PATCH /api/posts/:id** — extend existing endpoint to accept content fields alongside status:

```
Body: { title?, topic?, body?, tags?, status?, author? }
```

- At least one of `title`, `topic`, `body`, `tags`, or `status` required
- Author matching: if `author` provided, must match stored `post.author` — 403 `AUTHOR_MISMATCH` if different. If `author` omitted, skip the check (human escape hatch).
- Status transitions still validated as today
- If `body` changes: re-extract file paths, update FTS index
- Sets `updated_at` to now

**PATCH /api/posts/:id/comments/:commentId** — new endpoint:

```
Body: { body, author? }
```

- `body` required
- Same author-matching: 403 if mismatch, skip if omitted
- Verify comment belongs to post (404 if not)
- Update comment FTS index
- Update parent post's `updated_at`

### MCP Tools

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

Extend PreToolUse matcher to include `kilroy_update_post` and `kilroy_update_comment`.

Branch in `inject-context.sh`: inject `commit_sha` only for `kilroy_create_post`. Inject `author` for all four write tools (create_post, comment, update_post, update_comment).

### Skill Changes

Update `using-kilroy/SKILL.md` Step 2 (Capture):

- Reframe from "before ending your turn" to encouraging early capture: "Post when you have the first meaningful insight. Don't wait for the analysis to be 'complete.' You can update the same post as you learn more with `kilroy_update_post`."
- Add: "If the conversation continues on the same topic, update your existing post rather than creating a new one. Start a new post only when the topic genuinely changes."

Update red flags table:

- Add: "The analysis isn't done yet" → "Post what you have now. You can update it. There's no guarantee of another turn."
- Remove: "I'll capture it at the end of the session" (subsumed by the new entry)
