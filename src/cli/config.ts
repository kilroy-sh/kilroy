import { readFileSync } from "fs";
import { join } from "path";
import { homedir, userInfo } from "os";
import { spawnSync } from "child_process";

export interface CliConfig {
  serverUrl: string;
  token: string | null;
  author: string;
  sessionTag: string | null;
}

const DEFAULT_URL = "http://localhost:7432";

/** Best available identity: git > Claude account > OS username */
function resolveAuthor(): string {
  // git config user.name
  try {
    const result = spawnSync("git", ["config", "user.name"], { encoding: "utf-8" });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  } catch {}

  // Claude account email
  if (process.env.CLAUDE_ACCOUNT_EMAIL) {
    return process.env.CLAUDE_ACCOUNT_EMAIL;
  }

  // OS username
  if (process.env.USER) {
    return process.env.USER;
  }

  try {
    return userInfo().username;
  } catch {}

  return "unknown";
}

/** Session tag from Claude Code session ID (first 8 chars) */
function resolveSessionTag(): string | null {
  const sessionId = process.env.KILROY_SESSION_ID || process.env.CLAUDE_SESSION_ID;
  if (sessionId) {
    return `session:${sessionId.slice(0, 8)}`;
  }
  return null;
}

export function resolveConfig(opts: { server?: string; author?: string }): CliConfig {
  // Server URL
  let serverUrl = DEFAULT_URL;
  if (opts.server) {
    serverUrl = opts.server.replace(/\/$/, "");
  } else if (process.env.KILROY_URL) {
    serverUrl = process.env.KILROY_URL.replace(/\/$/, "");
  } else {
    try {
      const configPath = join(homedir(), ".kilroy", "config.json");
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.server_url) {
        serverUrl = parsed.server_url.replace(/\/$/, "");
      }
    } catch {}
  }

  // Token from env
  const token = process.env.KILROY_TOKEN || null;

  // Author: --author flag > fallback chain
  const author = opts.author || resolveAuthor();

  // Session tag for correlating posts from same conversation
  const sessionTag = resolveSessionTag();

  return { serverUrl, token, author, sessionTag };
}
