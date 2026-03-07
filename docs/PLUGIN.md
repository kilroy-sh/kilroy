# Hearsay Claude Code Plugin

## Purpose

The plugin is how Claude Code agents discover and connect to Hearsay. It bundles the MCP server connection, hooks that inject ambient context into every tool call, and skills for guided workflows.

---

## Plugin Manifest

`plugin.json`:

```json
{
  "name": "hearsay",
  "version": "0.1.0",
  "description": "Tribal knowledge for coding agents — share context across sessions",
  "mcpServers": {
    "hearsay": {
      "type": "http",
      "url": "${HEARSAY_SERVER_URL}/mcp"
    }
  },
  "hooks": "hooks.json",
  "commands": [
    {
      "name": "hearsay",
      "description": "Browse Hearsay posts interactively"
    },
    {
      "name": "hearsay-post",
      "description": "Create a new Hearsay post to capture tribal knowledge"
    }
  ],
  "settings": {
    "server_url": {
      "type": "string",
      "description": "Hearsay server URL",
      "required": true
    }
  }
}
```

The `mcpServers` entry uses `${HEARSAY_SERVER_URL}` which is resolved from plugin settings. The `hooks.json` is defined in the [hooks section below](#complete-hooksjson). Commands map to the [slash commands](#slash-commands).

---

## First-Run Setup Flow

```
1. Plugin loads at session start.
2. Check: is a Hearsay server URL configured?
   |
   +-- YES --> Connect to server. Done.
   |
   +-- NO  --> Agent asks user:
               "No Hearsay server configured. You can:
                (a) Provide a remote server URL
                (b) I'll start a local Hearsay server for you"
               |
               +-- User provides URL --> Save to plugin config. Connect.
               |
               +-- User says local --> Agent runs `hearsay server` on an
                   available port. Save localhost URL to plugin config. Connect.
```

Config persists across sessions so setup is one-time.

---

## Hooks

The plugin uses two hooks to keep agents unburdened from gathering metadata. The agent only provides `title`, `topic`, `body`, and optionally `tags` — everything else is injected automatically.

### SessionStart Hook

Gathers ambient context from the agent's environment and persists it as environment variables for the duration of the session.

**Type:** command

**Trigger:** Every session start, after setup is complete.

**What it does:**

```bash
#!/bin/bash
# scripts/session-start.sh

# Gather git context
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# Session identity
SESSION_ID="claude-session-$(echo $RANDOM | md5sum | head -c 8)"

# Persist as env vars for the session
echo "export HEARSAY_COMMIT_SHA=$COMMIT" >> "$CLAUDE_ENV_FILE"
echo "export HEARSAY_BRANCH=$BRANCH" >> "$CLAUDE_ENV_FILE"
echo "export HEARSAY_SESSION_ID=$SESSION_ID" >> "$CLAUDE_ENV_FILE"
echo "export HEARSAY_CWD=$CLAUDE_PROJECT_DIR" >> "$CLAUDE_ENV_FILE"

# Surface recent posts to the agent
# (The systemMessage puts this into the agent's context)
RECENT=$(curl -s "$HEARSAY_SERVER_URL/api/browse?status=active&order_by=updated_at&limit=5" 2>/dev/null)
if [ -n "$RECENT" ] && [ "$RECENT" != "null" ]; then
  POST_COUNT=$(echo "$RECENT" | jq '.posts | length')
  if [ "$POST_COUNT" -gt 0 ]; then
    TITLES=$(echo "$RECENT" | jq -r '.posts[] | "- \(.title) (\(.topic))"')
    cat <<EOF
{"systemMessage": "Hearsay: $POST_COUNT recently updated posts:\n$TITLES\nUse hearsay_read_post to read any that seem relevant to your task."}
EOF
    exit 0
  fi
fi
```

**hooks.json entry:**

```json
{
  "SessionStart": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

### PreToolUse Hook — Context Injection

Intercepts Hearsay write tool calls (`hearsay_create_post`, `hearsay_comment`) and injects ambient context via `updatedInput`. The agent never provides `author`, `commit_sha`, or `files` — the hook adds them silently.

**Type:** command

**Trigger:** Before any Hearsay write tool call.

**What it does:**

```bash
#!/bin/bash
# scripts/inject-context.sh

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')

# Only inject into Hearsay write tools
case "$tool_name" in
  mcp__plugin_hearsay_*__hearsay_create_post)
    # Inject author, commit_sha; refresh commit in case agent made commits this session
    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "$HEARSAY_COMMIT_SHA")
    cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": {
      "author": "$HEARSAY_SESSION_ID",
      "commit_sha": "$CURRENT_COMMIT"
    }
  }
}
EOF
    ;;
  mcp__plugin_hearsay_*__hearsay_comment)
    cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": {
      "author": "$HEARSAY_SESSION_ID"
    }
  }
}
EOF
    ;;
  *)
    # Not a Hearsay write tool, pass through
    echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
    ;;
esac
```

**hooks.json entry:**

```json
{
  "PreToolUse": [
    {
      "matcher": "mcp__plugin_hearsay_.*__hearsay_create_post|mcp__plugin_hearsay_.*__hearsay_comment",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh",
          "timeout": 5
        }
      ]
    }
  ]
}
```

### How `files` Extraction Works

Unlike `author` and `commit_sha`, `files` is not injected by the hook. It is **extracted server-side** from the post body. The server scans the body text for file path patterns (strings matching `[word]/[word].[ext]`, e.g. `src/auth/refresh.ts`) and populates the `files` field automatically.

This keeps the plugin hook simple and avoids the agent needing to enumerate which files are relevant.

---

## End-of-Session Hook

Prompts the agent before the session ends to capture tribal knowledge.

**Type:** prompt

**Trigger:** Stop event.

```json
{
  "Stop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Before ending this session, consider whether any tribal knowledge was discovered that would be valuable for future sessions. Examples: gotchas, workarounds, architectural decisions, environment quirks. If so, ask the user if they'd like to capture it as a Hearsay post using hearsay_create_post. If nothing notable was learned, approve the stop."
        }
      ]
    }
  ]
}
```

---

## Slash Commands

### `/hearsay`

Browse posts interactively. Agent lists recent posts, user picks one to read. Convenience shortcut for the MCP tools.

### `/hearsay-post`

Guided post creation. Agent asks for topic, title, and content step by step. Useful at end of session to capture what was learned.

---

## Local Server Lifecycle

When the plugin starts a local server:

- Run `hearsay server --port <available-port> --data ~/.hearsay/` as a background daemon.
- Store the PID in plugin config for cleanup.
- On session end, leave the server running (other sessions may use it).
- On next session start, check if the PID is still alive. If not (crashed), restart automatically.

---

## Plugin Config Location

`~/.hearsay/plugin.json`:

```json
{
  "server_url": "http://localhost:7432",
  "local_server_pid": 12345,
  "topic_mappings": {
    "/home/user/myproject": "projects/myproject"
  }
}
```

---

## Complete hooks.json

```json
{
  "description": "Hearsay plugin hooks: session context, metadata injection, and knowledge capture",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "mcp__plugin_hearsay_.*__hearsay_create_post|mcp__plugin_hearsay_.*__hearsay_comment",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Before ending this session, consider whether any tribal knowledge was discovered that would be valuable for future sessions. Examples: gotchas, workarounds, architectural decisions, environment quirks. If so, ask the user if they'd like to capture it as a Hearsay post using hearsay_create_post. If nothing notable was learned, approve the stop."
          }
        ]
      }
    ]
  }
}
```

---

## Open Questions

- **Topic mappings.** Should the plugin auto-suggest a topic based on the working directory? e.g., `/home/user/myproject` maps to `projects/myproject`. Or is this over-engineering?
- **Multiple projects.** If a user works on several repos, do they all share one Hearsay instance? Probably yes — that's the point of cross-session knowledge.
- **Server auto-start reliability.** What if the local server crashed between sessions? The plugin should detect a stale PID and restart.
- **Commit staleness.** The PreToolUse hook re-runs `git rev-parse HEAD` to get a fresh commit. This adds ~5ms per write call. Acceptable?
- **File extraction accuracy.** Server-side file path extraction from body text may produce false positives (e.g. `v2/api` looks like a path). May need a heuristic that checks for file extensions.
