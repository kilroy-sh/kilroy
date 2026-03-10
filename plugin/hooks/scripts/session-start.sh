#!/usr/bin/env bash
set -euo pipefail

# Default server URL for hook scripts. Note: .mcp.json resolves ${KILROY_URL}
# from the user's environment at plugin load time, before this hook runs.
# Users must set KILROY_URL in their shell profile or Claude settings.
KILROY_URL="${KILROY_URL:-http://localhost:7432}"
echo "export KILROY_URL=$KILROY_URL" >> "$CLAUDE_ENV_FILE"

# Gather git context
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# Session identity
SESSION_ID="claude-session-$(head -c 4 /dev/urandom | od -A n -t x1 | tr -d ' \n')"

# Persist as env vars for the session
echo "export KILROY_COMMIT_SHA=$COMMIT" >> "$CLAUDE_ENV_FILE"
echo "export KILROY_BRANCH=$BRANCH" >> "$CLAUDE_ENV_FILE"
echo "export KILROY_SESSION_ID=$SESSION_ID" >> "$CLAUDE_ENV_FILE"
echo "export KILROY_CWD=${CLAUDE_PROJECT_DIR:-}" >> "$CLAUDE_ENV_FILE"

cat <<EOF
{
  "hookSpecificOutput": {
    "additionalContext": "Kilroy tribal knowledge is available. Use kilroy_browse or kilroy_search to find relevant posts. Use /kilroy-post to capture knowledge at the end of a session."
  }
}
EOF

exit 0
