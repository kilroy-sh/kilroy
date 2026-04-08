import { describe, expect, it } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { generateInstallScript } from "../src/routes/install";

describe("generateInstallScript", () => {
  it("includes Codex and Claude setup paths in the generated shell script", () => {
    const script = generateInstallScript(
      "https://kilroy.sh/srijan/sagaland",
      "klry_mem_test_123",
      "sagaland",
    );

    expect(script).toContain("#!/usr/bin/env sh");
    expect(script).toContain(".codex/config.toml");
    expect(script).toContain("[mcp_servers.kilroy]");
    expect(script).toContain('url = "https://kilroy.sh/srijan/sagaland/mcp"');
    expect(script).toContain(
      'http_headers = { Authorization = "Bearer klry_mem_test_123" }',
    );
    expect(script).toContain("[mcp_servers.kilroy.tools.kilroy_search]");
    expect(script).toContain("[mcp_servers.kilroy.tools.kilroy_browse]");
    expect(script).toContain('approval_mode = "approve"');
    expect(script).toContain('.agents/plugins/marketplace.json');
    expect(script).toContain('[plugins."kilroy@');
    expect(script).toContain('[projects."');
    expect(script).toContain('trust_level = "trusted"');
    expect(script).toContain(".claude/settings.local.json");
    expect(script).toContain("claude plugin install");
    expect(script).toContain("Claude Code not found; skipping Claude-specific plugin install.");
  });

  it("bootstraps Codex plugin state when executed in a repo", () => {
    const root = mkdtempSync(join(tmpdir(), "kilroy-install-"));
    const homeDir = join(root, "home");
    const projectDir = join(root, "project");
    const binDir = join(root, "bin");
    const scriptPath = join(root, "install.sh");

    mkdirSync(homeDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    const bunPath = Bun.which("bun");
    expect(bunPath).toBeTruthy();
    const bunShim = join(binDir, "bun");
    writeFileSync(bunShim, `#!/usr/bin/env sh\nexec "${bunPath}" "$@"\n`);
    chmodSync(bunShim, 0o755);

    const script = generateInstallScript(
      "https://kilroy.sh/srijan/sagaland",
      "klry_mem_test_123",
      "sagaland",
    );
    writeFileSync(scriptPath, script);
    chmodSync(scriptPath, 0o755);

    const result = Bun.spawnSync({
      cmd: ["/bin/sh", scriptPath],
      cwd: projectDir,
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = Buffer.from(result.stdout).toString("utf8");
    const stderr = Buffer.from(result.stderr).toString("utf8");

    expect(result.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Installing Kilroy plugin for Codex...");
    expect(stdout).toContain("Codex: start a new session in this repo");

    const projectConfig = readFileSync(
      join(projectDir, ".codex/config.toml"),
      "utf8",
    );
    expect(projectConfig).toContain("[mcp_servers.kilroy]");
    expect(projectConfig).toContain(
      'url = "https://kilroy.sh/srijan/sagaland/mcp"',
    );
    expect(projectConfig).toContain("[mcp_servers.kilroy.tools.kilroy_search]");
    expect(projectConfig).toContain("[mcp_servers.kilroy.tools.kilroy_browse]");
    expect(projectConfig).toContain('approval_mode = "approve"');

    const marketplace = JSON.parse(
      readFileSync(join(homeDir, ".agents/plugins/marketplace.json"), "utf8"),
    );
    expect(marketplace.plugins.some((plugin: any) => plugin.name === "kilroy")).toBe(
      true,
    );

    const homePluginManifestPath = join(
      homeDir,
      ".agents/plugins/kilroy/.codex-plugin/plugin.json",
    );
    expect(existsSync(homePluginManifestPath)).toBe(true);
    const homePluginManifest = JSON.parse(
      readFileSync(homePluginManifestPath, "utf8"),
    );
    expect(homePluginManifest.skills).toBe("./skills/");
    expect(homePluginManifest.mcpServers).toBeUndefined();

    const cachePluginManifestPath = join(
      homeDir,
      `.codex/plugins/cache/${marketplace.name}/kilroy/local/.codex-plugin/plugin.json`,
    );
    expect(existsSync(cachePluginManifestPath)).toBe(true);

    const homeCodexConfig = readFileSync(
      join(homeDir, ".codex/config.toml"),
      "utf8",
    );
    expect(homeCodexConfig).toContain(`[plugins."kilroy@${marketplace.name}"]`);
    expect(homeCodexConfig).toContain("enabled = true");
    expect(homeCodexConfig).toContain(`[projects."${realpathSync(projectDir)}"]`);
    expect(homeCodexConfig).toContain('trust_level = "trusted"');
  });
});
