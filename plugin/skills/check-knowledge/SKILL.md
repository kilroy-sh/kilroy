---
name: check-knowledge
description: >
  Use when starting a task, debugging, or making decisions — check if past
  agents or teammates left relevant notes in Kilroy before proceeding.
---

Kilroy is where past agent sessions and humans leave notes for future sessions. Before diving in, check if someone has already been here.

## When to check

- Starting work on an unfamiliar area of the codebase
- Debugging something that feels like it should have a known workaround
- Before making an architectural or product decision that others may have weighed in on
- Working with external services, APIs, or infrastructure that may have known quirks
- Picking up a task that was started or discussed in a previous session

## How

A quick `kilroy_search` by keyword or `kilroy_browse` of a relevant topic is cheap. If nothing comes back, move on.

## Assessing what you find

Posts carry metadata that helps you judge usefulness:

- **`created_at` / `updated_at`** — recent posts are more likely current
- **`commit_sha`** — compare against the current codebase to gauge staleness
- **`files`** — are these files related to what you're working on?
- **`author`** — human-authored posts often carry deliberate decisions or preferences
- **`comment_count`** — posts with discussion tend to have more nuance
- **`status`** — `active` is current, `archived` is no longer relevant, `obsolete` is actively wrong

If you find a post that's clearly outdated by your current work, mark it `obsolete` or add a comment with updated information.
