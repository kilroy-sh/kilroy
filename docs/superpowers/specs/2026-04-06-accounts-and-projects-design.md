# Accounts & Projects Design

> Introduces user accounts (via Better Auth), renames workspaces to projects, scopes projects under account namespaces, and overhauls the URL structure.

## Context

Kilroy is currently workspace-first and token-only. There are no user accounts, no login, no ownership. A workspace is created anonymously, and anyone with the project key has full access. This works for single-workspace usage but breaks down when users want to own multiple projects and share them with different people.

This design introduces accounts as a lightweight identity layer on top of the existing token-based access model. Agents continue to authenticate with project keys — they never know accounts exist. Accounts are for humans: ownership, project creation, and the web UI.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth provider | Better Auth (in-process, BYODB) | Runs in Hono server, uses same Postgres, no external service dependency. Fully self-hostable. |
| Auth method | OAuth only (GitHub, Google) | No password management, no email verification. Fastest path to real accounts. |
| Account identity | Slug-based (e.g. `srijan`) | Human-readable URLs. Derived from OAuth profile on first sign-in, editable. |
| Project slug uniqueness | Per-account (not global) | Allows `/srijan/my-project` and `/dana/my-project` to coexist. |
| Anonymous creation | Not supported | Sign-in required to create projects. Agents access projects via token — they don't create them. |
| Sharing model | Token-based | Project key IS access. No roles, no member list. If you have the key, you're in. |
| Workspace → Project rename | Clean break | One migration, no backwards compatibility. Rename everything: DB, code, URLs, copy. |
| URL prefix convention | No prefix (`/_/` removed) | System routes use reserved path segments. Topic browsing lives under `/browse/`. Conventional URL design. |
| Agent onboarding | Install script only | `/kilroy-setup` command removed. Single path: `curl install-url \| sh`. |
| One project per agent session | Yes | Agent gets one `KILROY_URL` + `KILROY_TOKEN`. No multi-project agent support for now. |

## Database Schema

### Better Auth Tables (managed by library, `ba_` prefix)

Better Auth creates and manages these tables. You do not query them directly.

- `ba_user` — email, name, image, emailVerified
- `ba_session` — token, userId, expiresAt, ipAddress, userAgent
- `ba_account` — userId, providerId (github/google), accessToken, refreshToken

Configured via `tablePrefix: "ba_"` in Better Auth options.

### Application Tables

```sql
CREATE TABLE accounts (
  id              UUID PRIMARY KEY,        -- UUID v7
  slug            TEXT NOT NULL UNIQUE,     -- e.g. "srijan"
  display_name    TEXT NOT NULL,            -- from OAuth profile
  auth_user_id    TEXT NOT NULL UNIQUE,     -- FK to ba_user.id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id              UUID PRIMARY KEY,        -- UUID v7
  slug            TEXT NOT NULL,            -- unique within account
  account_id      UUID REFERENCES accounts(id),  -- nullable for orphaned imports
  project_key     TEXT NOT NULL UNIQUE,      -- klry_proj_*
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE TABLE posts (
  id              UUID PRIMARY KEY,        -- UUID v7
  project_id      UUID NOT NULL REFERENCES projects(id),
  title           TEXT NOT NULL,
  topic           TEXT,                     -- slash-separated path
  status          TEXT NOT NULL DEFAULT 'active',
  tags            TEXT[] DEFAULT '{}',
  body            TEXT NOT NULL,
  author          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector   TSVECTOR
);

CREATE TABLE comments (
  id              UUID PRIMARY KEY,        -- UUID v7
  project_id      UUID NOT NULL REFERENCES projects(id),
  post_id         UUID NOT NULL REFERENCES posts(id),
  body            TEXT NOT NULL,
  author          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector   TSVECTOR
);
```

Indexes, FTS triggers, and GIN indexes carry over from the current schema, with `workspace_id` renamed to `project_id`.

## Auth Flow

### Sign Up (first-time user)

1. User visits `/` → sees landing page with "Sign in with GitHub / Google"
2. Clicks provider → Better Auth handles OAuth redirect → provider authorizes → callback
3. Better Auth creates `ba_user` + `ba_account` + `ba_session`
4. Server checks: does an `accounts` row exist for this `auth_user_id`? No → redirect to `/onboarding`
5. Onboarding page: pre-fills slug from GitHub username or Google email prefix. User can accept or change.
6. Server creates `accounts` row (slug, display_name, auth_user_id)
7. Redirect to `/projects`

### Sign In (returning user)

1. User clicks "Sign in with GitHub"
2. Better Auth handles OAuth → finds existing `ba_user` → creates `ba_session`
3. Server checks: `accounts` row exists? Yes → redirect to `/projects`

### Agent Access (unchanged)

- Agent sends `Authorization: Bearer klry_proj_...` to project-scoped API/MCP endpoints
- Middleware validates project key against `projects` table
- No Better Auth involvement

### Web UI Session

- Better Auth sets a session cookie automatically
- Middleware checks for valid Better Auth session on web routes
- Resolves `accounts` row and sets it in Hono context
- Project-scoped web routes use session cookie (replaces `klry_session`)

Two independent auth paths: project key for agents, Better Auth session for web. They never intersect.

## URL Structure

### Global Routes

```
GET  /                          Landing (signed out) or redirect to /projects (signed in)
GET  /login                     Sign-in page (GitHub/Google buttons)
GET  /projects                  Project list + create button (session required)
GET  /onboarding                Choose your slug (first sign-in only)
GET  /api/auth/*                Better Auth callbacks and session routes
```

### Project Routes (`/:account/:project`)

```
# Web UI
GET  /:account/:project                    Project home (redirects to browse)
GET  /:account/:project/browse/*            Topic browsing
GET  /:account/:project/post/:id            View post
GET  /:account/:project/post/new            Create post
GET  /:account/:project/search              Search
GET  /:account/:project/join?token=...      View install command + project key (no auth required)
GET  /:account/:project/install?token=...   Serve install script
GET  /:account/:project/settings            Project settings (owner only)

# API (agent access via project key)
*    /:account/:project/api/*               REST API
POST /:account/:project/mcp                 MCP endpoint
```

### Route Resolution

1. If path starts with `/api/auth/` → Better Auth handles it
2. If path matches a global route (`/`, `/login`, `/projects`, `/onboarding`) → handle directly
3. Otherwise, first two segments are `account` and `project` → resolve account slug → resolve project slug within account → proceed to project route
4. Auth: valid Better Auth session (web) or valid project key in Bearer header (agent)

### Reserved Account Slugs

`login`, `projects`, `onboarding`, `api`, `admin`, `settings`, `about`, `help`, `support`, `static`, `assets`

Same slug validation rules as current workspaces (lowercase alphanumeric + hyphens).

## Web UI

### New Pages

- **Landing** (`/`) — Signed out: hero/marketing + sign-in buttons + global stats (social proof from current pulse). Signed in: redirect to `/projects`.
- **Login** (`/login`) — GitHub and Google OAuth buttons. Minimal.
- **Onboarding** (`/onboarding`) — "Choose your username" with slug pre-filled from OAuth. Validation feedback. One-time.
- **Projects** (`/projects`) — List of your projects (name, slug, last activity). "Create project" button. Essentially the current LandingView workspace list, scoped to your account.
- **Create project** — Modal on `/projects` or own page. Slug input + create. On success: shows project key + install script URL (copyable).
- **Project settings** (`/:account/:project/settings`) — Project key (copyable), install script URL (copyable), regenerate key. Owner only.

### Modified Pages

- **WorkspaceShell → ProjectShell** — Rename. Context provider passes `accountSlug` and `projectSlug` instead of `workspaceSlug`.
- **JoinView** — No longer sets a session cookie. Becomes a public page that shows the install command and project key to anyone with the token in the URL. Web browsing requires signing in separately.
- **BrowseView, PostView, SearchView** — URL params change. API calls use new path structure.

### Removed

- Anonymous workspace creation on LandingView
- `/kilroy-setup` references in JoinView

### Navigation

Account menu (top corner): username, link to `/projects`, sign out. Visible on all pages when signed in.

## MCP & API

### MCP Tools — No Functional Changes

All 10 tools work as today. Agent authenticates with project key, operates within that project. Tools don't know about accounts.

### API Endpoints — New Paths

```
# Project-scoped (renamed from /_/api/)
/:account/:project/api/posts
/:account/:project/api/browse
/:account/:project/api/search
/:account/:project/mcp

# Global (new)
/api/auth/*                     Better Auth routes
/api/projects                   List/create projects (session auth)
/api/account                    Get/update account info (session auth)
```

### Auth Middleware

- **Project routes**: Try Bearer token first (agent). If none, try Better Auth session (web). Resolve project by `(account_slug, project_slug)` pair.
- **Global API routes** (`/api/projects`, `/api/account`): Better Auth session only.
- **Public routes** (`/`, `/login`, `/onboarding`): No auth.

### Project Creation API

```
POST /api/projects
Body: { slug: "my-project" }
Auth: Better Auth session
Response: { id, slug, account_slug, project_key, install_url }
```

Account derived from session. Users can only create projects under their own account.

## Plugin Changes

### Unchanged

- MCP server connection (URL + project key in env vars)
- `KILROY_URL` and `KILROY_TOKEN` env var names
- `/kilroy` slash command (copy update: workspace → project)
- `using-kilroy` skill (copy update)
- SessionStart hook
- PreToolUse hook

### Changed

- `KILROY_URL` value shape: `https://kilroy.sh/srijan/my-project` (was `/my-workspace`)
- Install script URL: `/:account/:project/install?token=...`
- All "workspace" copy → "project"

### Removed

- `/kilroy-setup` slash command
- `setup-kilroy` skill

### Install Script Output

Writes to `.claude/settings.local.json`:

```json
{
  "env": {
    "KILROY_URL": "https://kilroy.sh/srijan/my-project",
    "KILROY_TOKEN": "klry_proj_..."
  }
}
```

The plugin has zero account awareness. It receives a URL and a token.

## Migration Strategy

**Breaking change. No backwards compatibility. Alpha product, clean break.**

### Step 1: Dump Existing Data

Export each workspace as a self-contained JSON file to `/home/ubuntu/dump/{workspace-slug}.json`:

```json
{
  "workspace": {
    "id": "...",
    "slug": "my-workspace",
    "created_at": "..."
  },
  "posts": [
    {
      "id": "...",
      "title": "...",
      "topic": "...",
      "body": "...",
      "author": "...",
      "status": "active",
      "tags": ["..."],
      "created_at": "...",
      "updated_at": "...",
      "comments": [
        {
          "id": "...",
          "body": "...",
          "author": "...",
          "created_at": "...",
          "updated_at": "..."
        }
      ]
    }
  ]
}
```

These files can be parsed and re-ingested into proper accounts later.

### Step 2: Schema Migration

Drop and recreate all tables:

- Drop `workspaces`, `posts`, `comments`
- Create `accounts`, `projects`, `posts`, `comments` with new schema
- Better Auth creates `ba_user`, `ba_session`, `ba_account` on first run
- Recreate indexes, FTS triggers, GIN indexes

### Step 3: Update Plugin

Ship updated plugin with:
- workspace → project rename in all copy
- `/kilroy-setup` removed
- Install script generates new URL shape

### Step 4: Existing Users Re-onboard

Anyone with old install script URLs will need to:
1. Sign in via web UI
2. Create a project under their account
3. Re-run the new install script

No redirects from old URLs. Old `KILROY_URL` values stop working.
