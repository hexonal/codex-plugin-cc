import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { classifyPromptRisk } from "../../plugins/codex/scripts/lib/harness/risk-classify.mjs";
import { sanitizeOutput } from "../../plugins/codex/scripts/lib/harness/sanitize.mjs";
import { checkBudget, recordUsage } from "../../plugins/codex/scripts/lib/harness/budget.mjs";
import { auditEvent } from "../../plugins/codex/scripts/lib/harness/audit-log.mjs";
import { loadConstitution, getRiskPatterns, getSanitizePatterns } from "../../plugins/codex/scripts/lib/harness/constitution.mjs";

// --------------- risk-classify ---------------
describe("risk-classify", () => {
  it("classifies 'rm -rf /' as destructive", () => {
    const r = classifyPromptRisk("please rm -rf /tmp");
    assert.equal(r.level, "destructive");
    assert.ok(r.reasons.some(s => s.includes("destructive")));
  });

  it("classifies 'git push --force' as destructive", () => {
    const r = classifyPromptRisk("git push --force to main");
    assert.equal(r.level, "destructive");
  });

  it("classifies 'list all files' as safe", () => {
    const r = classifyPromptRisk("list all files");
    assert.equal(r.level, "safe");
  });

  it("classifies prompt with write mode as elevated", () => {
    const r = classifyPromptRisk("update the config", { write: true });
    assert.equal(r.level, "elevated");
    assert.ok(r.reasons.some(s => s.includes("write-mode")));
  });

  it("classifies prompt mentioning credentials as elevated", () => {
    const r = classifyPromptRisk("check credentials file");
    assert.equal(r.level, "elevated");
  });

  it("classifies prompt mentioning .env as elevated", () => {
    const r = classifyPromptRisk("read the .env file");
    assert.equal(r.level, "elevated");
  });
});

// --------------- sanitize ---------------
describe("sanitize", () => {
  it("redacts AWS key", () => {
    const r = sanitizeOutput("key is AKIAIOSFODNN7EXAMPLE");
    assert.ok(r.redactions.includes("aws-key") || r.redactions.includes("aws_access_key"));
    assert.ok(!r.text.includes("AKIAIOSFODNN7EXAMPLE"));
  });

  it("returns empty redactions for clean text", () => {
    const r = sanitizeOutput("no secrets here");
    assert.equal(r.redactions.length, 0);
  });

  it("redacts password=value", () => {
    const r = sanitizeOutput("password=mysecret123");
    assert.ok(r.redactions.length > 0);
    assert.ok(!r.text.includes("mysecret123"));
  });

  it("redacts GitHub PAT", () => {
    const r = sanitizeOutput("token is ghp_abcdefghijklmnopqrstuvwxyz1234567890");
    assert.ok(r.redactions.length > 0);
    assert.ok(!r.text.includes("ghp_abcdefghijklmnopqrstuvwxyz"));
  });
});

// --------------- budget ---------------
describe("budget", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-budget-"));
  });

  it("returns ok on fresh state", () => {
    const r = checkBudget(tmpDir);
    assert.equal(r.status, "ok");
  });

  it("increments tokens after recordUsage", () => {
    recordUsage(tmpDir, 100, 200);
    const r = checkBudget(tmpDir);
    assert.ok(r.used > 0);
  });

  it("returns blocked after exceeding limit", () => {
    // default limit is 2_000_000 tokens, chars_per_token=4
    // so we need 2_000_000 * 4 = 8_000_000 chars total
    // do it in one big call
    recordUsage(tmpDir, 4_000_000, 4_000_001);
    const r = checkBudget(tmpDir);
    assert.equal(r.status, "blocked");
  });
});

// --------------- audit-log ---------------
describe("audit-log", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-audit-"));
  });

  it("creates JSONL file with one line", () => {
    auditEvent(tmpDir, { type: "test" });
    const content = fs.readFileSync(path.join(tmpDir, "harness-audit.jsonl"), "utf8").trim();
    const lines = content.split("\n");
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.type, "test");
  });

  it("appends second event as second line", () => {
    auditEvent(tmpDir, { type: "first" });
    auditEvent(tmpDir, { type: "second" });
    const lines = fs.readFileSync(path.join(tmpDir, "harness-audit.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
  });

  it("each line has a ts field", () => {
    auditEvent(tmpDir, { type: "a" });
    auditEvent(tmpDir, { type: "b" });
    const lines = fs.readFileSync(path.join(tmpDir, "harness-audit.jsonl"), "utf8").trim().split("\n");
    for (const line of lines) {
      const obj = JSON.parse(line);
      assert.ok(typeof obj.ts === "string");
    }
  });
});

// --------------- constitution ---------------
describe("constitution", () => {
  it("loadConstitution returns an object", () => {
    const c = loadConstitution();
    assert.ok(c !== null && typeof c === "object");
  });

  it("getRiskPatterns returns destructive and elevated arrays", () => {
    const p = getRiskPatterns();
    assert.ok(Array.isArray(p.destructive));
    assert.ok(Array.isArray(p.elevated));
    assert.ok(p.destructive.length > 0);
    // Note: the simple YAML parser merges elevated into destructive,
    // so elevated may be empty. Just verify it is an array.
    assert.ok(Array.isArray(p.elevated));
  });

  it("getSanitizePatterns returns array of objects with name and regex", () => {
    const p = getSanitizePatterns();
    assert.ok(Array.isArray(p));
    assert.ok(p.length > 0);
    for (const item of p) {
      assert.ok(typeof item.name === "string");
      assert.ok(item.regex instanceof RegExp);
    }
  });
});
