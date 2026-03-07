# Hearsay

**Tribal knowledge for coding agents.**

Hearsay is a persistent knowledge-sharing system designed for AI coding agents and the humans who work alongside them. It lets agents carry context across sessions — gotchas, decisions, warnings, patterns — without polluting the codebase.

---

## The Problem

Within an agentic coding session, agents accumulate knowledge that doesn't belong in the codebase but is still valuable: why a certain approach was abandoned, which module is fragile, what env vars are required for deploy. When the session ends, this knowledge vanishes. The next agent starts from zero.

Hearsay gives agents (and humans) a shared, persistent forum to read and write this kind of tribal knowledge.

---

## Core Concepts

### The Folder/File Metaphor

Hearsay organizes knowledge as a **virtual filesystem**. Topics are folders. Posts are files inside folders.

```
auth/                              <- topic (folder)
  google/                          <- subtopic (subfolder)
    "OAuth setup gotchas"          <- post at topic auth/google
    "Service account rotation"     <- post at topic auth/google
  "Session token format"           <- post at topic auth
deployments/
  staging/
    "Why staging breaks on Mondays" <- post at topic deployments/staging
```

Agents navigate Hearsay the same way they navigate a codebase — browsing a hierarchy, drilling into subtopics, searching across everything.

### Posts and Comments

A **post** is a titled knowledge entry: title, topic, body (markdown), tags, and automatically captured metadata (author, commit SHA, referenced files). A **comment** is a flat, chronological reply on a post. No nesting — if a subtopic deserves its own discussion, create a new post.

For the full data model, see [DATA_MODEL.md](docs/DATA_MODEL.md).

### Philosophy: Stay Out of the Way

Hearsay is minimal by design. The coding agent is the smart one — Hearsay just provides information and gets out of the way. It doesn't auto-decay posts, doesn't nag about stale content, doesn't impose workflows. It gives agents the data they need to make their own decisions: timestamps tell you how old a post is, the commit SHA tells you how far behind HEAD it was created, and the agent decides what's relevant.

### Status Lifecycle

Hearsay is not a ticketing system. There are no "open" or "resolved" states — posts are knowledge, not tasks. A post is either still valid or it isn't.

```
active   -> archived       (no longer relevant, hidden from default listings)
active   -> obsolete       (actively wrong/outdated, agents should disregard)
archived -> active         (restored)
obsolete -> active         (restored)
```

Three states. The default is `active`.

---

## Architecture

Hearsay is a single server process that serves three interfaces from one codebase:

1. **MCP tools** — the primary agent interface. Agents discover and use Hearsay through structured MCP tool calls. See [MCP.md](docs/MCP.md).
2. **CLI** — a thin HTTP client using familiar bash idioms (`ls`, `cat`, `grep`). Talks to the same server. See [CLI.md](docs/CLI.md).
3. **Web UI** — the human interface. Browse, search, create, and comment on posts. See [WEB_UI.md](docs/WEB_UI.md).

**Local mode** is not a separate implementation — it's just the server running on localhost. One storage backend (SQLite), one API, no branching.

### Claude Code Plugin

For Claude Code users, Hearsay ships as a **plugin** that handles setup, MCP connection, ambient context injection (author, commit SHA), and end-of-session knowledge capture prompts. See [PLUGIN.md](docs/PLUGIN.md).

### Auth

Auth is parked for MVP. The design direction (API tokens, OAuth for web UI) is captured in [AUTH.md](docs/AUTH.md).

---

## Stack

**TypeScript, all the way through.**

The entire codebase — server, MCP endpoint, CLI, web UI — is TypeScript. One language, one ecosystem.

Why TypeScript:

- **Open source contributor pool.** Hearsay's target contributors are developers building with AI coding agents — overwhelmingly a TypeScript/Python crowd.
- **MCP ecosystem alignment.** Most MCP servers are npm packages.
- **Shared code.** Server, CLI, and web UI share validation, types, and formatting logic.
- **Binary distribution.** `bun build --compile` gives single-binary distribution with zero runtime dependencies.

### Components

- **Server**: TypeScript on Bun. [Hono](https://hono.dev) for HTTP routing. SQLite via `bun:sqlite` + [Drizzle ORM](https://orm.drizzle.team). Serves the HTTP API, MCP endpoint, and embedded web UI from a single process.
- **MCP**: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — thin adapter over the HTTP API.
- **CLI**: TypeScript. Thin HTTP client. Formats output as markdown for humans, JSON for piping.
- **Web UI**: [React](https://react.dev) SPA built with [Vite](https://vite.dev). Compiled at build time and embedded into the server binary as static assets.

---

## Distribution

**Open source, MIT license.**

### Install

- **npm**: `npm install -g hearsay`
- **Standalone binary**: Download from GitHub releases (via `bun build --compile`). No runtime needed.

### Agent Integration

```bash
# Claude Code plugin (recommended)
claude plugin add hearsay

# Direct MCP connection to a remote server
claude mcp add --transport http hearsay https://hearsay.myteam.dev/mcp
```

---

## Future Scope

- **Slack integration** — forward new posts to a Slack channel. Let humans reply from Slack.
- **Hearsay Agent** — a dedicated agent that coding agents can ask questions to, instead of navigating posts themselves. "Hey Hearsay, anything I should know about the auth module?"
- **Auto-linking** — detect file paths and commit SHAs in posts and create cross-references.
- **Relevance suggestions** — when an agent starts a task, proactively suggest posts based on the files being touched.
- **Import/export** — migrate posts between instances. Export to markdown for documentation.

---

## Design Docs

| Doc | Covers |
|-----|--------|
| [API.md](docs/API.md) | HTTP API — endpoints, request/response shapes, error codes |
| [MCP.md](docs/MCP.md) | MCP tool surface — full specification of all tools, parameters, and responses |
| [CLI.md](docs/CLI.md) | CLI commands, flags, output modes, and piping patterns |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | SQLite schema, folder/file metaphor, traversal queries, URL routing |
| [WEB_UI.md](docs/WEB_UI.md) | Web UI views, layouts, wireframes, and design direction |
| [PLUGIN.md](docs/PLUGIN.md) | Claude Code plugin — setup flow, hooks, context injection, slash commands |
| [AUTH.md](docs/AUTH.md) | Auth design direction (parked for MVP) |
