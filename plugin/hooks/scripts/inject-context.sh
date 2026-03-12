#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

if echo "$input" | grep -q "kilroy_create_post"; then
  # Inject author and commit_sha; refresh commit in case agent made commits
  CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "${KILROY_COMMIT_SHA:-}")
  cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": {
      "author": "${KILROY_SESSION_ID:-}",
      "commit_sha": "$CURRENT_COMMIT"
    }
  }
}
EOF
else
  # All other write tools: inject author only (no commit_sha for edits)
  cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": {
      "author": "${KILROY_SESSION_ID:-}"
    }
  }
}
EOF
fi
