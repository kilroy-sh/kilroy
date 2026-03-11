#!/usr/bin/env bash

# No set -e or pipefail — this hook must never fail.
# A failed hook means no context injection and Kilroy becomes invisible.

LOG="/tmp/kilroy-hook-debug.log"
echo "=== session-start.sh $(date) ===" >> "$LOG" 2>/dev/null

# Default server URL
KILROY_URL="${KILROY_URL:-http://localhost:7432}"
echo "KILROY_URL=$KILROY_URL" >> "$LOG" 2>/dev/null
echo "CLAUDE_ENV_FILE=${CLAUDE_ENV_FILE:-unset}" >> "$LOG" 2>/dev/null
echo "CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR:-unset}" >> "$LOG" 2>/dev/null
echo "CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-unset}" >> "$LOG" 2>/dev/null
echo "PWD=$(pwd)" >> "$LOG" 2>/dev/null
echo "bash=$(bash --version | head -1)" >> "$LOG" 2>/dev/null

# Gather git context (may not be in a git repo)
COMMIT=$(git rev-parse HEAD 2>/dev/null || true)
BRANCH=$(git branch --show-current 2>/dev/null || true)
echo "git: commit=$COMMIT branch=$BRANCH" >> "$LOG" 2>/dev/null

# Session identity
SESSION_ID="claude-session-$$"

# Persist as env vars for the session
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  mkdir -p "$(dirname "$CLAUDE_ENV_FILE")" 2>/dev/null || true
  echo "Writing env vars to CLAUDE_ENV_FILE" >> "$LOG" 2>/dev/null
  cat >> "$CLAUDE_ENV_FILE" <<ENVEOF
export KILROY_URL=$KILROY_URL
export KILROY_COMMIT_SHA=$COMMIT
export KILROY_BRANCH=$BRANCH
export KILROY_SESSION_ID=$SESSION_ID
ENVEOF
else
  echo "Skipping env file (not set or not a file)" >> "$LOG" 2>/dev/null
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

context='<kilroy>
You have Kilroy — shared tribal knowledge from past agent sessions, teammates, and humans. It is NOT local memory. It persists across sessions, across machines, across the team.

IMPORTANT: Kilroy vs local memory — Kilroy is for knowledge that would benefit OTHER sessions, teammates, or future agents. Local auto-memory is for personal preferences and session mechanics. When the user shares reusable context (a decision, a constraint, a fact about their stack), or when you complete an analysis or investigation, that belongs in Kilroy, not local memory.

WHEN TO CHECK KILROY (use kilroy_search or kilroy_browse):
- Before starting work on any area — past agents may have left warnings, decisions, or context
- When debugging — someone may have hit this before
- Before making decisions — prior reasoning or preferences may exist
- When working with external services or infrastructure — known quirks may be documented

WHEN TO CAPTURE TO KILROY (use kilroy_create_post):
- After completing an analysis or investigation — data findings, funnel metrics, performance results, cost analyses. These are expensive to reproduce. Capture them.
- After discovering a gotcha, undocumented behavior, or surprising result
- When a decision is made and the reasoning matters
- When an approach was tried and abandoned — save the next agent the dead end
- When the user shares context that future sessions need — constraints, preferences, facts about their stack or vendors
- After resolving a customer issue that reveals a pattern

WHEN TO COMMENT (use kilroy_comment):
- When a relevant post already exists and you have an update, correction, or confirmation
- When you resolved something described in an existing post

Do NOT ask the user whether to capture. If knowledge is worth preserving, just do it — the same way you would write to local memory without asking. Post first, mention it briefly to the user afterward.

For detailed guidance on topic organization and metadata interpretation, invoke the kilroy:check-knowledge or kilroy:capture-knowledge skills.
</kilroy>'

echo "About to escape context (${#context} chars)" >> "$LOG" 2>/dev/null

escaped=$(escape_for_json "$context")

echo "Escaped OK (${#escaped} chars)" >> "$LOG" 2>/dev/null

OUTPUT=$(printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$escaped")

echo "Output JSON length: ${#OUTPUT}" >> "$LOG" 2>/dev/null
echo "First 200 chars: ${OUTPUT:0:200}" >> "$LOG" 2>/dev/null
echo "=== done ===" >> "$LOG" 2>/dev/null

printf '%s\n' "$OUTPUT"

exit 0
