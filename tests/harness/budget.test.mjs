import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  initBudget,
  recordToolCall,
  checkPromptBudget,
  getBudgetUsage,
} from "../../plugins/codex/scripts/lib/harness/budget.mjs";

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), "budget-test-" + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test("initBudget creates budget JSON file", () => {
  const dir = makeTmpDir();
  const sid = "sess-init";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  const usage = getBudgetUsage(dir, sid);
  assert.equal(typeof usage, "object");
  assert.equal(usage.totalCalls, 0);
  assert.equal(usage.totalPromptTokens, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("recordToolCall increments call counter", () => {
  const dir = makeTmpDir();
  const sid = "sess-inc";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  recordToolCall(dir, sid, "Bash");
  const usage = getBudgetUsage(dir, sid);
  assert.equal(usage.totalCalls, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("3x recordToolCall produces totalCalls=3", () => {
  const dir = makeTmpDir();
  const sid = "sess-3x";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  recordToolCall(dir, sid, "Bash");
  recordToolCall(dir, sid, "Bash");
  recordToolCall(dir, sid, "Bash");
  const usage = getBudgetUsage(dir, sid);
  assert.equal(usage.totalCalls, 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("checkPromptBudget returns allowed:true when under limit", () => {
  const dir = makeTmpDir();
  const sid = "sess-under";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  const result = checkPromptBudget(dir, sid, 500);
  assert.equal(result.allowed, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("checkPromptBudget returns allowed:false when over limit", () => {
  const dir = makeTmpDir();
  const sid = "sess-over";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  const result = checkPromptBudget(dir, sid, 20000);
  assert.equal(result.allowed, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("getBudgetUsage returns correct totals", () => {
  const dir = makeTmpDir();
  const sid = "sess-totals";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  recordToolCall(dir, sid, "Bash");
  recordToolCall(dir, sid, "Read");
  const usage = getBudgetUsage(dir, sid);
  assert.equal(usage.totalCalls, 2);
  assert.equal(typeof usage.totalPromptTokens, "number");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("corrupted budget file returns zeroed state", () => {
  const dir = makeTmpDir();
  const sid = "sess-corrupt";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 10000 });
  // Overwrite the budget file with garbage
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (f.includes(sid) || files.length === 1) {
      fs.writeFileSync(full, "NOT-JSON{{{{", "utf8");
    }
  }
  const usage = getBudgetUsage(dir, sid);
  assert.equal(usage.totalCalls, 0);
  assert.equal(usage.totalPromptTokens, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("max_prompt_tokens=0 (unlimited) is always allowed", () => {
  const dir = makeTmpDir();
  const sid = "sess-unlimited";
  initBudget(dir, sid, { max_tool_calls: 500, max_prompt_tokens: 0 });
  const result = checkPromptBudget(dir, sid, 999999999);
  assert.equal(result.allowed, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
