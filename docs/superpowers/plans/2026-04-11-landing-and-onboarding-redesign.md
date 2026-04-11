# Landing Page & Install-First Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the landing page for clarity, add a universal install command, and implement MCP OAuth (via Better Auth OAuth Provider Plugin) so users can install the plugin first and authenticate later when the agent needs it.

**Architecture:** One auth mechanism, one token format. All MCP auth uses JWTs issued by Better Auth's OAuth Provider Plugin. The JWT carries custom claims (`projectId`, `accountSlug`, `projectSlug`) so the MCP endpoint knows which project to scope to.

Two install paths exist but share the same auth model:
- **Universal install** (`curl -sL kilroy.sh/install | sh`): no token. When the agent first uses a Kilroy tool, the `/mcp` endpoint returns 401, CC triggers OAuth natively (login → onboarding → consent/project selection → JWT issued → redirect back).
- **Project install** (`curl -sL kilroy.sh/acme/proj/install?key=... | sh`): the server already knows the user + project. The install endpoint exchanges the member key for a JWT and embeds it in the script. CC starts with a valid token — no OAuth flow needed. When the JWT eventually expires, CC gets 401, triggers OAuth, and refreshes seamlessly (user already has an account by then).

The `.mcp.json` is the same for both: `Authorization: Bearer ${KILROY_TOKEN}`. When `KILROY_TOKEN` is set (project install), CC uses it directly. When empty (universal install), the 401 triggers OAuth. Member keys become install-only credentials (proving you can get a JWT for a project), not ongoing MCP auth tokens.

**Tech Stack:** Hono (server), React/React Router (frontend), PostgreSQL/Drizzle (data), `@better-auth/oauth-provider` + `better-auth/plugins/jwt` (OAuth 2.1), Better Auth (social login)

---

## File Structure

### New files
- `web/src/views/ConsentView.tsx` — OAuth consent page: project selection + optional project creation
- `src/routes/token.ts` — endpoint to exchange a member key for a JWT (used by project install script)

### Modified files
- `src/auth.ts` — add JWT plugin + OAuth Provider Plugin to Better Auth config with custom access token claims
- `src/server.ts` — mount `/install`, `/mcp` (root), `.well-known` metadata endpoints, `/consent` SPA route, token exchange endpoint
- `src/routes/install.ts` — add `universalInstallHandler`; modify project install to embed JWT instead of member key
- `src/members/registry.ts` — add `getProjectByAuthUserId()` to resolve project from Better Auth user ID
- `web/src/views/LandingView.tsx` — rewrite copy and layout
- `web/src/views/OnboardingView.tsx` — redirect to consent page (not projects dashboard) when in OAuth flow
- `web/src/App.tsx` — add `/consent` route
- `web/src/context/AuthContext.tsx` — update `signIn` to accept optional `callbackURL`
- `plugin/hooks/scripts/session-start.sh` — graceful no-token handling

---

### Task 1: Rewrite Landing Page

**Files:**
- Modify: `web/src/views/LandingView.tsx`
- Modify: CSS file (search for `.landing` styles)

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
          Stop telling your agents the same thing twice. Kilroy is a plugin for
          Claude Code and Codex that remembers what you and your agents have
          learned &mdash; so future sessions start smarter, not from scratch.
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

Find the landing page styles in the CSS (search for `.landing` in the main CSS file) and add:

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

- [ ] **Step 3: Remove old stats fetch and unused CSS**

Remove the `stats` state, the `/api/stats` fetch useEffect, and the stats grid JSX from the old LandingView. Remove now-unused CSS classes (`.landing-desc-last`, `.landing-stats`, `.stats-grid`, etc.).

- [ ] **Step 4: Test in browser**

Run: `open http://localhost:5173`

Verify:
- Kilroy mark and title render
- Description is the P2 copy ("Stop telling your agents the same thing twice...")
- Install command is prominent and centered, clicking copies it
- "Already have an account?" with smaller GitHub/Google buttons below
- Logged-in users still redirect to /projects

- [ ] **Step 5: Commit**

```bash
git add web/src/views/LandingView.tsx
git commit -m "feat: rewrite landing page — clear copy, install CTA, secondary login"
```

---

### Task 2: Better Auth OAuth Provider Plugin Setup

**Files:**
- Modify: `src/auth.ts`
- Modify: `package.json` (install dependency)

- [ ] **Step 1: Install the OAuth Provider Plugin**

```bash
bun add @better-auth/oauth-provider
```

- [ ] **Step 2: Configure the plugin in auth.ts**

Update `src/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as authSchema from "./db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  tablePrefix: "ba_",
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      allowDynamicClientRegistration: true,
      customAccessTokenClaims: async (token) => {
        // Parse project scope: "project:{id}:{accountSlug}:{projectSlug}"
        const scopes = (token.scopes || "").split(" ");
        const projectScope = scopes.find((s: string) => s.startsWith("project:"));
        if (!projectScope) return {};

        const [, projectId, accountSlug, projectSlug] = projectScope.split(":");
        return { projectId, accountSlug, projectSlug };
      },
    }),
  ],
});
```

- [ ] **Step 3: Run Better Auth migration to create OAuth tables**

```bash
bunx auth migrate
```

This creates the tables the OAuth Provider Plugin needs (oauth_client, oauth_access_token, oauth_consent, etc.) using Better Auth's own schema. Verify:

```bash
psql "$DATABASE_URL" -c "\dt ba_oauth_*"
```

Expected: tables listed for OAuth clients, tokens, and consent.

If `bunx auth migrate` doesn't work with the current DDL-based setup in `initDatabase()`, generate the SQL instead and add it:

```bash
bunx auth generate
```

Then add the generated DDL to `initDatabase()` in `src/db/index.ts`.

- [ ] **Step 4: Test the setup**

Restart the server:

Run: `bun run src/server.ts` (briefly, then Ctrl+C)

Expected: `Kilroy server running on http://localhost:7432` with no errors.

Verify the OAuth metadata endpoint:

Run: `curl -s http://localhost:7432/api/auth/.well-known/oauth-authorization-server | jq .`

Expected: JSON with `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, etc.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lockb src/auth.ts src/db/index.ts
git commit -m "feat: add Better Auth OAuth Provider Plugin for MCP auth"
```

---

### Task 3: Root-Level MCP Endpoint

**Files:**
- Modify: `src/server.ts`
- Modify: `src/members/registry.ts`

- [ ] **Step 1: Add helper to resolve project from Better Auth user ID**

In `src/members/registry.ts`, add:

```typescript
export async function getProjectByAuthUserId(authUserId: string, projectId: string) {
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
    .where(
      and(
        eq(accounts.authUserId, authUserId),
        eq(projectMembers.projectId, projectId)
      )
    );

  if (rows.length === 0) return null;
  return rows[0];
}
```

- [ ] **Step 2: Add protected resource metadata endpoints**

In `src/server.ts`, add before the project-scoped routes:

```typescript
// Protected Resource Metadata for root MCP endpoint (RFC 9728)
// Some MCP clients look at the server root, others at the MCP URL path
app.get("/.well-known/oauth-protected-resource", (c) => {
  const baseUrl = getBaseUrl(c.req.url);
  return c.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [`${baseUrl}/api/auth`],
    bearer_methods_supported: ["header"],
  });
});

app.get("/mcp/.well-known/oauth-protected-resource", (c) => {
  const baseUrl = getBaseUrl(c.req.url);
  return c.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [`${baseUrl}/api/auth`],
    bearer_methods_supported: ["header"],
  });
});
```

- [ ] **Step 3: Add the root-level MCP endpoint**

In `src/server.ts`:

```typescript
import { createAuthClient } from "better-auth/client";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { getProjectByAuthUserId } from "./members/registry";

const serverAuthClient = createAuthClient({
  plugins: [oauthProviderResourceClient(auth)],
});

app.all("/mcp", async (c) => {
  const baseUrl = getBaseUrl(c.req.url);

  // Check for bearer token
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.length <= 7) {
    return c.json(
      { error: "invalid_token", error_description: "Missing Authorization header" },
      401,
      {
        "WWW-Authenticate": `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      }
    );
  }

  const accessToken = authHeader.slice(7);

  // Verify the JWT via Better Auth
  let payload: any;
  try {
    payload = await serverAuthClient.verifyAccessToken(accessToken, {
      verifyOptions: { issuer: `${baseUrl}/api/auth` },
    });
  } catch {
    return c.json(
      { error: "invalid_token", error_description: "Invalid access token" },
      401,
      {
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      }
    );
  }

  const projectId = payload.projectId;
  const userId = payload.sub || payload.userId;

  if (!projectId || !userId) {
    return c.json(
      { error: "invalid_token", error_description: "Token missing project claims" },
      401,
    );
  }

  // Verify membership
  const membership = await getProjectByAuthUserId(userId, projectId);
  if (!membership) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  // Create MCP server scoped to the project
  const projectUrl = `${baseUrl}/${membership.accountSlug}/${membership.projectSlug}`;
  const mcp = createMcpServer(membership.projectId, membership.memberAccountId, "agent", projectUrl);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcp.connect(transport);
  return transport.handleRequest(c.req.raw);
});
```

- [ ] **Step 4: Test 401 without auth**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:7432/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

Expected: `401`

Run:
```bash
curl -s -D - -X POST http://localhost:7432/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' 2>&1 | grep WWW-Authenticate
```

Expected: header with `resource_metadata` URL present.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/members/registry.ts
git commit -m "feat: root-level /mcp endpoint with JWT verification and OAuth metadata"
```

---

### Task 4: Consent Page (Project Selection)

**Files:**
- Create: `web/src/views/ConsentView.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/context/AuthContext.tsx`
- Modify: `src/server.ts`

- [ ] **Step 1: Update AuthContext to support callbackURL**

In `web/src/context/AuthContext.tsx`, update the `signIn` function:

```typescript
// Update interface
signIn: (provider: string, callbackURL?: string) => Promise<void>;

// Update implementation
const signIn = async (provider: string, callbackURL?: string) => {
  await authClient.signIn.social({
    provider: provider as "github" | "google",
    callbackURL: callbackURL || "/",
  });
};
```

- [ ] **Step 2: Create ConsentView**

Create `web/src/views/ConsentView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { KilroyMark } from '../components/KilroyMark';

interface Project {
  id: string;
  slug: string;
  account_slug: string;
}

export function ConsentView() {
  const { user, account, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || '';
  const scope = params.get('scope') || '';

  useEffect(() => {
    if (loading || !user || !account) return;
    fetch('/api/projects', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const owned = data.owned || [];
        setProjects(owned);
        if (owned.length === 1) setSelectedProjectId(owned[0].id);
      })
      .catch(() => {});
  }, [user, account, loading]);

  const slugPattern = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

  const handleCreateProject = async () => {
    if (!slugPattern.test(newProjectSlug)) {
      setError('3-40 characters, lowercase letters, numbers, and hyphens');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: newProjectSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create project');
        return;
      }
      const project = await res.json();
      setProjects(prev => [...prev, { id: project.id, slug: project.slug, account_slug: account!.slug }]);
      setSelectedProjectId(project.id);
      setNewProjectSlug('');
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleConsent = async () => {
    if (!selectedProjectId) {
      setError('Select a project to connect');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return;

      // Encode project info in scope — customAccessTokenClaims parses this into JWT claims
      const projectScope = `project:${project.id}:${project.account_slug}:${project.slug}`;
      const fullScope = scope ? `${scope} ${projectScope}` : projectScope;

      const res = await fetch('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accept: true, scope: fullScope }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Consent failed');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
      }
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (!user || !account) {
    window.location.href = `/login?callbackURL=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return null;
  }

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={28} />
          <h1 className="landing-title" style={{ fontSize: '1.3rem' }}>Connect to Kilroy</h1>
        </div>

        <p className="landing-desc">Select a project to connect your agent to.</p>

        {projects.length > 0 && (
          <div className="consent-projects">
            {projects.map(p => (
              <label key={p.id} className={`consent-project ${selectedProjectId === p.id ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="project"
                  value={p.id}
                  checked={selectedProjectId === p.id}
                  onChange={() => setSelectedProjectId(p.id)}
                />
                <span className="consent-project-slug">{p.account_slug}/{p.slug}</span>
              </label>
            ))}
          </div>
        )}

        <div className="consent-create">
          <p className="consent-create-label">Or create a new project:</p>
          <div className="consent-create-row">
            <input
              className="onboarding-input"
              type="text"
              value={newProjectSlug}
              onChange={e => setNewProjectSlug(e.target.value.toLowerCase())}
              placeholder="new-project"
            />
            <button
              className="login-btn login-btn-sm login-btn-github"
              onClick={handleCreateProject}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {error && <p className="onboarding-error">{error}</p>}

        <button
          className="login-btn login-btn-github"
          onClick={handleConsent}
          disabled={submitting || !selectedProjectId}
          style={{ marginTop: '1.5rem', width: '100%' }}
        >
          {submitting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add consent route to App.tsx**

In `web/src/App.tsx`:

```typescript
import { ConsentView } from './views/ConsentView';

// Inside <Routes>:
<Route path="/consent" element={<ConsentView />} />
```

- [ ] **Step 4: Add SPA route in server.ts**

In `src/server.ts`, alongside the other SPA routes:

```typescript
app.get("/consent", (c) => c.html(indexHtml));
```

- [ ] **Step 5: Test the consent page**

Navigate to: `http://localhost:5173/consent?client_id=test&scope=openid`

Verify:
- Shows "Connect to Kilroy" with project list
- Can select a project or create a new one
- Connect button disabled until project selected

- [ ] **Step 6: Commit**

```bash
git add web/src/views/ConsentView.tsx web/src/context/AuthContext.tsx web/src/App.tsx src/server.ts
git commit -m "feat: consent page with project selection for MCP OAuth flow"
```

---

### Task 5: Onboarding Flow Update

**Files:**
- Modify: `web/src/views/OnboardingView.tsx`

When onboarding is triggered during an OAuth flow, redirect to the consent page instead of the projects dashboard after account + project creation.

- [ ] **Step 1: Detect OAuth flow and redirect accordingly**

In `web/src/views/OnboardingView.tsx`:

```typescript
// At the top of the component
const searchParams = new URLSearchParams(window.location.search);
const isOAuthFlow = searchParams.has('client_id') || sessionStorage.getItem('oauth_flow') === 'true';

// Preserve OAuth context through onboarding
useEffect(() => {
  if (searchParams.has('client_id')) {
    sessionStorage.setItem('oauth_flow', 'true');
    sessionStorage.setItem('oauth_params', searchParams.toString());
  }
}, []);

// When onboarding completes:
const handleComplete = () => {
  if (isOAuthFlow) {
    const oauthParams = sessionStorage.getItem('oauth_params') || '';
    sessionStorage.removeItem('oauth_flow');
    sessionStorage.removeItem('oauth_params');
    navigate(`/consent?${oauthParams}`);
  } else {
    navigate('/projects');
  }
};
```

- [ ] **Step 2: Wire up the redirect**

Replace the current navigation to `/projects` in the final onboarding step with the `handleComplete()` function.

- [ ] **Step 3: Test**

1. Start an OAuth flow as a new user (no Kilroy account)
2. Verify onboarding shows account slug + project creation
3. After completing, verify redirect to `/consent` (not `/projects`)
4. Verify non-OAuth onboarding still goes to `/projects`

- [ ] **Step 4: Commit**

```bash
git add web/src/views/OnboardingView.tsx
git commit -m "feat: redirect onboarding to consent page during OAuth flow"
```

---

### Task 6: Unified Install Scripts (JWT for Both Paths)

**Files:**
- Modify: `src/routes/install.ts`
- Create: `src/routes/token.ts`
- Modify: `src/server.ts`

Both install paths write JWTs as `KILROY_TOKEN`. The universal install writes no token (OAuth handles it). The project install exchanges the member key for a JWT and embeds it.

- [ ] **Step 1: Create the token exchange endpoint**

Create `src/routes/token.ts` — exchanges a member key for a JWT. This is called by the project install script.

```typescript
import { Hono } from "hono";
import { validateMemberKey } from "../members/registry";
import { auth } from "../auth";

export const tokenHandler = new Hono();

// POST /:account/:project/api/token — exchange member key for JWT
tokenHandler.post("/", async (c) => {
  const url = new URL(c.req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const accountSlug = segments[0];
  const projectSlug = segments[1];

  const body = await c.req.json();
  const key = body.key;

  if (!key) {
    return c.json({ error: "missing_key" }, 400);
  }

  const result = await validateMemberKey(accountSlug, projectSlug, key);
  if (!result.valid) {
    return c.json({ error: "invalid_key" }, 401);
  }

  // Issue a JWT with project claims via Better Auth
  // Use the auth API to create an access token for this member
  const projectScope = `project:${result.projectId}:${accountSlug}:${projectSlug}`;

  const tokenResult = await auth.api.createAccessToken({
    userId: result.memberAccountId,
    scopes: projectScope,
  });

  return c.json({
    access_token: tokenResult.accessToken,
    token_type: "Bearer",
  });
});
```

Note: The exact `auth.api.createAccessToken` call depends on what the OAuth Provider Plugin exposes. If it doesn't expose a direct token minting API, an alternative is to generate a signed JWT manually using the same signing key:

```typescript
import { sign } from "better-auth/plugins/jwt";

const jwt = await sign({
  sub: result.memberAccountId,
  projectId: result.projectId,
  accountSlug,
  projectSlug,
  iss: baseUrl + "/api/auth",
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
});
```

The implementer should check the Better Auth OAuth Provider Plugin API and use whichever approach is available.

- [ ] **Step 2: Mount the token endpoint in server.ts**

In `src/server.ts`, mount inside the project-scoped app (alongside the existing install endpoint, before `projectAuth`):

```typescript
import { tokenHandler } from "./routes/token";

// Token exchange bypasses projectAuth — member key in body IS the auth
projectApp.route("/api/token", tokenHandler);
```

- [ ] **Step 3: Add universal install handler**

In `src/routes/install.ts`, add `generateUniversalInstallScript` and `universalInstallHandler`. The universal script:
- Installs the Codex plugin bundle (reuse the shared helper extracted from existing code)
- Installs the Claude Code plugin
- Sets `KILROY_URL` in `.claude/settings.local.json` (no `KILROY_TOKEN`)
- Final message: "Start a new session — Kilroy will prompt you to connect when needed."

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

The `generateUniversalInstallScript` function follows the same structure as `generateInstallScript` but:
- Only sets `KILROY_URL` (no `KILROY_TOKEN`)
- Omits the Codex MCP server config (`codexConfigToml`) since there's no token to configure
- Omits the Codex project trust block
- Shared code (plugin bundle install, marketplace registration) is extracted into helpers that both functions call

- [ ] **Step 4: Modify project install to embed JWT instead of member key**

In the existing `installHandler.get("/")` in `src/routes/install.ts`, after validating the member key, exchange it for a JWT before generating the script:

```typescript
installHandler.get("/", async (c) => {
  // ... existing validation code ...

  const result = await validateMemberKey(accountSlug, projectSlug, key);
  if (!result.valid) { /* ... existing error ... */ }

  const baseUrl = getBaseUrl(c.req.url);
  const projectUrl = `${baseUrl}/${accountSlug}/${projectSlug}`;

  // Exchange member key for JWT
  const jwt = await mintProjectJwt(result.projectId, result.memberAccountId, accountSlug, projectSlug, baseUrl);

  // Pass JWT instead of raw member key to the script generator
  const script = generateInstallScript(projectUrl, jwt, projectSlug);

  return c.text(script, 200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
  });
});
```

Extract `mintProjectJwt` as a shared function (used by both the install handler and the token exchange endpoint).

- [ ] **Step 5: Mount universal install in server.ts**

```typescript
import { universalInstallHandler } from "./routes/install";

// Universal install — no auth
app.route("/install", universalInstallHandler);
```

- [ ] **Step 6: Test both install paths**

Universal:
```bash
curl -sL http://localhost:7432/install | head -5
```
Expected: `#!/usr/bin/env sh`, `# Kilroy universal installer`

```bash
curl -sL http://localhost:7432/install | grep KILROY_TOKEN
```
Expected: no output

Project:
```bash
curl -sL "http://localhost:7432/{account}/{project}/install?key={existing_key}" | grep KILROY_TOKEN
```
Expected: `KILROY_TOKEN` set to a JWT (starts with `eyJ`)

- [ ] **Step 7: Commit**

```bash
git add src/routes/install.ts src/routes/token.ts src/server.ts
git commit -m "feat: unified JWT auth — universal install + project install both use JWTs"
```

---

### Task 7: Update Plugin Session-Start Hook

**Files:**
- Modify: `plugin/hooks/scripts/session-start.sh`

- [ ] **Step 1: Update the no-token message**

In `plugin/hooks/scripts/session-start.sh`, find:

```bash
if [ -z "${KILROY_TOKEN:-}" ]; then
  using_kilroy="Kilroy is installed but not configured yet. Re-run the install script from the project's web dashboard to connect. Until then, Kilroy MCP tools will not work."
```

Replace with:

```bash
if [ -z "${KILROY_TOKEN:-}" ]; then
  using_kilroy="Kilroy is installed. When you use a Kilroy tool, your agent client will prompt you to sign in and connect a project. Just follow the browser prompt."
```

- [ ] **Step 2: Test**

```bash
unset KILROY_TOKEN
echo '{}' | CLAUDE_ENV_FILE=/tmp/test-env bash plugin/hooks/scripts/session-start.sh
```

Expected: JSON with `additionalContext` containing the new guidance message.

- [ ] **Step 3: Commit**

```bash
git add plugin/hooks/scripts/session-start.sh
git commit -m "feat: update session-start hook for MCP OAuth flow"
```

---

### Task 8: Integration Test

- [ ] **Step 1: Test the full flow end-to-end**

With the dev server running:

1. **Landing page:** Visit `http://localhost:5173` — verify new copy and install command
2. **Universal install:** `curl -sL http://localhost:7432/install | head -5` — verify universal script
3. **OAuth metadata:** `curl -s http://localhost:7432/api/auth/.well-known/oauth-authorization-server | jq .` — verify JSON
4. **Protected resource metadata:** `curl -s http://localhost:7432/.well-known/oauth-protected-resource | jq .` — verify JSON pointing to auth server
5. **MCP 401:** `curl -s -D - -X POST http://localhost:7432/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' 2>&1 | head -10` — verify 401 with `WWW-Authenticate`
6. **Consent page:** Visit `http://localhost:5173/consent?client_id=test&scope=openid` while signed in — verify project selection
7. **Project install (JWT):** `curl -sL "http://localhost:7432/{account}/{project}/install?key={key}" | grep KILROY_TOKEN` — verify JWT (starts with `eyJ`)
8. **Existing project-scoped MCP:** Verify `/:account/:project/mcp` still works with member keys (backwards compat during transition)

- [ ] **Step 2: Fix any issues**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

## Ordering & Dependencies

```
Task 1 (Landing Page) ──────────── independent
Task 7 (Plugin Hook Update) ─────── independent

Task 2 (BA OAuth Plugin) ── Task 3 (Root MCP) ── Task 4 (Consent Page) ── Task 5 (Onboarding Update)
                                                                      └── Task 6 (Unified Install)

Task 8 (Integration Test) ────────── depends on all above
```

Tasks 1 and 7 can run in parallel with each other and with Task 2. Tasks 2→3→4→5 are sequential. Task 6 depends on Task 2 (needs JWT minting). Task 8 is last.
