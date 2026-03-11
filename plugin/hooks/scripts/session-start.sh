#!/usr/bin/env bash
set -eo pipefail

# Default server URL
KILROY_URL="${KILROY_URL:-http://localhost:7432}"

# Gather git context (may not be in a git repo)
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# Session identity
SESSION_ID="claude-session-$(head -c 8 /dev/urandom | xxd -p 2>/dev/null || echo "unknown")"

# Persist as env vars for the session (if CLAUDE_ENV_FILE is available)
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export KILROY_URL=$KILROY_URL" >> "$CLAUDE_ENV_FILE"
  echo "export KILROY_COMMIT_SHA=$COMMIT" >> "$CLAUDE_ENV_FILE"
  echo "export KILROY_BRANCH=$BRANCH" >> "$CLAUDE_ENV_FILE"
  echo "export KILROY_SESSION_ID=$SESSION_ID" >> "$CLAUDE_ENV_FILE"
  echo "export KILROY_CWD=${CLAUDE_PROJECT_DIR:-}" >> "$CLAUDE_ENV_FILE"
fi

cat <<EOF
{
  "hookSpecificOutput": {
    "additionalContext": "Kilroy is available. Past agents and humans may have left notes relevant to your task."
  }
}
EOF

exit 0
