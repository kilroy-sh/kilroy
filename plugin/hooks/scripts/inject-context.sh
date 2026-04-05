#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

# All write tools: inject author
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
