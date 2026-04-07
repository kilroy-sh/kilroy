import { Hono } from "hono";
import { validateMemberKey } from "../members/registry";
import { getBaseUrl } from "../lib/url";

/**
 * GET /:account/:project/install?key=... — serves a Claude Code shell script
 * that fully sets up Kilroy for a project in one shot. Teammate runs:
 *
 *   curl -sL https://kilroy.sh/acme/my-project/install?key=klry_mem_... | sh
 *
 * The script:
 *  1. Installs the Kilroy plugin via `claude plugin` CLI
 *  2. Configures KILROY_URL + KILROY_TOKEN in .claude/settings.local.json
 */
export const installHandler = new Hono();

installHandler.get("/", async (c) => {
  const url = new URL(c.req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const accountSlug = segments[0];
  const projectSlug = segments[1];
  const key = c.req.query("key");
  const legacyToken = c.req.query("token");

  if (!key && legacyToken) {
    return c.text(
      "echo 'Error: the ?token= parameter is no longer supported.'\necho 'Ask your project admin for a fresh install link using ?key=.'\nexit 1",
      400,
      { "Content-Type": "text/plain" },
    );
  }

  if (!key) {
    return c.text(
      "echo 'Error: missing key. Use the install link from your project admin.'\nexit 1",
      400,
      { "Content-Type": "text/plain" },
    );
  }

  const result = await validateMemberKey(accountSlug, projectSlug, key);
  if (!result.valid) {
    return c.text(
      "echo 'Error: invalid key. Ask your project admin for a fresh install link.'\nexit 1",
      401,
      { "Content-Type": "text/plain" },
    );
  }

  const baseUrl = getBaseUrl(c.req.url);
  const projectUrl = `${baseUrl}/${accountSlug}/${projectSlug}`;

  const script = generateInstallScript(projectUrl, key, projectSlug);

  return c.text(script, 200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
  });
});

function generateInstallScript(
  projectUrl: string,
  token: string,
  slug: string,
): string {
  const settingsJson = JSON.stringify(
    { env: { KILROY_URL: projectUrl, KILROY_TOKEN: token } },
    null,
    2,
  );

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
# Kilroy installer for project "${slug}"
set -eu

# ── Preflight ──
if ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude CLI not found. Install Claude Code first:"
  echo "  https://docs.anthropic.com/en/docs/claude-code"
  exit 1
fi

# Find a JS runtime for JSON merging
JS=""
if command -v node >/dev/null 2>&1; then JS=node;
elif command -v bun >/dev/null 2>&1; then JS=bun; fi

# ── 1. Install the Kilroy plugin ──
echo "Installing Kilroy plugin..."
claude plugin marketplace add kilroy-sh/kilroy </dev/null 2>/dev/null || true
claude plugin install kilroy@kilroy-marketplace --scope local </dev/null

# ── 2. Configure workspace connection ──
echo "Configuring project ${slug}..."
mkdir -p .claude
SETTINGS=".claude/settings.local.json"
if [ -n "$JS" ]; then
  $JS -e '${esc(mergeSettingsJs)}'
else
  printf '%s\\n' '${esc(settingsJson)}' > "$SETTINGS"
fi

echo ""
echo "  Done. Kilroy is ready."
echo "  Start a new Claude Code session in this project to connect."
echo ""
`;
}

/** Escape a string for embedding in a single-quoted shell string. */
function esc(s: string): string {
  return s.replace(/'/g, "'\\''");
}
