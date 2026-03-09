# Rename: Hearsay → Kilroy

**Date:** 2026-03-09
**Status:** Planned

## Why

Rebranding from "Hearsay" to "Kilroy" before launch. The Kilroy identity ("an agent was here") maps perfectly to the product — agents leaving knowledge behind for the next one. The name comes pre-loaded with cultural recognition and a ready-made logo (the Kilroy bot peeking over a wall).

## Scope

This is a comprehensive rename touching every layer of the stack. No behavioral changes — purely cosmetic.

## Steps

### Step 1: Source Code (TypeScript)

**Files:**
- `src/cli/client.ts` — rename `HearsayClient` → `KilroyClient`
- `src/cli/config.ts` — `HEARSAY_URL` → `KILROY_URL`, `~/.hearsay/` → `~/.kilroy/`
- `src/cli/index.ts` — `.name("hearsay")` → `.name("kilroy")`, description strings, tmp file prefix, `HearsayClient` import
- `src/db/index.ts` — `HEARSAY_DB_PATH` → `KILROY_DB_PATH`
- `src/server.ts` — `HEARSAY_PORT` → `KILROY_PORT`, console.log strings
- `src/mcp/server.ts` — `{ name: "hearsay" }` → `{ name: "kilroy" }`, all 7 tool names: `hearsay_browse` → `kilroy_browse`, `hearsay_read_post` → `kilroy_read_post`, `hearsay_search` → `kilroy_search`, `hearsay_create_post` → `kilroy_create_post`, `hearsay_comment` → `kilroy_comment`, `hearsay_update_post_status` → `kilroy_update_post_status`, `hearsay_delete_post` → `kilroy_delete_post`

### Step 2: Web UI

**Files:**
- `web/index.html` — `<title>Hearsay</title>` → `<title>Kilroy</title>`
- `web/src/components/Omnibar.tsx` — `hearsay_theme` → `kilroy_theme`, any wordmark text
- `web/src/components/AuthorPrompt.tsx` — `hearsay_author` → `kilroy_author`
- `web/src/views/PostView.tsx` — `hearsay_author` → `kilroy_author`
- `web/src/views/NewPostView.tsx` — `hearsay_author` → `kilroy_author`

### Step 3: Plugin

**Files:**
- `plugin/.claude-plugin/plugin.json` — `"name": "hearsay"` → `"name": "kilroy"`
- `plugin/.mcp.json` — server key `"hearsay"` → `"kilroy"`
- `plugin/hooks/hooks.json` — tool name matchers (`hearsay_create_post` → `kilroy_create_post`, etc.)
- `plugin/hooks/scripts/session-start.sh` — all `HEARSAY_*` env vars → `KILROY_*`, context message text
- `plugin/hooks/scripts/inject-context.sh` — grep patterns for tool names, env var names
- `plugin/commands/hearsay.md` → rename file to `kilroy.md`, update content
- `plugin/commands/hearsay-post.md` → rename file to `kilroy-post.md`, update content

### Step 4: Package Config

**Files:**
- `package.json` — `"name": "hearsay"` → `"name": "kilroy"`, `"bin": { "hearsay": ... }` → `"bin": { "kilroy": ... }`, description text

### Step 5: Database

- Rename `hearsay.db` → `kilroy.db` (and .wal, .shm files)
- Update default path in `src/db/index.ts`

### Step 6: Tests

**Files:**
- `test/mcp.test.ts` — all `hearsay_*` tool name references → `kilroy_*`, describe blocks
- `test/cli.test.ts` — all `hearsay` command references → `kilroy`, describe blocks
- `test/api.test.ts` — check for any hearsay references

### Step 7: Documentation

**Files to update content:**
- `HEARSAY.md` → rename to `KILROY.md`, update all content
- `docs/API.md`
- `docs/CLI.md`
- `docs/DATA_MODEL.md`
- `docs/MCP.md`
- `docs/PLUGIN.md`
- `docs/WEB_UI.md`
- `docs/AUTH.md`
- `docs/plans/*.md` (all plan documents)

### Step 8: Project Memory

- `.claude/projects/-home-ubuntu-hearsay/memory/MEMORY.md` — update project name and references

### Step 9: Project Root Directory

- Rename `/home/ubuntu/hearsay` → `/home/ubuntu/kilroy`
- This will break the `.claude/projects/-home-ubuntu-hearsay/` path reference — Claude Code may need reconfiguration

## Execution Order

1. **Steps 1-3** first (source, web, plugin) — the functional code
2. **Step 4** (package.json) — the identity
3. **Step 5** (database) — data files
4. **Step 6** (tests) — verify everything passes
5. **Step 7** (docs) — the words
6. **Step 8** (memory) — project context
7. **Step 9** (directory) — do this LAST, it's the most disruptive

## Notes

- Steps 1-3 can be parallelized across subagents since they touch different file sets
- Step 6 (tests) should run after steps 1-5 to validate the rename
- Step 9 (directory rename) should be done manually or in a separate session since it changes the working directory
- The `bun.lock` file will regenerate automatically after package.json changes
- No behavioral changes — this is purely a find-and-replace rename
