import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resolveAuditLogFile,
  appendAuditEntry,
  pruneAuditLogs,
} from "../../plugins/codex/scripts/lib/harness/audit-log.mjs";

/** Collect temp dirs for cleanup. */
let tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-log-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tempDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tempDirs = [];
});

/** Build a minimal valid entry for appendAuditEntry. */
function sampleEntry(overrides = {}) {
  return {
    traceId: "trace-001",
    sessionId: "sess1",
    event: "tool_call",
    toolName: "bash",
    riskLevel: "low",
    decision: "allow",
    durationMs: 42,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveAuditLogFile
// ---------------------------------------------------------------------------

describe("resolveAuditLogFile", () => {
  it('returns path containing "audit-sess1.jsonl"', () => {
    const root = makeTempDir();
    const filePath = resolveAuditLogFile(root, "sess1");
    assert.ok(filePath.includes("audit-sess1.jsonl"));
  });
});

// ---------------------------------------------------------------------------
// appendAuditEntry
// ---------------------------------------------------------------------------

describe("appendAuditEntry", () => {
  it("creates file and appends one JSON line", () => {
    const root = makeTempDir();
    appendAuditEntry(root, sampleEntry());
    const logFile = resolveAuditLogFile(root, "sess1");
    assert.ok(fs.existsSync(logFile));
    const lines = fs.readFileSync(logFile, "utf-8").trim().split("\n");
    assert.strictEqual(lines.length, 1);
    // Should be valid JSON
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.toolName, "bash");
  });

  it("appends a second line on second call", () => {
    const root = makeTempDir();
    appendAuditEntry(root, sampleEntry({ traceId: "trace-001" }));
    appendAuditEntry(root, sampleEntry({ traceId: "trace-002" }));
    const logFile = resolveAuditLogFile(root, "sess1");
    const lines = fs.readFileSync(logFile, "utf-8").trim().split("\n");
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(JSON.parse(lines[0]).traceId, "trace-001");
    assert.strictEqual(JSON.parse(lines[1]).traceId, "trace-002");
  });

  it("entry has all required fields", () => {
    const root = makeTempDir();
    appendAuditEntry(root, sampleEntry());
    const logFile = resolveAuditLogFile(root, "sess1");
    const entry = JSON.parse(
      fs.readFileSync(logFile, "utf-8").trim().split("\n")[0],
    );
    const requiredFields = [
      "traceId",
      "ts",
      "sessionId",
      "event",
      "toolName",
      "riskLevel",
      "decision",
      "durationMs",
    ];
    for (const field of requiredFields) {
      assert.ok(
        field in entry,
        `Missing required field: ${field}`,
      );
    }
  });

  it("ts is ISO 8601 format", () => {
    const root = makeTempDir();
    appendAuditEntry(root, sampleEntry());
    const logFile = resolveAuditLogFile(root, "sess1");
    const entry = JSON.parse(
      fs.readFileSync(logFile, "utf-8").trim().split("\n")[0],
    );
    // ISO 8601 check: Date.parse should succeed and toISOString round-trips
    const parsed = new Date(entry.ts);
    assert.ok(!isNaN(parsed.getTime()), "ts should be a valid date");
    // Verify it looks like ISO format (contains T and ends with Z or offset)
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T/.test(entry.ts),
      "ts should be ISO 8601 format",
    );
  });

  it("durationMs is a non-negative integer", () => {
    const root = makeTempDir();
    appendAuditEntry(root, sampleEntry({ durationMs: 0 }));
    const logFile = resolveAuditLogFile(root, "sess1");
    const entry = JSON.parse(
      fs.readFileSync(logFile, "utf-8").trim().split("\n")[0],
    );
    assert.strictEqual(typeof entry.durationMs, "number");
    assert.ok(Number.isInteger(entry.durationMs));
    assert.ok(entry.durationMs >= 0);
  });

  it("does not throw when directory is read-only", () => {
    const root = makeTempDir();
    const readOnlyDir = path.join(root, "readonly");
    fs.mkdirSync(readOnlyDir);
    fs.chmodSync(readOnlyDir, 0o444);
    // Should not throw — errors are caught internally
    assert.doesNotThrow(() => {
      appendAuditEntry(readOnlyDir, sampleEntry());
    });
    // Restore permissions for cleanup
    fs.chmodSync(readOnlyDir, 0o755);
  });
});

// ---------------------------------------------------------------------------
// pruneAuditLogs
// ---------------------------------------------------------------------------

describe("pruneAuditLogs", () => {
  it("keeps only the 2 newest files when 4 exist", async () => {
    const root = makeTempDir();
    const logsDir = path.join(root, ".codex-harness", "logs");
    fs.mkdirSync(logsDir, { recursive: true });

    // Create 4 audit files with staggered mtimes
    const files = [
      "audit-oldest.jsonl",
      "audit-old.jsonl",
      "audit-new.jsonl",
      "audit-newest.jsonl",
    ];
    const now = Date.now();
    for (let i = 0; i < files.length; i++) {
      const fp = path.join(logsDir, files[i]);
      fs.writeFileSync(fp, `{"line":${i}}\n`);
      // Set mtime: oldest first
      const mtime = new Date(now - (files.length - i) * 60_000);
      fs.utimesSync(fp, mtime, mtime);
    }

    pruneAuditLogs(root, 2);

    const remaining = fs
      .readdirSync(logsDir)
      .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
      .sort();

    assert.strictEqual(remaining.length, 2);
    // The two newest should survive
    assert.ok(remaining.includes("audit-new.jsonl"));
    assert.ok(remaining.includes("audit-newest.jsonl"));
  });
});
