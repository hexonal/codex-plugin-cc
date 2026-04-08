import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_SCRIPT = path.resolve(
  __dirname,
  "../../plugins/codex/scripts/harness-pre-tool-hook.mjs",
);

const CONSTITUTION_YAML = `\
version: 1
mode: standard
risk_rules:
  - name: no-rm-rf
    pattern: "rm\\\\s+-rf"
    severity: critical
    applies_to:
      - Bash
permissions:
  blockOn:
    - critical
  alwaysAllow:
    - Read
`;

const CONSTITUTION_OFF_YAML = `\
version: 1
mode: "off"
risk_rules: []
permissions:
  blockOn: []
  alwaysAllow: []
`;

let tempDirs = [];

function makeTempDir(prefix = "pre-tool-hook-test-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeConstitution(dir, yaml = CONSTITUTION_YAML) {
  const constitutionDir = path.join(dir, ".codex-harness");
  fs.mkdirSync(constitutionDir, { recursive: true });
  fs.writeFileSync(path.join(constitutionDir, "constitution.yaml"), yaml);
}

function makeStdin(toolName, toolInput, cwd) {
  return JSON.stringify({
    session_id: "test",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    cwd,
  });
}

function runHook(stdin) {
  return spawnSync(process.execPath, [HOOK_SCRIPT], {
    input: stdin,
    encoding: "utf8",
    timeout: 10_000,
  });
}

afterEach(() => {
  for (const d of tempDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("harness-pre-tool-hook", () => {
  it("no constitution file -> exits 0, no stdout", () => {
    const dir = makeTempDir();
    const result = runHook(makeStdin("Bash", { command: "ls -la" }, dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });

  it("constitution + safe command 'ls -la' -> exits 0, no stdout (allow)", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const result = runHook(makeStdin("Bash", { command: "ls -la" }, dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });

  it("constitution + 'rm -rf /' -> exits 0, stdout contains block decision", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const result = runHook(makeStdin("Bash", { command: "rm -rf /" }, dir));
    assert.equal(result.status, 0);
    const output = result.stdout.trim();
    assert.ok(output.length > 0, "expected non-empty stdout");
    const parsed = JSON.parse(output);
    assert.equal(parsed.decision, "block");
  });

  it("constitution + Read tool (alwaysAllow) -> exits 0 regardless of risk", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const result = runHook(
      makeStdin("Read", { file_path: "/etc/shadow" }, dir),
    );
    assert.equal(result.status, 0);
    // alwaysAllow means no block decision
    const output = result.stdout.trim();
    if (output) {
      const parsed = JSON.parse(output);
      assert.notEqual(parsed.decision, "block");
    }
  });

  it("constitution mode 'off' -> exits 0, no stdout", () => {
    const dir = makeTempDir();
    writeConstitution(dir, CONSTITUTION_OFF_YAML);
    const result = runHook(makeStdin("Bash", { command: "rm -rf /" }, dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });

  it("invalid stdin (empty) -> exits 0, error on stderr", () => {
    const result = runHook("");
    assert.equal(result.status, 0);
    assert.ok(result.stderr.trim().length > 0, "expected error message on stderr");
  });
});
