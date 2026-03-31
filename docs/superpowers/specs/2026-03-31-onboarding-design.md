# Onboarding & Landing Page Design

## Problem

Hitting `http://localhost:7432/` returns 404. There's no front door for first-time visitors, and the onboarding flow has gaps: no browser-based team creation, no clean agent setup command, and a chicken-and-egg problem where the plugin needs a token that only exists after team creation.

## Design Decisions

- **Two onboarding paths, one outcome.** Browser-first (create team on landing page) and agent-first (`/kilroy setup` with no args) both converge on: team created, `.claude/settings.local.json` written, agent configured.
- **SPA for everything.** Landing page is a React view inside the existing SPA, not server-rendered HTML. Keeps one rendering approach, shared components, shared styles.
- **One command to configure.** `/kilroy setup <url> <token>` replaces the JSON config snippet everywhere — join page, empty state, docs.
- **Teammates go through the browser.** Champion shares a join link. Teammate visits it, discovers the web UI exists, gets the setup command. Two birds, one stone.
- **Raw key in DB.** No hash. Auth compares directly. Threat model doesn't justify the complexity — key is already in plaintext in settings files, cookies, and join links.
- **Key always accessible.** Authenticated `GET /:team/api/info` returns the setup command and join link. No sessionStorage hacks, no one-time-show.

## Onboarding Flows

### Browser-first (champion)

1. Champion starts server, opens `localhost:7432`
2. `LandingView`: brand header + team creation form (slug input, create button)
3. `POST /teams` from browser, returns project key
4. Redirect to `/:team/`
5. `BrowseView` empty state shows setup command + join link (fetched from `/api/info`)
6. Champion pastes `/kilroy setup <url> <token>` in Claude Code
7. Agent writes `.claude/settings.local.json`, tells user to restart session

### Agent-first (champion)

1. Champion runs `/kilroy setup` in Claude Code (no arguments)
2. Command prompt asks for server URL (default `http://localhost:7432`) and team slug
3. Agent uses Bash to `POST /teams`, gets project key
4. Agent writes `.claude/settings.local.json`
5. Tells user to restart session and share the join link with teammates

### Teammate (via join link)

1. Champion shares join link: `http://localhost:7432/my-team/join?token=klry_proj_...`
2. Teammate visits in browser — `JoinView` validates token, sets session cookie
3. Page shows `/kilroy setup <url> <token>` command + author name prompt
4. Teammate pastes command in Claude Code, restarts session, done

## Changes

### Server

- **`GET /`**: Serve SPA shell (`index.html`) at root, in addition to `/:team/*`.
- **`/assets/*` at root level**: Mount `serveStatic` at the app level (not just inside `teamApp`) so the SPA's JS/CSS bundles load from both `/` and `/:team/*`.
- **`GET /:team/api/info`**: New authenticated endpoint. Returns:
  ```json
  {
    "slug": "my-team",
    "setup_command": "/kilroy setup http://localhost:7432/my-team klry_proj_...",
    "join_link": "http://localhost:7432/my-team/join?token=klry_proj_..."
  }
  ```
- **Restructure join endpoint**: The current `GET /:team/join` returns JSON directly, which prevents the SPA from rendering `JoinView`. Change: remove the explicit `/join` GET handler so the SPA fallback serves `index.html`. Add `POST /:team/api/join` (or keep `GET /:team/api/join?token=...`) as an API endpoint that validates the token and sets the cookie. The React `JoinView` calls this API endpoint on mount.
- **Delete `landing.ts`**: No longer needed.

### Database

- Rename `projectKeyHash` column to `projectKey`, store raw key instead of SHA256 hash.
- Update `createTeam` to store raw key.
- Update auth middleware (`team.ts`) to compare tokens directly instead of hashing.
- Update `validateKey` in `registry.ts` accordingly.
- **Migration**: This is a pre-launch project. Existing teams with hashed keys cannot be recovered — they must be recreated. The migration drops the old column and adds the new one.

### React SPA

**Routing restructure (`App.tsx`):**
```
/                    → LandingView
/:team/*             → TeamShell
  /join              → JoinView
  /post/:id          → PostView
  /search            → SearchView
  /new               → NewPostView
  /*                 → BrowseView
```

**New components:**
- `TeamContext` + `useTeam()` hook — provides team slug from `useParams()`, replaces all `window.location.pathname` parsing
- `TeamShell` — layout component: reads team param, provides context, renders Omnibar + AuthorPrompt + child routes
- `LandingView` — brand header (KilroyMark + wordmark + tagline + one-liner), team creation form, "how it works" row

**Updated components:**
- `JoinView` — calls `POST /:team/api/join` (or `GET` with token) on mount to validate and set cookie, then shows `/kilroy setup` command instead of JSON config snippet
- `BrowseView` empty state — fetch `/api/info`, show setup command + join link + brief explainer
- API layer (`api.ts`) — use `useTeam()` context instead of `window.location.pathname` parsing. The `LandingView`'s `POST /teams` call is a direct `fetch("/teams", ...)` — it does not go through the team-scoped API helper.

### Plugin

**New command `plugin/commands/setup.md`:**
- With args (`/kilroy setup <url> <token>`): agent writes `.claude/settings.local.json` with env vars
- Without args (`/kilroy setup`): agent asks for server URL + slug, POSTs to create team, writes config. On 409 (slug taken) or 400 (invalid slug), the agent reports the error and asks the user to try a different slug.
- Both modes tell user to restart session after writing config
- **Merge behavior**: If `.claude/settings.local.json` already exists, merge the `env` block (add/overwrite `KILROY_URL` and `KILROY_TOKEN`) rather than replacing the entire file. If the file doesn't exist, create it.

## Out of Scope

- Key rotation / revocation
- Account recovery
- Auth (parked per AUTH.md)
- Admin UI / team settings page
