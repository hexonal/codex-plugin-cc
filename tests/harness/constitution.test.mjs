import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadConstitution,
  getRiskRules,
  getPermissionProfile,
  getBudgetLimits,
} from "../../plugins/harness-engineering/scripts/lib/harness/constitution.mjs";

/**
 * Helper: create a temp directory with .codex-harness/constitution.yaml
 * containing the given content. Returns the root temp dir path.
 */
function makeTempWithConstitution(yamlContent) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "constitution-test-"));
  const harnessDir = path.join(root, ".codex-harness");
  fs.mkdirSync(harnessDir, { recursive: true });
  if (yamlContent !== undefined) {
    fs.writeFileSync(path.join(harnessDir, "constitution.yaml"), yamlContent);
  }
  return root;
}

/** Helper: create a bare temp dir with no constitution file. */
function makeTempEmpty() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "constitution-test-"));
}

/** Collect temp dirs for cleanup. */
let tempDirs = [];

function tracked(dir) {
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tempDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tempDirs = [];
});

// ---------------------------------------------------------------------------
// loadConstitution
// ---------------------------------------------------------------------------

describe("loadConstitution", () => {
  it("returns parsed object when valid YAML exists", () => {
    const dir = tracked(
      makeTempWithConstitution(
        "version: 1\nmode: standard\nbudget:\n  max_tool_calls: 500\n  max_prompt_tokens: 100000",
      ),
    );
    const result = loadConstitution(dir);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.version, 1);
    assert.strictEqual(result.mode, "standard");
    assert.strictEqual(result.budget.max_tool_calls, 500);
    assert.strictEqual(result.budget.max_prompt_tokens, 100000);
  });

  it("returns null when file is missing", () => {
    const dir = tracked(makeTempEmpty());
    const result = loadConstitution(dir);
    assert.strictEqual(result, null);
  });

  it("returns null when YAML is malformed", () => {
    const dir = tracked(makeTempWithConstitution("{{invalid yaml"));
    const result = loadConstitution(dir);
    assert.strictEqual(result, null);
  });

  it('defaults invalid mode to "off"', () => {
    const dir = tracked(makeTempWithConstitution("version: 1\nmode: bogus"));
    const result = loadConstitution(dir);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.mode, "off");
  });

  it('recognizes mode "audit-only"', () => {
    const dir = tracked(
      makeTempWithConstitution("version: 1\nmode: audit-only"),
    );
    const result = loadConstitution(dir);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.mode, "audit-only");
  });

  it('recognizes mode "standard" and "off"', () => {
    const dirStd = tracked(
      makeTempWithConstitution("version: 1\nmode: standard"),
    );
    const dirOff = tracked(
      makeTempWithConstitution("version: 1\nmode: off"),
    );
    assert.strictEqual(loadConstitution(dirStd).mode, "standard");
    assert.strictEqual(loadConstitution(dirOff).mode, "off");
  });
});

// ---------------------------------------------------------------------------
// getRiskRules
// ---------------------------------------------------------------------------

describe("getRiskRules", () => {
  it("skips rules with invalid regex", () => {
    const yaml = [
      "version: 1",
      "mode: standard",
      "risk_rules:",
      '  - pattern: "[invalid("',
      "    level: high",
      '  - pattern: "^rm "',
      "    level: critical",
    ].join("\n");
    const dir = tracked(makeTempWithConstitution(yaml));
    const rules = getRiskRules(dir);
    // The invalid pattern should be silently skipped
    assert.ok(Array.isArray(rules));
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].level, "critical");
  });

  it("returns valid rules array", () => {
    const yaml = [
      "version: 1",
      "mode: standard",
      "risk_rules:",
      '  - pattern: "^sudo "',
      "    level: high",
      '  - pattern: "^rm -rf"',
      "    level: critical",
    ].join("\n");
    const dir = tracked(makeTempWithConstitution(yaml));
    const rules = getRiskRules(dir);
    assert.ok(Array.isArray(rules));
    assert.strictEqual(rules.length, 2);
    assert.strictEqual(rules[0].level, "high");
    assert.strictEqual(rules[1].level, "critical");
  });
});

// ---------------------------------------------------------------------------
// getPermissionProfile
// ---------------------------------------------------------------------------

describe("getPermissionProfile", () => {
  it("returns blockOn and alwaysAllow arrays", () => {
    const yaml = [
      "version: 1",
      "mode: standard",
      "permissions:",
      "  block_on:",
      "    - network_access",
      "  always_allow:",
      "    - file_read",
      "    - file_write",
    ].join("\n");
    const dir = tracked(makeTempWithConstitution(yaml));
    const profile = getPermissionProfile(dir);
    assert.ok(Array.isArray(profile.blockOn));
    assert.ok(Array.isArray(profile.alwaysAllow));
    assert.ok(profile.blockOn.includes("network_access"));
    assert.ok(profile.alwaysAllow.includes("file_read"));
    assert.ok(profile.alwaysAllow.includes("file_write"));
  });
});

// ---------------------------------------------------------------------------
// getBudgetLimits
// ---------------------------------------------------------------------------

describe("getBudgetLimits", () => {
  it("returns defaults for missing fields", () => {
    const dir = tracked(makeTempWithConstitution("version: 1\nmode: standard"));
    const limits = getBudgetLimits(dir);
    assert.ok(typeof limits === "object" && limits !== null);
    // Should have numeric defaults for standard budget keys
    assert.ok(typeof limits.max_tool_calls === "number");
    assert.ok(typeof limits.max_prompt_tokens === "number");
    assert.ok(limits.max_tool_calls > 0);
    assert.ok(limits.max_prompt_tokens > 0);
  });
});
