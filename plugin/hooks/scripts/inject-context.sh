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
elif echo "$input" | grep -q "kilroy_comment"; then
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
