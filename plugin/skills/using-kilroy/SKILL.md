---
name: using-kilroy
description: >
  Use at the start and end of every turn — check shared knowledge before
  starting work, capture new knowledge before finishing.
---

<subagent-stop>
If you were dispatched as a subagent to execute a specific task, skip this.
</subagent-stop>

Kilroy is shared tribal knowledge — notes from past agent sessions, teammates, and humans. It persists across sessions, machines, and the team. It is NOT your local auto-memory.

## Step 1: Check (before starting work)

**Could a past session have left something useful here?**

Quick `kilroy_search` (keyword) or `kilroy_browse` (topic). Takes seconds. Nothing relevant? Move on.

Check when:
- Working on an unfamiliar area or module
- Debugging — someone may have hit this before
- Making a decision — prior reasoning may exist
- Using external services or infrastructure
- The user references something from a past session

Skip when:
- Trivial self-contained tasks (rename, typo fix)
- Already checked this session for the same topic

## Step 2: Capture (before ending your turn)

**Would a future session benefit from knowing what I just did?**

If yes, `kilroy_create_post` or `kilroy_comment`. Do NOT ask the user — just do it and mention it briefly afterward.

Capture when:
- You completed a data analysis — funnel metrics, campaign performance, error rates, cost breakdowns. Always capture analyses; they're expensive to reproduce.
- Reality didn't match expectation:
  - An API call failed and you had to adjust parameters
  - A tool behaved differently than its interface suggested
  - You had to retry or change approach after an unexpected result
  - A workaround was needed for a non-obvious limitation
  - An error message was misleading and the real fix was something else
- A decision was made and the reasoning matters
- An approach was tried and abandoned
- The user shared reusable context — constraints, vendor limitations, preferences
- A customer issue revealed a pattern
- You learned something operational — deployment quirks, environment setup

Skip when:
- Trivial and self-evident from the code
- Already in Kilroy (comment to update instead)
- Personal to this user's preferences (use local memory)

## Kilroy vs Local Memory

| | Kilroy | Local auto-memory |
|---|---|---|
| **Scope** | Team-wide, cross-session | Personal, this machine |
| **Content** | Decisions, analyses, discoveries | User preferences, workflow habits |
| **Example** | "AppsFlyer needs enterprise license for cost data" | "User prefers tables over bullets" |
| **Example** | "Age verification launch caused 69% purchase drop" | "Always use bun, not npm" |

When the user says "remember this" or shares a reusable fact — **Kilroy, not local memory** — unless it's purely about how they want you to behave.

## Red Flags

| Thought | Reality |
|---------|---------|
| "This analysis isn't important enough to save" | If you made tables or drew conclusions, save it. |
| "The user didn't ask me to save this" | You don't ask before writing to local memory either. |
| "I'll capture it at the end of the session" | There is no end-of-session hook. Capture now or it's lost. |
| "This is just a quick lookup, no need to check" | Quick lookups are exactly when Kilroy saves the most time. |
| "I already know about this topic" | Past agents may know things you don't. |
| "The user seems in a hurry" | A search takes seconds. A post takes seconds. |

## Topic Organization

Topics are hierarchical paths (`auth/google`, `analytics/retention`).

- **Browse existing topics first** — consistency beats perfection
- **Mirror the codebase** for code knowledge (`auth/`, `api/`, `database/`)
- **Use domain areas** for non-code knowledge (`ops/`, `analytics/`, `customers/`, `product/`)
- **Keep it shallow** — 2-3 levels max
- **When in doubt, go broad**
