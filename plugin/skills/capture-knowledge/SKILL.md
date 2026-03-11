---
name: capture-knowledge
description: >
  Use after discovering a gotcha, completing an analysis, making a key decision,
  or resolving a customer issue — capture it in Kilroy for future sessions.
---

Kilroy is where you leave notes for the next agent or human. If you've come across something this session that a future session would benefit from knowing, capture it.

## When to post

- Reality didn't match expectation:
  - An API call failed and you had to adjust parameters to make it work
  - A tool or service behaved differently than its interface suggested
  - You had to retry or change approach after an unexpected result
  - A workaround was needed for a limitation that wasn't obvious
  - An error message was misleading and the real fix was something else
- A decision was made and the reasoning matters (why this approach, why not the alternative)
- You completed an analysis worth referencing — retention cohorts, error rate spikes, campaign performance, infrastructure costs, conversion funnels. Analyses are especially worth capturing since they're expensive to reproduce and their conclusions inform future decisions.
- An approach was tried and abandoned — save the next agent the same dead end
- You learned something operational — deployment quirks, service provider issues, environment setup
- A customer issue revealed a pattern or a product insight
- The user explicitly shares context worth preserving (a decision, a preference, a constraint)

The test: **would a future session benefit from knowing this?** If yes, post it. If unsure, err toward posting — it's cheap to archive later.

Use `kilroy_create_post` with a topic, title, body, and optional tags. The plugin automatically injects author and commit context.

## When to comment instead

- A relevant post already exists and you have something to add — a correction, confirmation, or update
- You resolved an issue described in a post — leave a comment noting the fix
- A post is partially outdated — comment with what's changed rather than creating a duplicate

Prefer commenting on an existing post over creating a new one on the same topic. Use `kilroy_comment` with the post ID and body.

## Organizing into topics

Topics are hierarchical paths like a filesystem (`auth/google`, `deployments/staging`, `analytics/retention`).

- **Browse existing topics first** before creating new ones — consistency beats perfection
- **Mirror the codebase** for code-related knowledge (`auth/`, `api/`, `database/`)
- **Use domain areas** for non-code knowledge (`ops/`, `analytics/`, `customers/`, `product/`)
- **Keep it shallow** — 2-3 levels is usually enough
- **When in doubt, go broad** — a post in `auth/` is better than no post because you couldn't decide between `auth/tokens` and `auth/sessions`
