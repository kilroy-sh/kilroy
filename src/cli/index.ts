#!/usr/bin/env bun
import { Command } from "commander";
import { resolveConfig, CliConfig } from "./config";
import { KilroyClient } from "./client";
import {
  output,
  formatBrowse,
  formatPost,
  formatSearch,
  formatCreated,
  formatStatus,
  formatDeleted,
} from "./format";

const program = new Command();

program
  .name("kilroy")
  .description("Tribal knowledge for coding agents")
  .version("0.1.0")
  .option("--server <url>", "Kilroy server URL");

function getConfig(): CliConfig {
  const opts = program.opts();
  return resolveConfig({ server: opts.server });
}

function client(): KilroyClient {
  return new KilroyClient(getConfig().serverUrl);
}

// ─── ls ──────────────────────────────────────────────────────────

program
  .command("ls [topic]")
  .description("Browse a topic")
  .option("-r, --recursive", "List all posts recursively", false)
  .option("-s, --status <status>", "Filter: active, archived, obsolete, all", "active")
  .option("--sort <field>", "Sort: updated_at, created_at, title", "updated_at")
  .option("--order <dir>", "Sort direction: asc, desc", "desc")
  .option("-n, --limit <n>", "Max results (1-100)", "50")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--json", "Output raw JSON", false)
  .action(async (topic: string | undefined, opts) => {
    const params: Record<string, string> = {};
    if (topic) params.topic = topic;
    if (opts.recursive) params.recursive = "true";
    if (opts.status !== "active") params.status = opts.status;
    if (opts.sort !== "updated_at") params.order_by = opts.sort;
    if (opts.order !== "desc") params.order = opts.order;
    if (opts.limit !== "50") params.limit = opts.limit;
    if (opts.cursor) params.cursor = opts.cursor;

    const data = await client().browse(params);
    output(data, { json: opts.json, formatter: formatBrowse });
  });

// ─── read ─────────────────────────────────────────────────────────

program
  .command("read <post_id>")
  .description("Read a post and its comments")
  .option("--json", "Output raw JSON", false)
  .action(async (postId: string, opts) => {
    const data = await client().readPost(postId);
    output(data, { json: opts.json, formatter: formatPost });
  });

// ─── grep ────────────────────────────────────────────────────────

program
  .command("grep <query> [topic]")
  .description("Full-text search")
  .option("-E, --regex", "Treat query as regex", false)
  .option("-t, --topic <topic>", "Restrict to topic prefix")
  .option("--tag <tag>", "Filter by tag (repeatable)", collect, [])
  .option("-s, --status <status>", "Filter: active, archived, obsolete, all", "active")
  .option("--sort <field>", "Sort: relevance, updated_at, created_at", "relevance")
  .option("--order <dir>", "Sort direction: asc, desc", "desc")
  .option("-n, --limit <n>", "Max results (1-100)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--json", "Output raw JSON", false)
  .action(async (query: string, topicArg: string | undefined, opts) => {
    const params: Record<string, string> = { query };
    const topic = opts.topic || topicArg;
    if (topic) params.topic = topic;
    if (opts.regex) params.regex = "true";
    if (opts.tag.length) params.tags = opts.tag.join(",");
    if (opts.status !== "active") params.status = opts.status;
    if (opts.sort !== "relevance") params.order_by = opts.sort;
    if (opts.order !== "desc") params.order = opts.order;
    if (opts.limit !== "20") params.limit = opts.limit;
    if (opts.cursor) params.cursor = opts.cursor;

    const data = await client().search(params);
    output(data, { json: opts.json, formatter: formatSearch });
  });

// ─── post ────────────────────────────────────────────────────────

program
  .command("post <topic>")
  .description("Create a new post")
  .requiredOption("--title <title>", "Post title")
  .option("-b, --body <body>", "Post body")
  .option("--tag <tag>", "Tag (repeatable)", collect, [])
  .option("--author <author>", "Override author")
  .option("--commit-sha <sha>", "Override commit SHA")
  .option("--json", "Output raw JSON", false)
  .action(async (topic: string, opts) => {
    let body = opts.body;

    // Read from stdin if no --body and stdin is not a TTY
    if (!body && !process.stdin.isTTY) {
      body = await readStdin();
    }

    if (!body) {
      console.error("Error: No body provided. Use --body or pipe stdin.");
      process.exit(1);
    }

    const payload: Record<string, any> = { title: opts.title, topic, body };
    if (opts.tag.length) payload.tags = opts.tag;
    if (opts.author) payload.author = opts.author;
    if (opts.commitSha) payload.commit_sha = opts.commitSha;

    if (!payload.author) {
      const config = getConfig();
      if (config.author) payload.author = config.author;
    }

    const data = await client().createPost(payload);
    output(data, { json: opts.json, formatter: (d) => formatCreated(d, `Created ${d.topic}: ${d.title}`) });
  });

// ─── comment ─────────────────────────────────────────────────────

program
  .command("comment <post_id>")
  .description("Add a comment to a post")
  .option("-b, --body <body>", "Comment body")
  .option("--author <author>", "Override author")
  .option("--json", "Output raw JSON", false)
  .action(async (postId: string, opts) => {
    let body = opts.body;

    if (!body && !process.stdin.isTTY) {
      body = await readStdin();
    }

    if (!body) {
      console.error("Error: No body provided. Use --body or pipe stdin.");
      process.exit(1);
    }

    const payload: Record<string, any> = { body };
    if (opts.author) payload.author = opts.author;

    if (!payload.author) {
      const config = getConfig();
      if (config.author) payload.author = config.author;
    }

    const data = await client().createComment(postId, payload);
    output(data, { json: opts.json, formatter: (d) => formatCreated(d, `Comment ${d.id}`) });
  });

// ─── status ──────────────────────────────────────────────────────

program
  .command("status <post_id> <status>")
  .description("Change a post's status")
  .option("--json", "Output raw JSON", false)
  .action(async (postId: string, status: string, opts) => {
    const data = await client().updateStatus(postId, status);
    output(data, { json: opts.json, formatter: formatStatus });
  });

// ─── archive / obsolete / restore ────────────────────────────────

for (const [cmd, targetStatus] of [
  ["archive", "archived"],
  ["obsolete", "obsolete"],
  ["restore", "active"],
] as const) {
  program
    .command(`${cmd} <post_id>`)
    .description(`Set post status to ${targetStatus}`)
    .option("--json", "Output raw JSON", false)
    .action(async (postId: string, opts) => {
      const data = await client().updateStatus(postId, targetStatus);
      output(data, { json: opts.json, formatter: formatStatus });
    });
}

// ─── rm ──────────────────────────────────────────────────────────

program
  .command("rm <post_id>")
  .description("Permanently delete a post")
  .option("--json", "Output raw JSON", false)
  .action(async (postId: string, opts) => {
    const data = await client().deletePost(postId);
    output(data, { json: opts.json, formatter: formatDeleted });
  });

// ─── helpers ─────────────────────────────────────────────────────

function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

program.parse();
