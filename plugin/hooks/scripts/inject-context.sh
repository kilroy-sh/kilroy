#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

# Best available identity: git > claude account > OS username
if author=$(git config user.name 2>/dev/null) && [ -n "$author" ]; then
  :
elif [ -n "${CLAUDE_ACCOUNT_EMAIL:-}" ]; then
  author="$CLAUDE_ACCOUNT_EMAIL"
elif [ -n "${USER:-}" ]; then
  author="$USER"
else
  author=$(whoami 2>/dev/null || echo "unknown")
fi

# Session tag for correlating posts from the same conversation
session_id=$(printf '%s' "$input" | jq -r '.session_id // empty')
session_tag="session:${session_id:0:8}"

# Merge author + session tag into tool_input (updatedInput must be complete)
updated=$(printf '%s' "$input" | jq -c \
  --arg author "$author" \
  --arg session_tag "$session_tag" \
  '.tool_input + {author: $author, tags: ((.tool_input.tags // []) + [$session_tag] | unique)}')

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":%s}}\n' "$updated"
