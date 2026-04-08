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
  "../../plugins/codex/scripts/harness-prompt-submit-hook.mjs",
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

function makeTempDir(prefix = "prompt-submit-hook-test-") {
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

function writeBudgetFile(dir, totalTokens) {
  const constitutionDir = path.join(dir, ".codex-harness");
  fs.mkdirSync(constitutionDir, { recursive: true });
  fs.writeFileSync(
    path.join(constitutionDir, "budget.json"),
    JSON.stringify({ totalTokens, maxTokens: 100_000 }),
  );
}

function makeStdin(prompt, cwd) {
  return JSON.stringify({
    session_id: "test",
    hook_event_name: "UserPromptSubmit",
    prompt,
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

describe("harness-prompt-submit-hook", () => {
  it("under budget -> exits 0, no stdout", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    writeBudgetFile(dir, 1_000);
    const result = runHook(makeStdin("hello", dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });

  it("over budget -> exits 0, stdout contains block decision", () => {
    const dir = makeTempDir();
    writeConstitution(dir);
    writeBudgetFile(dir, 999_999);
    const result = runHook(makeStdin("hello", dir));
    assert.equal(result.status, 0);
    const output = result.stdout.trim();
    assert.ok(output.length > 0, "expected non-empty stdout");
    const parsed = JSON.parse(output);
    assert.equal(parsed.decision, "block");
  });

  it("no constitution -> exits 0", () => {
    const dir = makeTempDir();
    const result = runHook(makeStdin("hello", dir));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });
});
