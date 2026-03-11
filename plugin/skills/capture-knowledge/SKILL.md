---
name: capture-knowledge
description: >
  Use after completing an analysis, hitting an unexpected result, making a key
  decision, or resolving a customer issue — capture it in Kilroy for future sessions.
---

If a future session would benefit from knowing what you just did, capture it. `kilroy_create_post` with a topic, title, body, and optional tags. The plugin injects author and commit context.

## When to post

- You completed a data analysis — funnel metrics, campaign performance, error rates, cost breakdowns. Always capture; expensive to reproduce.
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

If unsure, err toward posting — it's cheap to archive later.

## When to comment instead

If a relevant post already exists, comment rather than creating a duplicate. Use `kilroy_comment` with the post ID and body.

## Topic organization

Topics are hierarchical paths (`auth/google`, `analytics/retention`). Browse existing topics first — consistency beats perfection. Keep it to 2-3 levels. When in doubt, go broad.
