import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_START_HOOK = path.resolve(
  __dirname,
  "../../plugins/codex/scripts/harness-session-start-hook.mjs",
);
const SESSION_END_HOOK = path.resolve(
  __dirname,
  "../../plugins/codex/scripts/harness-session-end-hook.mjs",
);

const CONSTITUTION_YAML = `\
version: 1
mode: standard
risk_rules: []
permissions:
  blockOn: []
  alwaysAllow: []
`;

let tempDirs = [];

function makeTempDir(prefix = "session-hooks-test-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeConstitution(dir) {
  const constitutionDir = path.join(dir, ".codex-harness");
  fs.mkdirSync(constitutionDir, { recursive: true });
  fs.writeFileSync(
    path.join(constitutionDir, "constitution.yaml"),
    CONSTITUTION_YAML,
  );
}

function runHook(scriptPath, stdin, env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    input: stdin,
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, ...env },
  });
}

afterEach(() => {
  for (const d of tempDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("harness-session-start-hook", () => {
  it("with constitution -> creates trace ID in CLAUDE_ENV_FILE", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const envFile = path.join(dir, "claude-env.txt");
    const pluginDataDir = path.join(dir, "plugin-data");
    fs.mkdirSync(pluginDataDir, { recursive: true });

    const stdin = JSON.stringify({
      session_id: "test",
      hook_event_name: "SessionStart",
      cwd: dir,
    });

    const result = runHook(SESSION_START_HOOK, stdin, {
      CLAUDE_ENV_FILE: envFile,
      CLAUDE_PLUGIN_DATA: pluginDataDir,
    });

    assert.equal(result.status, 0);
    // The hook should have written a trace ID to the env file
    assert.ok(fs.existsSync(envFile), "expected CLAUDE_ENV_FILE to be created");
    const envContent = fs.readFileSync(envFile, "utf8");
    assert.ok(
      envContent.includes("TRACE_ID") || envContent.includes("trace"),
      "expected trace ID in env file",
    );
  });

  it("without constitution -> exits 0, no env writes", () => {
    const dir = makeTempDir();
    const envFile = path.join(dir, "claude-env.txt");
    const pluginDataDir = path.join(dir, "plugin-data");
    fs.mkdirSync(pluginDataDir, { recursive: true });

    const stdin = JSON.stringify({
      session_id: "test",
      hook_event_name: "SessionStart",
      cwd: dir,
    });

    const result = runHook(SESSION_START_HOOK, stdin, {
      CLAUDE_ENV_FILE: envFile,
      CLAUDE_PLUGIN_DATA: pluginDataDir,
    });

    assert.equal(result.status, 0);
    // Without constitution, no env file should be written (or it should be empty)
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf8").trim();
      assert.equal(content, "", "expected no env writes without constitution");
    }
  });
});

describe("harness-session-end-hook", () => {
  it("with constitution -> exits 0", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const pluginDataDir = path.join(dir, "plugin-data");
    fs.mkdirSync(pluginDataDir, { recursive: true });

    const stdin = JSON.stringify({
      session_id: "test",
      hook_event_name: "SessionEnd",
      cwd: dir,
    });

    const result = runHook(SESSION_END_HOOK, stdin, {
      CLAUDE_PLUGIN_DATA: pluginDataDir,
    });

    assert.equal(result.status, 0);
  });
});
