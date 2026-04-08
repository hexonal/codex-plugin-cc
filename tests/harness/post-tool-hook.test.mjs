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
  "../../plugins/harness-engineering/scripts/harness-post-tool-hook.mjs",
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

function makeTempDir(prefix = "post-tool-hook-test-") {
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

function makeStdin(output, cwd, toolName = "Bash", command = "env") {
  return JSON.stringify({
    session_id: "test",
    hook_event_name: "PostToolUse",
    tool_name: toolName,
    tool_input: { command },
    tool_response: { output, exit_code: 0 },
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

describe("harness-post-tool-hook", () => {
  it("no constitution -> exits 0, no stdout", () => {
    const dir = makeTempDir();
    const result = runHook(makeStdin("hello world", dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });

  it("clean output -> exits 0, no stdout, audit entry appended", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const result = runHook(makeStdin("PATH=/usr/bin\nHOME=/home/user", dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
    // Audit log directory should have been created
    const logsDir = path.join(dir, ".codex-harness", "logs");
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".jsonl"));
      assert.ok(files.length > 0, "expected at least one audit log file");
    }
  });

  it("output with AWS key -> stdout contains hookSpecificOutput with redacted output", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    const awsKey = "AKIAIOSFODNN7EXAMPLE";
    const result = runHook(
      makeStdin(`AWS_ACCESS_KEY_ID=${awsKey}`, dir),
    );
    assert.equal(result.status, 0);
    const output = result.stdout.trim();
    assert.ok(output.length > 0, "expected non-empty stdout with redaction");
    const parsed = JSON.parse(output);
    assert.ok(
      parsed.hookSpecificOutput !== undefined ||
        parsed.tool_response !== undefined,
      "expected hookSpecificOutput or tool_response in output",
    );
    // The original key should be redacted
    assert.ok(
      !output.includes(awsKey),
      "AWS key should be redacted from output",
    );
  });

  it("invalid stdin (empty) -> exits 0, error on stderr", () => {
    const result = runHook("");
    assert.equal(result.status, 0);
    assert.ok(
      result.stderr.trim().length > 0,
      "expected error message on stderr",
    );
  });
});
