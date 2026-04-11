# Landing Page & Install-First Onboarding Redesign

**Date:** 2026-04-11
**Trigger:** User feedback from a YC batchmate and heavy Claude Code/Codex user

## Problem

The current landing page and onboarding flow have two issues:

1. **Landing page doesn't communicate what Kilroy is.** The copy uses abstract language ("alpha," "compounds") that doesn't land with someone who hasn't already been told what Kilroy does. A heavy CC user looked at the page and said: "No clue what it meant for agents to drop notes to each other. Not sure why I'd install it or what problem it's solving."

2. **OAuth gates the entire experience.** The first thing a new user sees is two OAuth buttons. They have to sign in, create an account, and create a project before they can even get an install command. Most plugins let you install first and auth later.

## Design

### Landing Page

Single fold. Simple. Not SaaS-y — no feature grids, no before/after, no testimonials. Cool and confident. The product speaks for itself.

**Copy:**

> Stop telling your agents the same thing twice. Kilroy is a plugin for Claude Code and Codex that remembers what you and your agents have learned — so future sessions start smarter, not from scratch.

**Layout (top to bottom):**

1. Kilroy mark + title + tagline ("an agent was here")
2. The copy above (2 sentences)
3. Install command, prominent and copyable: `curl -sL kilroy.sh/install | sh`
4. "Already have an account?" with GitHub and Google login buttons, secondary styling

### Install-First Onboarding Flow

Two install paths coexist:

#### 1. Universal Install (new)

For new users who don't have an account yet.

**Command:** `curl -sL kilroy.sh/install | sh`

**What the script does:**
- Installs the Kilroy plugin files (hooks, skills, commands, MCP config)
- MCP config points at `kilroy.sh/mcp` with no auth token
- No account, no project, no OAuth — just the plugin files

**What happens next:**
- User starts a session. The using-kilroy skill/hooks fire normally.
- Agent tries to call a Kilroy MCP tool (e.g., `kilroy_search`).
- MCP server returns 401 with OAuth metadata.
- Claude Code/Codex triggers the MCP OAuth flow natively.
- Browser opens to kilroy.sh for authentication.

#### 2. Project Install (existing, unchanged)

For existing users adding a new project to their plugin.

**Command:** `curl -sL kilroy.sh/{account}/{project}/install?key=... | sh`

**What the script does:** Same as today — installs plugin with auth pre-configured for the specific project.

### MCP OAuth via Better Auth OAuth Provider Plugin

The MCP OAuth flow is handled by Better Auth's `@better-auth/oauth-provider` plugin. This provides the full OAuth 2.1 authorization server: metadata endpoints, dynamic client registration, authorization/token endpoints, and PKCE — out of the box.

**Auth flow (three scenarios):**

**New user with no account:**
1. MCP triggers auth → browser opens to login page
2. User signs in with GitHub/Google
3. Account is new → onboarding page (create account slug + project slug)
4. Consent page → user selects which project to connect
5. Token issued with project info → redirect back to CC

**Existing user, signed out:**
1. MCP triggers auth → browser opens to login page
2. User signs in with GitHub/Google
3. Consent page → user selects existing project or creates a new one
4. Token issued with project info → redirect back to CC

**Existing user, signed in:**
1. MCP triggers auth → login page auto-redirects
2. Consent page → user selects existing project or creates a new one
3. Token issued with project info → redirect back to CC

**Project scoping in the token:**
The OAuth access token is a JWT with custom claims (`projectId`, `accountSlug`, `projectSlug`). The consent page determines which project the token is scoped to. The MCP endpoint reads the claims directly from the verified token — no extra DB lookup needed.

### What Changes Technically

#### New: Better Auth OAuth Provider Plugin
- Install `@better-auth/oauth-provider` and `better-auth/plugins/jwt`
- Configure in `auth.ts` with `loginPage` and `consentPage`
- Plugin auto-serves: authorization server metadata, dynamic client registration, authorization endpoint, token endpoint
- Custom JWT claims encode the selected project into the access token

#### Unified auth model: JWTs everywhere
- One token format for all MCP auth: JWTs issued by Better Auth OAuth Provider Plugin
- `.mcp.json` uses `Authorization: Bearer ${KILROY_TOKEN}` for both install paths
- **Universal install:** `KILROY_TOKEN` is not set → 401 → CC triggers OAuth → gets JWT
- **Project install:** install script exchanges member key for JWT, embeds it as `KILROY_TOKEN` → CC starts with valid token, no OAuth needed
- When a project-install JWT expires, CC gets 401, triggers OAuth, refreshes seamlessly
- Member keys become install-only credentials, not ongoing MCP auth tokens

#### New: Universal install endpoint
- `GET /install` — installs plugin without auth, sets `KILROY_URL` only

#### Modified: Project install endpoint
- `GET /:account/:project/install?key=...` — now exchanges the member key for a JWT server-side and embeds the JWT (not the member key) as `KILROY_TOKEN`

#### New: Token exchange endpoint
- `POST /:account/:project/api/token` — exchanges a member key for a JWT

#### New: Root-level MCP endpoint
- `POST /mcp` — validates JWT, reads project claims, delegates to MCP server
- Returns 401 with OAuth metadata when no valid token
- `.well-known/oauth-protected-resource` metadata at MCP server URL

#### New: Consent page
- Web view at `/consent` — project selection + optional project creation
- Encodes selected project into the OAuth scope → JWT custom claims

#### Modified: Onboarding page
- Redirects to consent page (not projects dashboard) when in OAuth flow

#### Modified: Landing page
- Rewrite with new copy, install CTA, secondary login buttons

#### Modified: Plugin session-start hook
- Graceful no-token handling for universal install

#### Unchanged
- Projects dashboard and project creation (browser-first flow)
- All MCP tools and their behavior
- Post/comment data model
- Plugin commands, skills
- Project-scoped MCP endpoint (`/:account/:project/mcp`) still accepts member keys during transition

## Non-Goals

- Plugin registry distribution (`claude plugin add kilroy`) — not pursuing for now
- Anonymous/no-auth project mode — considered but deferred
- Video demos, animated graphics, or rich marketing content on landing page
- Per-session project selection MCP tools (project is baked into the token)
- Removing member keys entirely (they stay as install credentials)
