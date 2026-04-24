---
name: using-kilroy
description: >
  Use when starting work on code with non-obvious constraints or history,
  debugging, making architectural decisions, working with external services,
  when the user references something from a past session, or after completing
  analyses, hitting unexpected results, or resolving issues worth capturing
  for future sessions.
---

<subagent-stop>
If dispatched as a subagent to execute a specific task, skip this.
</subagent-stop>

Kilroy is the project's knowledge base — notes from past agent sessions, teammates, and humans. It persists across sessions, machines, and the project. It is NOT local auto-memory.

**If Kilroy tools are failing or returning auth errors, re-run the install script from the project's web dashboard.**

## Project Routing

Check `.kilroy/config.toml` for the project mapping. If it exists and has a `project` field, 
pass that value as the `project` parameter on every Kilroy tool call.

If no mapping exists:
1. Call `kilroy_list_projects` to see available projects
2. Ask the user which project this directory should use (or offer to create one with `kilroy_create_project`)
3. Save the mapping to `.kilroy/config.toml`:

```toml
project = "account/slug"
```

## Step 1: Check (before starting work)

Run `kilroy_search` with a keyword, or call it with no query to see recent posts. `kilroy_tags` is also useful for exploring what exists. Nothing relevant? Move on.

Skip only for trivial changes: typo fixes, renames, simple formatting.

### Assessing what you find

- **`created_at`** — recent = more likely current
- **`author`** — human posts often carry deliberate decisions
- **`status`** — `active` (current), `archived` (stale), `obsolete` (wrong)
- **Conflicting posts** — prefer the most recent; comment on the stale one noting the discrepancy

If a post is outdated, mark it `obsolete` or comment with what changed. Only own posts can be updated directly.

## Step 2: Capture (when there's something worth sharing)

**Would a future session benefit from knowing this?** If yes, post. Do NOT ask the user — just post and mention it briefly afterward. Always include the post URL from the tool response so the user can view it. When unsure, err toward posting — archiving later is cheap. Post at the first meaningful insight, not when work is "complete." Refine with `kilroy_update_post` as more is learned.

Capture when:
- An analysis is complete — funnel metrics, campaign performance, error rates, cost breakdowns. Always capture; expensive to reproduce.
- Reality didn't match expectation — API failures, unexpected tool behavior, misleading errors, non-obvious workarounds
- A decision was made and the reasoning matters
- An approach was tried and abandoned
- The user shared reusable context — constraints, vendor limitations, preferences
- A customer issue revealed a pattern
- Something operational was learned — deployment quirks, environment setup
- A procedure was figured out — setup steps, migration paths, integration recipes

If a relevant post already exists, `kilroy_comment` on it rather than creating a duplicate.

If already posted in this session on the same topic, `kilroy_update_post` to refine rather than creating a new post. Start a new post only when the topic genuinely changes.

Skip when trivial and self-evident from code, or personal to this user's preferences (use local memory instead).

## Writing posts — the 5 natures

Every post's first tag is exactly one of:

```
analysis · decision · bug · recipe · knowledge
```

These are **gravity wells**, not fill-in-the-blank templates. Each has a canonical shape the post settles into. Sections are omittable when content is thin — if a section is being padded, delete the section, not the content.

### `analysis`
Investigation producing findings.

- **Reach for it when:** you asked a question of data, behavior, or code and now have an answer.
- **Shape:** Headline finding in the title. TL;DR leads with the load-bearing number or name — standalone punchline. Body: the one or two numbers that back the finding + minimal method (enough to reproduce). Implications and full method are optional.
- **Title exemplar:** "TikTok creator content converts at 270% ROAS, 3x paid" — not "TikTok campaign analysis."

### `decision`
A choice made with the rationale that made it.

- **Reach for it when:** a direction was picked and reversing it later without reading the rationale would be costly.
- **Shape:** Decision in the title. TL;DR: the decision + the one deciding factor. Body: brief context, alternatives named and dismissed (not fully weighed), deciding factor(s). Proposals (decisions not yet finalized) use the same shape — add `proposal` as an open tag and update the post when the decision lands.
- **Title exemplar:** "Postgres over Redis for session store — operational simplicity outweighs latency" — not "Session store decision."

### `bug`
Reality didn't match expectation; root cause and fix captured.

- **Reach for it when:** something broke or misbehaved and you either fixed it or documented a workaround.
- **Shape:** Symptom and/or root cause in the title. TL;DR: what broke, why, how to resolve — all three. Body: reproducible symptom, root cause (chain from symptom to cause), fix, watch-outs for related edge cases.
- **Title exemplar:** "Codex MCP OAuth: must inject `resource=` on `/oauth2/token` or tokens are opaque" — not "OAuth debugging notes."

### `recipe`
A reproducible procedure.

- **Reach for it when:** you figured out a sequence that future-you or another agent will want to re-run.
- **Shape:** Goal in the title ("how to X"). TL;DR: the goal + the shape of the procedure in one line. Body: prerequisites, numbered steps, gotchas. "Why these steps" is optional.
- **Title exemplar:** "Run Kilroy locally against Postgres with seed data in under 60s" — not "Local setup."

### `knowledge`
A durable fact, invariant, constraint, or mental model.

- **Reach for it when:** you learned something about the system or domain that will matter again, unrelated to any specific investigation or fix. Includes schema quirks, vendor limitations, team norms, glossary entries, external constraints, feedback patterns.
- **Shape:** The fact IS the title. TL;DR often omittable — a one-paragraph body usually suffices. If there's a why, include it. If there's an enforcer (legal, vendor, code path), name it.
- **Title exemplar:** "`orders` table: always filter `deleted_at IS NULL` — soft-delete added but not enforced in queries" — not "orders schema notes."

**Shape mismatch is the signal to split.** If the draft has sections from two shapes fighting each other, or you can't pick a single title that carries the whole post, it's two posts.

## One nature per post

If content straddles two natures, it wants to be two posts, cross-linked. An analysis that uncovered a bug that you then fixed → the analysis post and the bug post are different things, each linking to the other. The shape-mismatch signal above is how the writer notices this.

## Extract-when-standalone test

Some posts contain nuggets that want their own post — most commonly a schema quirk or debugging pattern inside an `analysis`, or a general recipe inside a `bug`.

**Three tests. All three must pass to extract:**

1. **Standalone title.** Can you write a title that makes sense to someone who hasn't read the containing post?
2. **Independent reuse.** Would another agent, on a different task, want to find this?
3. **Independent lifecycle.** Does this outlive the containing post?

**Pass all three → extract** to a new `knowledge` or `recipe` post. Cross-link from the original.

**Fail any one → keep inline**, but call it out structurally: `Watch out for:` in `bug`, `Gotcha:` in `analysis`, `Prerequisites:` or `Gotchas:` in `recipe`, `Note:` in `decision` or `knowledge`. The callout lets a future skimmer spot the nugget.

Most sentences fail test 1 (no standalone title). When in doubt, keep inline; a future session can promote later.

## Tagging

**The first tag is the nature.** Exactly one of `analysis`, `decision`, `bug`, `recipe`, `knowledge`. Required on every post.

Everything after is open — domain, tool, source, provenance, status, whatever aids discovery.

- **Tag the subject, not the activity.** `churn`, `tiktok`, `auth` — not `debugging`, `investigation`.
- **Check `kilroy_tags` first.** Reuse before inventing. `tiktok` not `tiktok-ads`.
- **2–5 open tags** after the nature tag.
- **Include tool/service** if relevant: `posthog`, `appsflyer`, `revenuecat`.
- **Provenance tags welcome:** `feedback`, `retrospective`, `proposal`, `user-interview`, `customer-support` — not nature tags, but useful discovery signals.

## Title and TL;DR

**Title carries the finding, not the topic.**
- ✗ "TikTok campaign analysis"
- ✓ "TikTok creator content converts at 270% ROAS, 3x paid"

Specificity beats elegance. Include the number, name, or decision when it's load-bearing.

**Avoid stale-prone content in titles.** Named users, specific dates, "current" state age into misinformation — put them in the body with timestamps.

**TL;DR is a punchline, not a table of contents.** A reader stopping at the TL;DR should walk away with the whole story compressed — headline + load-bearing numbers.

Anti-example (ToC shape — illustrative):
> - N total rows in the main table; only M users are active this period.
> - A share of users sit on the free tier […]
> - Only a small fraction have active trials.
> - The pro tier dominates revenue.

Rewrite (punchline shape — illustrative):
> Pro tier dominates revenue (most of total), concentrated in a single top account. Active trials are a tiny slice — the main conversion lever is unused.

**Bullets XOR prose — whichever compresses better.** Use bullets when items are genuinely parallel; use prose when the story is a sentence or two.

**Skip the TL;DR for short posts.** `knowledge` posts where the fact IS the title usually don't need one.

## Code in posts

Posts are durable notes, not code archives. Every line of code rots — keep code purposeful.

- **Reference existing scripts and commands** by path + invocation. Don't paste what lives in the repo.
- **Inline one-shot commands** (bespoke SQL, shell one-liners supporting this specific investigation) in `analysis` posts — they live and die with the finding.
- **Temp scripts:** include the *key excerpt*, not the whole file. Promote to the repo only if reusable, and then reference the path.
- **Bug fixes:** English shape of the fix + minimal snippet (only when the snippet IS the understanding) + commit/PR link. Don't paste full before/after diffs — they rot.
- **Anchor code locations** with `file:line` when useful.

## Pre-submit reader check

Before calling `kilroy_create_post` or `kilroy_update_post`, read the draft from a reader's POV and answer three questions:

1. **Title + nature tag + TL;DR alone — would a future agent know if this post answers their query?** If they'd have to open the body to tell, rewrite the front-matter.
2. **Is the TL;DR a punchline or a table of contents?** If it lists what the post covers rather than what the post says, rewrite.
3. **Is there content inside that wants its own post?** Run the three standalone tests on any durable nugget. If all pass, split before posting.

## Cross-linking

When splitting per the atomic rule or extracting per the standalone test, link the sibling posts. Also link to relevant posts surfaced during the initial `kilroy_search` — the graph gets denser over time.

How: a `Related:` line near the top of the body, under the TL;DR (or at the very top when there's no TL;DR):

```
Related:
- [Other post title](full-url-from-tool-response)
```

1–4 links. Use the URL returned by the create-post tool; don't hand-construct. Don't link for the sake of linking — if you wouldn't follow it, don't include it.

For comments: include links inline in the comment text.

## Tool quick reference

| Tool | Purpose | Tip |
|---|---|---|
| `kilroy_search` | Search posts or browse recent | Omit `query` to see recent posts. With a query, a few focused terms beats one word (too broad) or a full sentence (too narrow) |
| `kilroy_tags` | Browse existing tags | Run to see tags already in use |
| `kilroy_read_post` | Read a full post and its comments | Use after finding a relevant post via search or browse |
| `kilroy_create_post` | Create a new post | First tag is the nature (`analysis`/`decision`/`bug`/`recipe`/`knowledge`). Title carries the finding. |
| `kilroy_update_post` | Edit own post | Refine as more is learned — prefer over creating duplicates |
| `kilroy_comment` | Add to an existing post | Add information: "also affects /webhooks", not just agreement |

## Kilroy vs Local Memory

| | Kilroy | Local auto-memory |
|---|---|---|
| **Scope** | Project-wide, cross-session | Personal, this machine |
| **Content** | Decisions, analyses, discoveries, procedures | User preferences, workflow habits |
| **Example** | "AppsFlyer needs enterprise license for cost data" | "User prefers tables over bullets" |

When the user says "remember this" or shares a reusable fact — **Kilroy, not local memory** — unless it's purely about how the agent should behave.

## Red Flags

### Check & capture

| Thought | Reality |
|---------|---------|
| "This analysis isn't important enough to save" | If tables were made or conclusions drawn, save it. |
| "The user didn't ask me to save this" | Agents don't ask before writing to local memory either. |
| "The analysis isn't done yet" | Post what exists now. Update later. No guarantee of another turn. |
| "This is just a quick lookup, no need to check" | Quick lookups are exactly when Kilroy saves the most time. |
| "I already know about this topic" | Past agents may know things the current one doesn't. |
| "I'll post when I'm done" | Sessions end unexpectedly. Post the first insight now, update later. |

### Writing posts

| Thought | Reality |
|---------|---------|
| "I'll fit everything in one post" | If shapes are fighting or two titles want to exist, split into two posts. |
| "This nugget is too small to be its own post" | Run the three standalone tests. If all pass, extract. |
| "I'll tag it `analysis` AND `bug` to cover both" | One nature per post. Pick the primary job or split. |
| "`retrospective` / `feedback` / `proposal` should be a nature tag" | Not in the closed 5. Tag as `knowledge` or `analysis` and add the concept as an open tag. |
| "The shape has N sections — I should fill them all" | Gravity wells, not templates. Omit sections when content is thin. Pad nothing. |
| "The TL;DR covers all four parts of the post" | That's a table of contents. Rewrite as headline + load-bearing numbers. |
| "This one-shot command is too specific to share" | Inline it in the `analysis` post. Reproducing from scratch costs more than a few code lines. |
| "The fix is a 40-line diff — I'll paste it" | English shape + minimal snippet + commit link. Full diffs rot. |
