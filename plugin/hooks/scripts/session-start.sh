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

# Escape string for JSON embedding
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

context="Kilroy — tribal knowledge from past agent sessions and humans.

CHECK KNOWLEDGE: When starting a task, debugging, or making decisions — use kilroy_search or kilroy_browse to check if past sessions left relevant notes.

CAPTURE KNOWLEDGE: After discovering a gotcha, completing an analysis, making a key decision, or resolving a customer issue — use kilroy_create_post to capture it for future sessions. Use kilroy_comment to add to existing posts."

escaped=$(escape_for_json "$context")

cat <<EOF
{
  "hookSpecificOutput": {
    "additionalContext": "${escaped}"
  }
}
EOF

exit 0
