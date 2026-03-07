import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface CliConfig {
  serverUrl: string;
}

const DEFAULT_URL = "http://localhost:7432";

export function resolveConfig(opts: { server?: string }): CliConfig {
  // 1. --server flag
  if (opts.server) {
    return { serverUrl: opts.server.replace(/\/$/, "") };
  }

  // 2. HEARSAY_URL env
  if (process.env.HEARSAY_URL) {
    return { serverUrl: process.env.HEARSAY_URL.replace(/\/$/, "") };
  }

  // 3. ~/.hearsay/config.json
  try {
    const configPath = join(homedir(), ".hearsay", "config.json");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.server_url) {
      return { serverUrl: parsed.server_url.replace(/\/$/, "") };
    }
  } catch {}

  return { serverUrl: DEFAULT_URL };
}
