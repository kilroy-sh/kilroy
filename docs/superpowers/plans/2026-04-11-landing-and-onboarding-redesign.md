# Landing Page & Install-First Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the landing page for clarity, add a universal install command, and implement MCP OAuth so users can install the plugin first and authenticate later when the agent needs it.

**Architecture:** The landing page becomes a single-fold page with plain language copy and a `curl` install command as the primary CTA. A new universal install endpoint (`GET /install`) installs the plugin without auth. When an agent first tries to use a Kilroy MCP tool, the server returns a 401 with OAuth metadata. Claude Code/Codex handle the OAuth flow natively — opening a browser where the user logs in, creates an account+project (pre-filled where possible), and gets redirected back. The OAuth access token is a Kilroy member key, so the existing MCP auth middleware works unchanged for project-scoped endpoints.

**Tech Stack:** Hono (server), React/React Router (frontend), PostgreSQL/Drizzle (data), MCP SDK OAuth types, Better Auth (social login)

---

## File Structure

### New files
- `src/oauth/provider.ts` — OAuth business logic: client store, auth code management, token exchange, PKCE
- `src/oauth/routes.ts` — Hono routes: metadata endpoints, /oauth/register, /oauth/authorize (redirect), /oauth/token
- `web/src/views/AuthorizeView.tsx` — React view for the OAuth authorize flow (login + onboarding + redirect)

### Modified files
- `src/server.ts` — mount /install, /mcp (root), and /oauth/* routes
- `src/routes/install.ts` — add `universalInstallHandler` alongside existing project install
- `src/members/registry.ts` — add `validateMemberKeyDirect()` (lookup by key only, no slugs)
- `src/db/index.ts` — add `oauth_clients` and `oauth_codes` tables
- `src/db/schema.ts` — add Drizzle schema for OAuth tables
- `web/src/views/LandingView.tsx` — rewrite copy and layout
- `web/src/App.tsx` — add /oauth/authorize route
- `plugin/hooks/scripts/session-start.sh` — graceful no-token handling for MCP OAuth

---

### Task 1: Rewrite Landing Page

**Files:**
- Modify: `web/src/views/LandingView.tsx`

- [ ] **Step 1: Rewrite the landing page component**

Replace the content of `web/src/views/LandingView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KilroyMark } from '../components/KilroyMark';
import { GitHubIcon, GoogleIcon } from '../components/ProviderIcons';

export function LandingView() {
  const { user, account, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      localStorage.getItem('kilroy_theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user && account) { navigate('/projects'); return; }
    if (user && !account) { navigate('/onboarding'); return; }
  }, [user, account, loading]);

  const installCmd = 'curl -sL kilroy.sh/install | sh';

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return null;

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={36} />
          <h1 className="landing-title">Kilroy <span className="landing-tagline">&mdash; an agent was here.</span></h1>
        </div>

        <p className="landing-desc">
          Kilroy is a plugin for Claude Code and Codex. It gives your agents a shared
          knowledge base &mdash; a place to leave notes for each other so context isn't
          lost between sessions.
        </p>

        <div className="install-cta" onClick={handleCopy} title="Click to copy">
          <code className="install-cmd">{installCmd}</code>
          <span className="install-copy">{copied ? 'Copied' : 'Copy'}</span>
        </div>

        <div className="landing-login">
          <span className="landing-login-label">Already have an account?</span>
          <div className="login-buttons login-buttons-secondary">
            <button className="login-btn login-btn-sm login-btn-github" onClick={() => signIn('github')}>
              <span className="login-btn-icon"><GitHubIcon /></span>
              GitHub
            </button>
            <button className="login-btn login-btn-sm login-btn-google" onClick={() => signIn('google')}>
              <span className="login-btn-icon"><GoogleIcon /></span>
              Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for the install CTA and secondary login buttons**

Find the landing page styles in the CSS (search for `.landing` in `web/src/index.css` or similar) and add:

```css
.install-cta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 2rem auto;
  padding: 0.875rem 1.25rem;
  background: var(--bg-code, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  cursor: pointer;
  max-width: 28rem;
  transition: border-color 0.15s;
}

.install-cta:hover {
  border-color: var(--accent, #C8642A);
}

.install-cmd {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  color: var(--text-primary, #faf6f1);
  user-select: all;
}

.install-copy {
  font-size: 0.75rem;
  color: var(--text-secondary, #8c7e72);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.landing-login {
  margin-top: 2.5rem;
  text-align: center;
}

.landing-login-label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary, #8c7e72);
  margin-bottom: 0.75rem;
}

.login-buttons-secondary {
  justify-content: center;
  gap: 0.75rem;
}

.login-btn-sm {
  font-size: 0.8rem;
  padding: 0.5rem 1rem;
}
```

- [ ] **Step 3: Remove unused stats fetch and old CSS**

Remove the `stats` state, the `/api/stats` fetch useEffect, and the stats grid JSX from the old LandingView. Remove any now-unused CSS classes (`.landing-desc-last`, `.landing-stats`, `.stats-grid`, etc.).

- [ ] **Step 4: Test in browser**

Run: `open http://localhost:5173` (or the dev server URL)

Verify:
- Kilroy mark and title render
- Description is one clear paragraph
- Install command is prominent and centered
- Clicking the install command copies it
- "Already have an account?" with smaller GitHub/Google buttons below
- No stats grid
- Logged-in users still redirect to /projects

- [ ] **Step 5: Commit**

```bash
git add web/src/views/LandingView.tsx web/src/index.css
git commit -m "feat: rewrite landing page — clear copy, install CTA, secondary login"
```

---

### Task 2: Universal Install Endpoint

**Files:**
- Modify: `src/routes/install.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Add the universal install script generator**

In `src/routes/install.ts`, add a new function `generateUniversalInstallScript` below the existing `generateInstallScript` function. This generates a script that installs the plugin without any auth token. The key differences from the project install:
- No `KILROY_TOKEN` is set
- `KILROY_URL` is set to the server base URL (no project path)
- The Claude Code plugin is installed but `.claude/settings.local.json` only gets `KILROY_URL`, not `KILROY_TOKEN`
- Codex gets the plugin bundle installed but no MCP server config in `.codex/config.toml` (MCP auth will handle it)

```typescript
export function generateUniversalInstallScript(baseUrl: string): string {
  const codexPluginFiles = getCodexPluginFiles();
  const codexPluginWriteCommands = renderShellFileWrites(
    "$TARGET_DIR",
    codexPluginFiles,
  );
  const settingsJson = JSON.stringify(
    { env: { KILROY_URL: baseUrl } },
    null,
    2,
  );

  const mergeSettingsPy = `
import json
from pathlib import Path

payload = json.loads('''${settingsJson}''')
path = Path(".claude/settings.local.json")
current = {}
try:
    current = json.loads(path.read_text())
except Exception:
    current = {}

env = current.get("env")
if not isinstance(env, dict):
    env = {}
env.update(payload.get("env", {}))
current["env"] = env

path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(current, indent=2) + "\\n")
`.trim();

  const mergeSettingsJs = `
const fs = require('fs');
const next = ${settingsJson};
const path = '.claude/settings.local.json';
let prev = {};
try { prev = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
prev.env = Object.assign({}, prev.env || {}, next.env);
fs.writeFileSync(path, JSON.stringify(prev, null, 2) + '\\n');
`.trim();

  return `#!/usr/bin/env sh
# Kilroy universal installer
set -eu

PYTHON=""
if command -v python3 >/dev/null 2>&1; then PYTHON=python3;
elif command -v python >/dev/null 2>&1; then PYTHON=python; fi

JS=""
if command -v node >/dev/null 2>&1; then JS=node;
elif command -v bun >/dev/null 2>&1; then JS=bun; fi

CODEX_PLUGIN_READY=0
CLAUDE_READY=0

install_codex_plugin_bundle() {
  TARGET_DIR="$1"
  mkdir -p "$TARGET_DIR"
${codexPluginWriteCommands}
}

# ── 1. Install Codex plugin bundle ──
echo "Installing Kilroy plugin for Codex..."
${renderCodexMarketplaceBlock()}

if [ -n "\${MARKETPLACE_NAME:-}" ]; then
  CODEX_PLUGIN_DIR="$HOME/.agents/plugins/kilroy"
  CODEX_CACHE_DIR="$HOME/.codex/plugins/cache/$MARKETPLACE_NAME/kilroy/local"
  install_codex_plugin_bundle "$CODEX_PLUGIN_DIR"
  install_codex_plugin_bundle "$CODEX_CACHE_DIR"
  CODEX_PLUGIN_READY=1
fi

# ── 2. Install Claude Code plugin ──
if command -v claude >/dev/null 2>&1; then
  echo "Installing Kilroy plugin for Claude Code..."
  claude plugin marketplace add kilroy-sh/kilroy </dev/null 2>/dev/null || true
  if claude plugin install kilroy@kilroy-marketplace --scope local </dev/null; then
    echo "Configuring Claude Code workspace..."
    mkdir -p .claude
    SETTINGS=".claude/settings.local.json"
    if [ -n "$PYTHON" ]; then
      "$PYTHON" - <<'PY'
${mergeSettingsPy}
PY
      CLAUDE_READY=1
    elif [ -n "$JS" ]; then
      $JS -e '${esc(mergeSettingsJs)}'
      CLAUDE_READY=1
    elif [ ! -f "$SETTINGS" ]; then
      cat > "$SETTINGS" <<'EOF_SETTINGS'
${settingsJson}
EOF_SETTINGS
      CLAUDE_READY=1
    else
      echo "Warning: could not merge $SETTINGS without python, node, or bun."
    fi
  else
    echo "Warning: Claude Code plugin install failed."
  fi
else
  echo "Claude Code not found; skipping Claude-specific plugin install."
fi

if [ "$CODEX_PLUGIN_READY" -ne 1 ] && [ "$CLAUDE_READY" -ne 1 ]; then
  echo ""
  echo "Error: could not configure Codex or Claude Code."
  exit 1
fi

echo ""
echo "  Done. Kilroy is installed."
echo "  Start a new session — Kilroy will prompt you to connect when needed."
echo ""
`;
}
```

Note: The marketplace registration block (`MARKETPLACE_NAME=""` through the plugin bundle install) should be extracted from the existing `generateInstallScript` function into a shared helper `renderCodexMarketplaceBlock()` that both functions can call. This includes the `mergeCodexMarketplacePy`, `mergeCodexMarketplaceJs`, `mergeCodexPluginStatePy`, and `mergeCodexPluginStateJs` inline scripts, and the shell block that runs them. The universal installer omits the Codex MCP config and project trust blocks (since there's no token/URL to configure yet).

- [ ] **Step 2: Add the universal install route handler**

Add a new exported Hono router for the universal install endpoint in `src/routes/install.ts`:

```typescript
export const universalInstallHandler = new Hono();

universalInstallHandler.get("/", (c) => {
  const baseUrl = getBaseUrl(c.req.url);
  const script = generateUniversalInstallScript(baseUrl);
  return c.text(script, 200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
  });
});
```

- [ ] **Step 3: Mount the universal install route in server.ts**

In `src/server.ts`, import and mount the universal install handler. Add it BEFORE the project-scoped routes so `/install` is matched at root level:

```typescript
import { universalInstallHandler } from "./routes/install";

// ... after stats route, before project routes:

// Universal install — no auth
app.route("/install", universalInstallHandler);
```

- [ ] **Step 4: Test the universal install endpoint**

Run: `curl -sL http://localhost:7432/install | head -20`

Expected: A shell script starting with `#!/usr/bin/env sh` and `# Kilroy universal installer` that does NOT contain any `KILROY_TOKEN` references.

Verify: `curl -sL http://localhost:7432/install | grep KILROY_TOKEN` should return nothing.

- [ ] **Step 5: Commit**

```bash
git add src/routes/install.ts src/server.ts
git commit -m "feat: add universal install endpoint at /install (no auth required)"
```

---

### Task 3: Member Key Lookup Without Project Slugs

**Files:**
- Modify: `src/members/registry.ts`

- [ ] **Step 1: Write the test**

Create `src/members/registry.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { validateMemberKeyDirect } from "./registry";

describe("validateMemberKeyDirect", () => {
  test("returns invalid for non-existent key", async () => {
    const result = await validateMemberKeyDirect("klry_proj_nonexistent");
    expect(result.valid).toBe(false);
  });

  test("returns invalid for empty key", async () => {
    const result = await validateMemberKeyDirect("");
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/members/registry.test.ts`

Expected: FAIL — `validateMemberKeyDirect` not found.

- [ ] **Step 3: Implement validateMemberKeyDirect**

In `src/members/registry.ts`, add:

```typescript
export async function validateMemberKeyDirect(
  key: string
): Promise<
  | { valid: true; projectId: string; memberAccountId: string; accountSlug: string; projectSlug: string }
  | { valid: false }
> {
  if (!key) return { valid: false };

  const rows = await db
    .select({
      projectId: projectMembers.projectId,
      memberAccountId: projectMembers.accountId,
      accountSlug: accounts.slug,
      projectSlug: projects.slug,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .innerJoin(accounts, eq(projects.accountId, accounts.id))
    .where(eq(projectMembers.memberKey, key));

  if (rows.length === 0) return { valid: false };

  return {
    valid: true,
    projectId: rows[0].projectId,
    memberAccountId: rows[0].memberAccountId,
    accountSlug: rows[0].accountSlug,
    projectSlug: rows[0].projectSlug,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/members/registry.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/members/registry.ts src/members/registry.test.ts
git commit -m "feat: add validateMemberKeyDirect — lookup member key without project slugs"
```

---

### Task 4: OAuth Data Model

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add OAuth tables to Drizzle schema**

In `src/db/schema.ts`, add at the bottom:

```typescript
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret").notNull(),
  redirectUris: text("redirect_uris").notNull(), // JSON array
  clientName: text("client_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthCodes = pgTable("oauth_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  clientId: text("client_id").notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Add migration DDL in initDatabase**

In `src/db/index.ts`, add before the indexes block:

```typescript
  // OAuth tables for MCP auth flow
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      client_secret TEXT NOT NULL,
      redirect_uris TEXT NOT NULL,
      client_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS oauth_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL DEFAULT 'S256',
      redirect_uri TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
```

- [ ] **Step 3: Test the migration**

Restart the server and check logs for errors:

Run: `bun run src/server.ts` (briefly, then Ctrl+C)

Expected: `Kilroy server running on http://localhost:7432` with no SQL errors.

Verify tables exist:

Run: `psql "$DATABASE_URL" -c "\dt oauth_*"`

Expected: Two tables listed: `oauth_clients` and `oauth_codes`.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/index.ts
git commit -m "feat: add OAuth tables for MCP auth flow (clients + auth codes)"
```

---

### Task 5: OAuth Provider Implementation

**Files:**
- Create: `src/oauth/provider.ts`

This file contains all OAuth business logic: client registration, authorization code generation, PKCE verification, and token exchange. It produces member keys as access tokens.

- [ ] **Step 1: Create the OAuth provider**

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db";
import { oauthClients, oauthCodes } from "../db/schema";
import { uuidv7 } from "../lib/uuid";

// --- Client Registration ---

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function registerClient(params: {
  redirectUris: string[];
  clientName?: string;
}): Promise<{ clientId: string; clientSecret: string }> {
  const id = uuidv7();
  const clientId = `kilroy_client_${generateSecret().slice(0, 16)}`;
  const clientSecret = generateSecret();

  await db.insert(oauthClients).values({
    id,
    clientId,
    clientSecret,
    redirectUris: JSON.stringify(params.redirectUris),
    clientName: params.clientName ?? null,
  });

  return { clientId, clientSecret };
}

export async function getClient(clientId: string) {
  const [row] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId));
  if (!row) return null;
  return {
    ...row,
    redirectUris: JSON.parse(row.redirectUris) as string[],
  };
}

export async function validateClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  const client = await getClient(clientId);
  if (!client) return false;
  return client.clientSecret === clientSecret;
}

// --- Authorization Codes ---

export async function createAuthCode(params: {
  clientId: string;
  accountId: string;
  projectId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
}): Promise<string> {
  const id = uuidv7();
  const code = generateSecret();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(oauthCodes).values({
    id,
    code,
    clientId: params.clientId,
    accountId: params.accountId,
    projectId: params.projectId,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    redirectUri: params.redirectUri,
    expiresAt,
  });

  return code;
}

export async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<
  | { valid: true; accountId: string; projectId: string }
  | { valid: false; error: string }
> {
  // Validate client credentials
  const clientValid = await validateClientCredentials(params.clientId, params.clientSecret);
  if (!clientValid) return { valid: false, error: "invalid_client" };

  // Look up and consume the code
  const [row] = await db
    .select()
    .from(oauthCodes)
    .where(eq(oauthCodes.code, params.code));

  if (!row) return { valid: false, error: "invalid_grant" };

  // Delete the code (one-time use)
  await db.delete(oauthCodes).where(eq(oauthCodes.code, params.code));

  // Verify expiry
  if (new Date() > row.expiresAt) return { valid: false, error: "invalid_grant" };

  // Verify client
  if (row.clientId !== params.clientId) return { valid: false, error: "invalid_grant" };

  // Verify redirect URI
  if (row.redirectUri !== params.redirectUri) return { valid: false, error: "invalid_grant" };

  // Verify PKCE
  const valid = await verifyPkce(params.codeVerifier, row.codeChallenge, row.codeChallengeMethod);
  if (!valid) return { valid: false, error: "invalid_grant" };

  return { valid: true, accountId: row.accountId, projectId: row.projectId };
}

// --- PKCE ---

async function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): Promise<boolean> {
  if (method !== "S256") return false;

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return computed === codeChallenge;
}

// Note: expired codes are rejected during exchange (expiry check above).
// No separate cleanup job needed for MVP — codes are deleted on use.
```

- [ ] **Step 2: Write tests for PKCE and code exchange**

Create `src/oauth/provider.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";

// Test PKCE verification independently
async function computeS256Challenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

describe("PKCE S256", () => {
  test("generates valid challenge from verifier", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await computeS256Challenge(verifier);
    // RFC 7636 test vector
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `bun test src/oauth/provider.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/oauth/provider.ts src/oauth/provider.test.ts
git commit -m "feat: OAuth provider — client registration, auth codes, PKCE verification"
```

---

### Task 6: OAuth Routes (Server-Side)

**Files:**
- Create: `src/oauth/routes.ts`
- Modify: `src/server.ts`

These routes implement the MCP OAuth 2.1 spec: metadata discovery, dynamic client registration, authorization redirect, and token exchange.

- [ ] **Step 1: Create the OAuth routes**

Create `src/oauth/routes.ts`:

```typescript
import { Hono } from "hono";
import { getBaseUrl } from "../lib/url";
import { registerClient, getClient, exchangeCode, createAuthCode } from "./provider";
import { getMemberKey } from "../members/registry";
import { auth } from "../auth";
import { getAccountByAuthUserId } from "../accounts/registry";
import type { Env } from "../types";

export const oauthRoutes = new Hono();

// RFC 8414: Authorization Server Metadata
oauthRoutes.get("/.well-known/oauth-authorization-server", (c) => {
  const baseUrl = getBaseUrl(c.req.url);
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp:access"],
  });
});

// RFC 7591: Dynamic Client Registration
oauthRoutes.post("/oauth/register", async (c) => {
  const body = await c.req.json();
  const redirectUris = body.redirect_uris;

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return c.json({ error: "invalid_client_metadata" }, 400);
  }

  const result = await registerClient({
    redirectUris,
    clientName: body.client_name,
  });

  return c.json({
    client_id: result.clientId,
    client_secret: result.clientSecret,
    redirect_uris: redirectUris,
    client_name: body.client_name,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  }, 201);
});

// Authorization endpoint — redirects to the web UI authorize page
oauthRoutes.get("/oauth/authorize", (c) => {
  const baseUrl = getBaseUrl(c.req.url);
  // Forward all OAuth params to the SPA authorize view
  const params = new URL(c.req.url).searchParams;
  return c.redirect(`${baseUrl}/oauth/authorize/consent?${params.toString()}`);
});

// Authorization callback — called by the SPA after user completes login + onboarding
// This is a POST from the web UI, not from the MCP client
oauthRoutes.post("/oauth/authorize/complete", async (c) => {
  const body = await c.req.json();
  const { client_id, code_challenge, code_challenge_method, redirect_uri, state } = body;

  // Verify the user is logged in via Better Auth session
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "not_authenticated" }, 401);
  }

  // Look up the user's Kilroy account
  const account = await getAccountByAuthUserId(session.user.id);
  if (!account) {
    return c.json({ error: "no_account" }, 400);
  }

  // Get the project ID from the request (the SPA sends it after onboarding)
  const projectId = body.project_id;
  if (!projectId) {
    return c.json({ error: "no_project" }, 400);
  }

  // Validate the client
  const client = await getClient(client_id);
  if (!client) {
    return c.json({ error: "invalid_client" }, 400);
  }

  // Validate redirect_uri against registered URIs
  if (!client.redirectUris.includes(redirect_uri)) {
    return c.json({ error: "invalid_redirect_uri" }, 400);
  }

  // Create authorization code
  const code = await createAuthCode({
    clientId: client_id,
    accountId: account.id,
    projectId,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method || "S256",
    redirectUri: redirect_uri,
  });

  // Return the redirect URL for the SPA to navigate to
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return c.json({ redirect_url: redirectUrl.toString() });
});

// Token endpoint — exchanges auth code for access token (member key)
oauthRoutes.post("/oauth/token", async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const code = body.code as string;
  const clientId = body.client_id as string;
  const clientSecret = body.client_secret as string;
  const codeVerifier = body.code_verifier as string;
  const redirectUri = body.redirect_uri as string;

  if (!code || !clientId || !clientSecret || !codeVerifier || !redirectUri) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const result = await exchangeCode({
    code,
    clientId,
    clientSecret,
    codeVerifier,
    redirectUri,
  });

  if (!result.valid) {
    return c.json({ error: result.error }, 400);
  }

  // Get the member key for this account+project — this IS the access token
  const memberKey = await getMemberKey(result.projectId, result.accountId);
  if (!memberKey) {
    return c.json({ error: "server_error" }, 500);
  }

  return c.json({
    access_token: memberKey,
    token_type: "Bearer",
    scope: "mcp:access",
  });
});
```

- [ ] **Step 2: Mount OAuth routes and protected resource metadata in server.ts**

In `src/server.ts`, add:

```typescript
import { oauthRoutes } from "./oauth/routes";

// OAuth routes — auth server metadata, registration, authorize, token
app.route("/", oauthRoutes);

// RFC 9728: Protected Resource Metadata for the root MCP endpoint
app.get("/mcp/.well-known/oauth-protected-resource", (c) => {
  const baseUrl = getBaseUrl(c.req.url);
  return c.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:access"],
  });
});
```

Mount these BEFORE the project-scoped routes in `server.ts`.

- [ ] **Step 3: Test metadata endpoints**

Run:
```bash
curl -s http://localhost:7432/.well-known/oauth-authorization-server | jq .
curl -s http://localhost:7432/mcp/.well-known/oauth-protected-resource | jq .
```

Expected: JSON metadata with correct URLs.

- [ ] **Step 4: Test client registration**

Run:
```bash
curl -s -X POST http://localhost:7432/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["http://localhost:3000/callback"], "client_name": "test"}' | jq .
```

Expected: JSON with `client_id`, `client_secret`, `redirect_uris`.

- [ ] **Step 5: Commit**

```bash
git add src/oauth/routes.ts src/server.ts
git commit -m "feat: OAuth routes — metadata, client registration, authorize, token exchange"
```

---

### Task 7: Root-Level MCP Endpoint

**Files:**
- Modify: `src/server.ts`

This endpoint handles MCP requests at `/mcp` (root level, not project-scoped). It validates the bearer token to resolve the project, or returns 401 to trigger OAuth.

- [ ] **Step 1: Add the root-level MCP endpoint**

In `src/server.ts`, add the root `/mcp` route (after OAuth routes, before project-scoped routes):

```typescript
import { validateMemberKeyDirect } from "./members/registry";

// Root-level MCP endpoint — resolves project from bearer token, or triggers OAuth
app.all("/mcp", async (c) => {
  const baseUrl = getBaseUrl(c.req.url);

  // Check for bearer token
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.length <= 7) {
    return c.json(
      { error: "invalid_token", error_description: "Missing or invalid Authorization header" },
      401,
      {
        "WWW-Authenticate": `Bearer resource_metadata="${baseUrl}/mcp/.well-known/oauth-protected-resource"`,
      }
    );
  }

  const token = authHeader.slice(7);
  const result = await validateMemberKeyDirect(token);

  if (!result.valid) {
    return c.json(
      { error: "invalid_token", error_description: "Invalid access token" },
      401,
      {
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${baseUrl}/mcp/.well-known/oauth-protected-resource"`,
      }
    );
  }

  // Create MCP server scoped to the resolved project
  const projectUrl = `${baseUrl}/${result.accountSlug}/${result.projectSlug}`;
  const mcp = createMcpServer(result.projectId, result.memberAccountId, "agent", projectUrl);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcp.connect(transport);
  return transport.handleRequest(c.req.raw);
});
```

- [ ] **Step 2: Verify the endpoint returns 401 without auth**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:7432/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

Expected: `401`

Run:
```bash
curl -s -X POST http://localhost:7432/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' \
  -D - 2>/dev/null | head -10
```

Expected: Response headers include `WWW-Authenticate: Bearer resource_metadata="..."`.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: root-level /mcp endpoint — resolves project from token, 401 triggers OAuth"
```

---

### Task 8: OAuth Authorize Frontend

**Files:**
- Create: `web/src/views/AuthorizeView.tsx`
- Modify: `web/src/App.tsx`

This view handles the browser-side of the OAuth flow. When Claude Code opens the browser for MCP auth, the user lands here. It handles: login (if needed) → account creation (if needed) → project creation (if needed) → redirect back with auth code.

- [ ] **Step 1: Create AuthorizeView component**

Create `web/src/views/AuthorizeView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { KilroyMark } from '../components/KilroyMark';
import { GitHubIcon, GoogleIcon } from '../components/ProviderIcons';

type Step = 'login' | 'account' | 'project' | 'redirecting';

export function AuthorizeView() {
  const { user, account, loading, signIn, refreshAccount } = useAuth();
  const [step, setStep] = useState<Step>('login');
  const [accountSlug, setAccountSlug] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Parse OAuth params from URL
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const codeChallengeMethod = params.get('code_challenge_method') || 'S256';
  const state = params.get('state') || '';
  const scope = params.get('scope') || '';

  // Determine step based on auth state
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStep('login');
      return;
    }
    if (!account) {
      setStep('account');
      // Fetch slug suggestion
      fetch('/api/account/slug-suggestion', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.suggestion) setAccountSlug(data.suggestion);
        })
        .catch(() => {});
      return;
    }
    // User has account — proceed to project creation
    setStep('project');
  }, [user, account, loading]);

  const slugPattern = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

  const handleSignIn = (provider: string) => {
    // Preserve OAuth params through the social login redirect
    const callbackUrl = `/oauth/authorize/consent?${params.toString()}`;
    signIn(provider, callbackUrl);
  };

  const handleCreateAccount = async () => {
    if (!slugPattern.test(accountSlug)) {
      setError('3-40 characters, lowercase letters, numbers, and hyphens');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: accountSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create account');
        return;
      }
      await refreshAccount();
      setStep('project');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!slugPattern.test(projectSlug)) {
      setError('3-40 characters, lowercase letters, numbers, and hyphens');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: projectSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create project');
        return;
      }
      const project = await res.json();

      // Complete the OAuth authorization
      setStep('redirecting');
      const authRes = await fetch('/oauth/authorize/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          redirect_uri: redirectUri,
          state,
          project_id: project.id,
        }),
      });

      if (!authRes.ok) {
        const data = await authRes.json();
        setError(data.error || 'Authorization failed');
        setStep('project');
        return;
      }

      const { redirect_url } = await authRes.json();
      window.location.href = redirect_url;
    } catch {
      setError('Network error');
      setStep('project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={28} />
          <h1 className="landing-title" style={{ fontSize: '1.3rem' }}>Connect to Kilroy</h1>
        </div>

        {step === 'login' && (
          <>
            <p className="landing-desc">Sign in to connect your agent to Kilroy.</p>
            <div className="login-buttons">
              <button className="login-btn login-btn-github" onClick={() => handleSignIn('github')}>
                <span className="login-btn-icon"><GitHubIcon /></span>
                Continue with GitHub
              </button>
              <button className="login-btn login-btn-google" onClick={() => handleSignIn('google')}>
                <span className="login-btn-icon"><GoogleIcon /></span>
                Continue with Google
              </button>
            </div>
          </>
        )}

        {step === 'account' && (
          <>
            <p className="landing-desc">Pick a handle for your Kilroy account.</p>
            <div className="onboarding-form">
              <div className="onboarding-preview">kilroy.sh/{accountSlug || '...'}</div>
              <input
                className="onboarding-input"
                type="text"
                value={accountSlug}
                onChange={e => setAccountSlug(e.target.value.toLowerCase())}
                placeholder="your-handle"
                autoFocus
              />
              {error && <p className="onboarding-error">{error}</p>}
              <button
                className="login-btn login-btn-github"
                onClick={handleCreateAccount}
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {step === 'project' && (
          <>
            <p className="landing-desc">Name your first project.</p>
            <div className="onboarding-form">
              <div className="onboarding-preview">kilroy.sh/{account?.slug}/{projectSlug || '...'}</div>
              <input
                className="onboarding-input"
                type="text"
                value={projectSlug}
                onChange={e => setProjectSlug(e.target.value.toLowerCase())}
                placeholder="my-project"
                autoFocus
              />
              {error && <p className="onboarding-error">{error}</p>}
              <button
                className="login-btn login-btn-github"
                onClick={handleCreateProject}
                disabled={submitting}
              >
                {submitting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </>
        )}

        {step === 'redirecting' && (
          <p className="landing-desc">Redirecting back to your agent...</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update signIn to accept callbackURL**

In `web/src/context/AuthContext.tsx`, update the `signIn` function to accept an optional `callbackURL` parameter:

```typescript
// Change the interface
signIn: (provider: string, callbackURL?: string) => Promise<void>;

// Change the implementation
const signIn = async (provider: string, callbackURL?: string) => {
  await authClient.signIn.social({
    provider: provider as "github" | "google",
    callbackURL: callbackURL || "/",
  });
};
```

- [ ] **Step 3: Add the route in App.tsx**

In `web/src/App.tsx`, import `AuthorizeView` and add the route:

```typescript
import { AuthorizeView } from './views/AuthorizeView';

// Inside <Routes>:
<Route path="/oauth/authorize/consent" element={<AuthorizeView />} />
```

- [ ] **Step 4: Add SPA route in server.ts**

In `src/server.ts`, add the SPA route for the authorize consent page, alongside the other SPA routes:

```typescript
app.get("/oauth/authorize/consent", (c) => c.html(indexHtml));
```

- [ ] **Step 5: Test the authorize flow in browser**

Navigate to: `http://localhost:5173/oauth/authorize/consent?client_id=test&redirect_uri=http://localhost:3000/callback&code_challenge=test&state=test123`

Verify:
- Shows "Connect to Kilroy" with login buttons if not signed in
- After login, shows account creation step if new user
- After account, shows project creation step
- Has Kilroy branding throughout

- [ ] **Step 6: Commit**

```bash
git add web/src/views/AuthorizeView.tsx web/src/context/AuthContext.tsx web/src/App.tsx src/server.ts
git commit -m "feat: OAuth authorize frontend — login, onboarding, and redirect flow"
```

---

### Task 9: Update Plugin for Universal Install

**Files:**
- Modify: `plugin/hooks/scripts/session-start.sh`

The session-start hook needs to handle the case where `KILROY_TOKEN` is not set (universal install). Instead of showing a "not configured" warning, it should let the agent know MCP auth will handle connection automatically.

- [ ] **Step 1: Update the no-token message in session-start.sh**

Find this block in `plugin/hooks/scripts/session-start.sh`:

```bash
if [ -z "${KILROY_TOKEN:-}" ]; then
  using_kilroy="Kilroy is installed but not configured yet. Re-run the install script from the project's web dashboard to connect. Until then, Kilroy MCP tools will not work."
```

Replace with:

```bash
if [ -z "${KILROY_TOKEN:-}" ]; then
  using_kilroy="Kilroy is installed. When you use a Kilroy tool, your agent client will prompt you to sign in and connect a project. Just follow the browser prompt."
```

- [ ] **Step 2: Test the hook**

Run:
```bash
unset KILROY_TOKEN
echo '{}' | CLAUDE_ENV_FILE=/tmp/test-env bash plugin/hooks/scripts/session-start.sh
```

Expected: JSON with `additionalContext` containing the new message about MCP auth.

- [ ] **Step 3: Commit**

```bash
git add plugin/hooks/scripts/session-start.sh
git commit -m "feat: update session-start hook — guide users to MCP auth when no token set"
```

---

### Task 10: Integration Test — Full OAuth Flow

- [ ] **Step 1: Manual end-to-end test**

With the dev server running:

1. Visit `http://localhost:5173` — verify landing page has new copy and install command
2. Run `curl -sL http://localhost:7432/install | head -5` — verify universal install script
3. Run `curl -s http://localhost:7432/.well-known/oauth-authorization-server | jq .` — verify metadata
4. Register a test client:
   ```bash
   CLIENT=$(curl -s -X POST http://localhost:7432/oauth/register \
     -H "Content-Type: application/json" \
     -d '{"redirect_uris": ["http://localhost:3000/callback"]}')
   echo $CLIENT | jq .
   ```
5. POST to `/mcp` without auth — verify 401 with `WWW-Authenticate` header:
   ```bash
   curl -s -D - -X POST http://localhost:7432/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' 2>&1 | head -10
   ```
6. Visit the authorize URL in browser (using client_id from step 4)
7. Complete login + onboarding
8. Verify redirect back with auth code
9. Exchange code for token at `/oauth/token`
10. Use the token to call `/mcp` — verify MCP tools work

- [ ] **Step 2: Verify existing project install still works**

Run: `curl -sL http://localhost:7432/{account}/{project}/install?key={existing_key} | head -5`

Expected: Project-specific install script with `KILROY_TOKEN` set — unchanged from before.

- [ ] **Step 3: Commit any fixes from integration testing**

```bash
git add -A
git commit -m "fix: integration test fixes for OAuth flow"
```

---

## Ordering & Dependencies

```
Task 1 (Landing Page) ─────────────────── independent
Task 2 (Universal Install) ─────────────── independent
Task 3 (Member Key Lookup) ─┐
Task 4 (OAuth Data Model) ──┤
                             ├── Task 5 (OAuth Provider) ── Task 6 (OAuth Routes) ── Task 7 (Root MCP) ── Task 8 (Authorize Frontend)
Task 9 (Plugin Update) ─────────────────── independent
Task 10 (Integration Test) ─────────────── depends on all above
```

Tasks 1, 2, 3, 4, and 9 can run in parallel. Tasks 5→6→7→8 are sequential. Task 10 is last.
