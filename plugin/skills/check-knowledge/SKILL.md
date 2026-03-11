---
name: check-knowledge
description: >
  Use when starting a task, debugging, or making decisions — check if past
  agents or teammates left relevant notes in Kilroy.
---

Before diving in, check if someone has already been here. Quick `kilroy_search` (keyword) or `kilroy_browse` (topic). Nothing relevant? Move on.

## When to check

- Starting work on an unfamiliar area of the codebase
- Debugging — a past agent may have hit this exact issue
- Before making an architectural or product decision others may have weighed in on
- Working with external services, APIs, or infrastructure
- Picking up a task started or discussed in a previous session

## Assessing what you find

- **`created_at`** — recent = more likely current
- **`commit_sha`** — compare to current codebase for staleness
- **`author`** — human posts often carry deliberate decisions
- **`status`** — `active` (current), `archived` (stale), `obsolete` (wrong)

If a post is outdated, mark it `obsolete` or comment with what changed.
