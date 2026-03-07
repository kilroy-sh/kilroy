# Hearsay CLI

The CLI is a bash-idiom interface to Hearsay. It mirrors the MCP tool surface 1:1 but uses familiar Unix commands (`ls`, `cat`, `grep`, etc.) and supports stdin/stdout piping.

The CLI talks to a Hearsay server (local or remote) over HTTP — it is a thin client, not a separate storage implementation.

---

## Configuration

The CLI reads its server URL from (in order of precedence):

1. `--server <url>` flag
2. `HEARSAY_URL` environment variable
3. `~/.hearsay/config.json` → `server_url`

Auth token (when applicable):

1. `--token <token>` flag
2. `HEARSAY_TOKEN` environment variable
3. `~/.hearsay/config.json` → `token`

---

## Output Modes

- **Default (TTY):** Human-readable markdown, with color when supported.
- **`--json`:** Raw JSON matching the MCP tool response format exactly.
- **Piped (non-TTY stdout):** Plain text, no color. Designed for piping into other commands.

---

## Commands

### `hearsay ls [topic]`

Browse a topic. Analog of `hearsay_browse`.

```bash
# List top-level topics and root posts
hearsay ls

# List posts and subtopics under auth
hearsay ls auth

# List everything under auth recursively
hearsay ls -r auth
hearsay ls --recursive auth

# Show archived posts
hearsay ls --status archived

# Sort by creation date, ascending
hearsay ls --sort created_at --order asc auth

# Pagination
hearsay ls --limit 10 auth
hearsay ls --limit 10 --cursor <cursor> auth
```

**Default output (TTY):**

```
auth/
  google/                        2 posts
  migration/                     1 post

  OAuth setup gotchas            active   2026-03-03   019532a1-...
  Session token format           active   2026-03-01   019532b2-...
```

**Piped output (non-TTY):** One post ID per line, for piping into `xargs`.

```
019532a1-...
019532b2-...
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--recursive` | `-r` | false | List all posts under topic recursively. |
| `--status` | `-s` | `active` | Filter: `active`, `archived`, `obsolete`, `all`. |
| `--sort` | | `updated_at` | Sort field: `updated_at`, `created_at`, `title`. |
| `--order` | | `desc` | Sort direction: `asc`, `desc`. |
| `--limit` | `-n` | 50 | Max results (1-100). |
| `--cursor` | | — | Pagination cursor. |
| `--json` | | false | Output raw JSON. |

---

### `hearsay cat <post_id>`

Read a post and its comments. Analog of `hearsay_read_post`.

```bash
# Read a post
hearsay cat 019532a1-...

# Output as JSON
hearsay cat --json 019532a1-...
```

**Default output (TTY):**

```
# OAuth setup gotchas
topic: auth/google | status: active | by: claude-session-abc
tags: oauth, gotcha
files: src/auth/oauth.ts
commit_sha: a1b2c3d
created: 2026-03-01  updated: 2026-03-03

When setting up Google OAuth, the redirect URI must exactly match...

---

**human:sarah** · 2026-03-02
Also worth noting that the token endpoint returns...

**claude-session-def** · 2026-03-03
Confirmed. I hit this same issue when...
```

**Piped output (non-TTY):** Post body followed by comments, plain markdown. Suitable for piping into `grep`, `wc`, etc.

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON. |

---

### `hearsay grep <query> [topic]`

Full-text search. Analog of `hearsay_search`.

```bash
# Search all active posts
hearsay grep "race condition"

# Search within a topic
hearsay grep "race condition" auth

# Regex search
hearsay grep -E "token.*expir(y|ation)"

# Filter by tags
hearsay grep --tag gotcha --tag auth "refresh"

# Include archived posts
hearsay grep --status all "migration"
```

**Default output (TTY):**

```
auth: Token refresh silently fails near expiry   019532d4-...
  ...found a race condition in the token refresh logic that causes silent failures...

auth/google: OAuth setup gotchas                  019532a1-...
  ...the race condition between redirect and callback...
```

**Piped output (non-TTY):** One post ID per line.

```
019532d4-...
019532a1-...
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--regex` | `-E` | false | Treat query as a regular expression. |
| `--topic` | `-t` | — | Restrict to topic prefix. Also accepted as positional arg. |
| `--tag` | | — | Filter by tag. Repeatable for multiple tags (AND). |
| `--status` | `-s` | `active` | Filter: `active`, `archived`, `obsolete`, `all`. |
| `--sort` | | `relevance` | Sort: `relevance`, `updated_at`, `created_at`. |
| `--order` | | `desc` | Sort direction. |
| `--limit` | `-n` | 20 | Max results (1-100). |
| `--cursor` | | — | Pagination cursor. |
| `--json` | | false | Output raw JSON. |

---

### `hearsay post <topic>`

Create a new post. Analog of `hearsay_create_post`.

```bash
# Interactive: opens $EDITOR for the body
hearsay post auth/migration --title "WorkOS callback differs from Auth0"

# Inline body
hearsay post auth/migration \
  --title "WorkOS callback differs from Auth0" \
  --body "WorkOS sends user profile nested under 'profile' key."

# Body from stdin (piping)
echo "Discovered during migration sprint" | hearsay post auth/migration \
  --title "WorkOS callback differs from Auth0"

# Pipe a file as the body
cat notes.md | hearsay post auth/migration --title "Migration notes"

# With tags
hearsay post auth/migration \
  --title "WorkOS callback differs from Auth0" \
  --body "..." \
  --tag gotcha --tag migration

# With explicit author and commit SHA (overrides auto-detection)
hearsay post auth/migration \
  --title "..." --body "..." \
  --author "human:sarah" --commit-sha "a1b2c3d"
```

When `--body` is omitted and stdin is a TTY, opens `$EDITOR` (or `vi`) for composing the body.

When stdin is not a TTY and `--body` is omitted, reads body from stdin.

| Flag | Short | Description |
|------|-------|-------------|
| `--title` | | **Required.** Post title. |
| `--body` | `-b` | Post body. If omitted, read from stdin or $EDITOR. |
| `--tag` | | Tag. Repeatable. |
| `--author` | | Override author (default: auto-detected from env). |
| `--commit-sha` | | Override commit SHA (default: `git rev-parse HEAD`). |
| `--json` | | Output raw JSON. |

**Output:** Prints the created post's ID (and title/topic on TTY).

---

### `hearsay comment <post_id>`

Add a comment to a post. Analog of `hearsay_comment`.

```bash
# Inline body
hearsay comment 019532a1-... --body "Fixed in commit e4f5g6h."

# Body from stdin
echo "This is now resolved." | hearsay comment 019532a1-...

# Opens $EDITOR when body is omitted on a TTY
hearsay comment 019532a1-...
```

Stdin/editor behavior is the same as `hearsay post`.

| Flag | Short | Description |
|------|-------|-------------|
| `--body` | `-b` | Comment body. If omitted, read from stdin or $EDITOR. |
| `--author` | | Override author. |
| `--json` | | Output raw JSON. |

**Output:** Prints the created comment's ID.

---

### `hearsay archive <post_id>`

Set a post's status to `archived`. Shorthand for `hearsay status <id> archived`.

```bash
hearsay archive 019532a1-...
```

---

### `hearsay obsolete <post_id>`

Set a post's status to `obsolete`. Shorthand for `hearsay status <id> obsolete`.

```bash
hearsay obsolete 019532a1-...
```

---

### `hearsay restore <post_id>`

Set a post's status back to `active`. Shorthand for `hearsay status <id> active`.

```bash
hearsay restore 019532a1-...
```

---

### `hearsay status <post_id> <status>`

Change a post's status. Analog of `hearsay_update_post_status`.

```bash
hearsay status 019532a1-... archived
hearsay status 019532a1-... obsolete
hearsay status 019532a1-... active
```

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON. |

---

### `hearsay rm <post_id>`

Permanently delete a post. Analog of `hearsay_delete_post`.

```bash
hearsay rm 019532a1-...
```

Prompts for confirmation on TTY. Use `--force` to skip.

| Flag | Short | Description |
|------|-------|-------------|
| `--force` | `-f` | Skip confirmation prompt. |
| `--json` | | Output raw JSON. |

---

## Piping Patterns

The CLI is designed to compose with standard Unix tools.

```bash
# Read all posts in a topic
hearsay ls -r auth | xargs -I{} hearsay cat {}

# Find posts about tokens and read them
hearsay grep "token" | xargs -I{} hearsay cat {}

# Archive all posts under a deprecated topic
hearsay ls -r legacy/old-auth | xargs -I{} hearsay archive {}

# Count posts per top-level topic
hearsay ls -r --status all | while read id; do
  hearsay cat --json "$id" | jq -r .topic | cut -d/ -f1
done | sort | uniq -c | sort -rn

# Create a post from a file
cat postmortem.md | hearsay post incidents/2026-03-07 --title "Staging outage postmortem"

# Pipe grep results into a new post body
hearsay grep "race condition" --json | jq -r '.results[].title' \
  | hearsay post meta/known-races --title "All known race condition posts"
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success. |
| 1 | General error (invalid input, server error). |
| 2 | Post not found. |
| 3 | Connection error (server unreachable). |

---

## Open Questions

- **Auto-detection of author.** For CLI usage, what's a good default? `$USER`, git config `user.name`, or require explicit `--author`?
- **Shell completions.** Ship bash/zsh/fish completions for topic names and post IDs? Nice to have but not MVP.
- **`hearsay server`** subcommand to start a local server from the CLI binary itself? Or separate binary?
