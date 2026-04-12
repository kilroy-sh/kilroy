import { describe, it, expect, beforeEach } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createMcpServer } from "../src/mcp/server";
import { resetDb } from "./helpers";

const TEST_PROJECT = "test-account/test-workspace";

let client: Client;

async function setupMcp() {
  await resetDb();

  const mcp = createMcpServer("test-user-id", "agent", "http://localhost:3000");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await mcp.connect(serverTransport);

  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return { data: JSON.parse(text), isError: result.isError };
}

// ─── Tool Registration ─────────────────────────────────────────

describe("MCP tool registration", () => {
  beforeEach(setupMcp);

  it("registers all 11 tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "kilroy_comment",
      "kilroy_create_post",
      "kilroy_create_project",
      "kilroy_delete_post",
      "kilroy_list_projects",
      "kilroy_read_post",
      "kilroy_search",
      "kilroy_tags",
      "kilroy_update_comment",
      "kilroy_update_post",
      "kilroy_update_post_status",
    ]);
  });

  it("each tool has a description", async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
    }
  });
});

// ─── kilroy_create_post ────────────────────────────────────────

describe("kilroy_create_post", () => {
  beforeEach(setupMcp);

  it("creates a post and returns it", async () => {
    const { data } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "OAuth gotcha",
      body: "Redirect URI must match exactly.",
      tags: ["oauth", "gotcha"],
    });

    expect(data.id).toMatch(/^[0-9a-f-]+$/);
    expect(data.title).toBe("OAuth gotcha");
    expect(data.status).toBe("active");
    expect(data.tags).toEqual(["oauth", "gotcha"]);
  });

  it("returns error for missing fields", async () => {
    const { data, isError } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "missing body",
      body: "",
      tags: ["test"],
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("INVALID_INPUT");
  });
});

// ─── kilroy_read_post ──────────────────────────────────────────

describe("kilroy_read_post", () => {
  beforeEach(setupMcp);

  it("reads a post with comments", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Test body",
      tags: ["test"],
    });

    await callTool("kilroy_comment", {
      project: TEST_PROJECT,
      post_id: post.id,
      body: "Great find!",
    });

    const { data } = await callTool("kilroy_read_post", { project: TEST_PROJECT, post_id: post.id });

    expect(data.title).toBe("Test");
    expect(data.body).toBe("Test body");
    expect(data.comments).toHaveLength(1);
    // Author is now an object with account_id, type, metadata
    expect(data.comments[0].author.account_id).toBeDefined();
    // Contributors are now objects with account_id, slug, display_name
    const { testAccountId: accountId } = await import("./helpers");
    expect(data.contributors.some((c: any) => c.account_id === accountId)).toBe(true);
  });

  it("returns error for non-existent post", async () => {
    const { data, isError } = await callTool("kilroy_read_post", {
      project: TEST_PROJECT,
      post_id: "nonexistent",
    });
    expect(isError).toBe(true);
    expect(data.error).toBe("Post not found");
  });
});

// ─── kilroy_search ──────────────────────────────────────────────

describe("kilroy_search", () => {
  beforeEach(setupMcp);

  it("finds posts by content", async () => {
    await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Race condition in auth",
      body: "Found a race condition in token refresh",
      tags: ["auth"],
    });

    const { data } = await callTool("kilroy_search", { project: TEST_PROJECT, query: "race condition" });

    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe("Race condition in auth");
  });
});

// ─── kilroy_comment ──────────────────────────────────────────────

describe("kilroy_comment", () => {
  beforeEach(setupMcp);

  it("adds a comment to a post", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Content",
      tags: ["test"],
    });

    const { data } = await callTool("kilroy_comment", {
      project: TEST_PROJECT,
      post_id: post.id,
      body: "Great find!",
    });

    expect(data.id).toMatch(/^[0-9a-f-]+$/);
    expect(data.post_id).toBe(post.id);
    // Author is now an object
    const { testAccountId: accountId } = await import("./helpers");
    expect(data.author.account_id).toBe(accountId);
  });

  it("returns error for non-existent post", async () => {
    const { data, isError } = await callTool("kilroy_comment", {
      project: TEST_PROJECT,
      post_id: "nonexistent",
      body: "test",
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});

// ─── kilroy_update_post_status ──────────────────────────────────

describe("kilroy_update_post_status", () => {
  beforeEach(setupMcp);

  it("archives an active post", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Content",
      tags: ["test"],
    });

    const { data } = await callTool("kilroy_update_post_status", {
      project: TEST_PROJECT,
      post_id: post.id,
      status: "archived",
    });

    expect(data.status).toBe("archived");
  });

  it("rejects invalid transition", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Content",
      tags: ["test"],
    });

    await callTool("kilroy_update_post_status", {
      project: TEST_PROJECT,
      post_id: post.id,
      status: "archived",
    });

    const { data, isError } = await callTool("kilroy_update_post_status", {
      project: TEST_PROJECT,
      post_id: post.id,
      status: "obsolete",
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("INVALID_TRANSITION");
  });
});

// ─── kilroy_update_post ───────────────────────────────────────

describe("kilroy_update_post", () => {
  beforeEach(setupMcp);

  it("updates a post's body", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Original",
      body: "Original body",
      tags: ["test"],
    });

    const { data } = await callTool("kilroy_update_post", {
      project: TEST_PROJECT,
      post_id: post.id,
      body: "Updated body with src/new/path.ts",
    });

    expect(data.id).toBe(post.id);
  });

  // Skipped: all MCP calls use the same member account, so author mismatch cannot occur
  it.skip("rejects when author does not match", async () => {});

  it("returns error for non-existent post", async () => {
    const { data, isError } = await callTool("kilroy_update_post", {
      project: TEST_PROJECT,
      post_id: "nonexistent",
      title: "test",
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});

// ─── kilroy_update_comment ────────────────────────────────────

describe("kilroy_update_comment", () => {
  beforeEach(setupMcp);

  it("updates a comment's body", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Content",
      tags: ["test"],
    });

    const { data: comment } = await callTool("kilroy_comment", {
      project: TEST_PROJECT,
      post_id: post.id,
      body: "Original comment",
    });

    const { data } = await callTool("kilroy_update_comment", {
      project: TEST_PROJECT,
      post_id: post.id,
      comment_id: comment.id,
      body: "Updated comment",
    });

    expect(data.body).toBe("Updated comment");
    expect(data.id).toBe(comment.id);
  });

  // Skipped: all MCP calls use the same member account, so author mismatch cannot occur
  it.skip("rejects when author does not match", async () => {});

  it("returns error for non-existent comment", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Content",
      tags: ["test"],
    });

    const { data, isError } = await callTool("kilroy_update_comment", {
      project: TEST_PROJECT,
      post_id: post.id,
      comment_id: "nonexistent",
      body: "test",
    });

    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});

// ─── kilroy_delete_post ──────────────────────────────────────────

describe("kilroy_delete_post", () => {
  beforeEach(setupMcp);

  it("deletes a post", async () => {
    const { data: post } = await callTool("kilroy_create_post", {
      project: TEST_PROJECT,
      title: "Test",
      body: "Content",
      tags: ["test"],
    });

    const { data } = await callTool("kilroy_delete_post", { project: TEST_PROJECT, post_id: post.id });

    expect(data.deleted).toBe(true);
    expect(data.post_id).toBe(post.id);

    // Verify it's gone
    const { isError } = await callTool("kilroy_read_post", { project: TEST_PROJECT, post_id: post.id });
    expect(isError).toBe(true);
  });

  it("returns error for non-existent post", async () => {
    const { data, isError } = await callTool("kilroy_delete_post", {
      project: TEST_PROJECT,
      post_id: "nonexistent",
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("NOT_FOUND");
  });
});
