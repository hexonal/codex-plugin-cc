import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  generateTraceId,
  getTraceId,
  propagateTraceId,
} from "../../plugins/codex/scripts/lib/harness/trace.mjs";

test("generateTraceId() returns string matching expected pattern", () => {
  const id = generateTraceId();
  assert.match(id, /^hrns-[0-9a-f]{16}$/);
});

test("generateTraceId() returns unique values on successive calls", () => {
  const a = generateTraceId();
  const b = generateTraceId();
  assert.notEqual(a, b);
});

test("getTraceId() returns null when CODEX_HARNESS_TRACE_ID not set", () => {
  const prev = process.env.CODEX_HARNESS_TRACE_ID;
  delete process.env.CODEX_HARNESS_TRACE_ID;
  try {
    assert.equal(getTraceId(), null);
  } finally {
    if (prev !== undefined) process.env.CODEX_HARNESS_TRACE_ID = prev;
  }
});

test("getTraceId() returns env value when set", () => {
  const prev = process.env.CODEX_HARNESS_TRACE_ID;
  process.env.CODEX_HARNESS_TRACE_ID = "hrns-abc123";
  try {
    assert.equal(getTraceId(), "hrns-abc123");
  } finally {
    if (prev !== undefined) {
      process.env.CODEX_HARNESS_TRACE_ID = prev;
    } else {
      delete process.env.CODEX_HARNESS_TRACE_ID;
    }
  }
});

test("propagateTraceId() appends export line to CLAUDE_ENV_FILE", () => {
  const tmp = path.join(os.tmpdir(), `trace-test-${Date.now()}.env`);
  fs.writeFileSync(tmp, "", "utf8");
  const prevEnvFile = process.env.CLAUDE_ENV_FILE;
  process.env.CLAUDE_ENV_FILE = tmp;
  try {
    propagateTraceId("hrns-deadbeef01234567");
    const contents = fs.readFileSync(tmp, "utf8");
    assert.match(
      contents,
      /export CODEX_HARNESS_TRACE_ID=hrns-deadbeef01234567/,
    );
  } finally {
    if (prevEnvFile !== undefined) {
      process.env.CLAUDE_ENV_FILE = prevEnvFile;
    } else {
      delete process.env.CLAUDE_ENV_FILE;
    }
    fs.unlinkSync(tmp);
  }
});
