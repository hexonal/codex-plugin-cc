import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STOP_REVIEW_GATE_HOOK = path.resolve(
  __dirname,
  "../../plugins/codex/scripts/stop-review-gate-hook.mjs",
);

describe("verification-loop / stop-review-gate", () => {
  it("stop-review-gate-hook.mjs can be loaded without error", () => {
    assert.ok(
      fs.existsSync(STOP_REVIEW_GATE_HOOK),
      `expected ${STOP_REVIEW_GATE_HOOK} to exist`,
    );
    // Use --check flag to syntax-check without executing
    const result = spawnSync(process.execPath, ["--check", STOP_REVIEW_GATE_HOOK], {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.status, 0, `syntax check failed: ${result.stderr}`);
  });

  it("reads stdin JSON correctly (basic structural test)", () => {
    const stdin = JSON.stringify({
      session_id: "test",
      hook_event_name: "Stop",
      cwd: process.cwd(),
    });
    // The hook will try to run codex review which won't be available,
    // but it should still parse stdin and exit without crashing
    const result = spawnSync(process.execPath, [STOP_REVIEW_GATE_HOOK], {
      input: stdin,
      encoding: "utf8",
      timeout: 15_000,
    });
    // Accept exit 0 (no stop gate configured) or non-zero (review failed)
    // The key assertion is that it didn't crash with a parse error
    assert.ok(
      result.status !== null,
      "process should have exited (not been killed)",
    );
    // stderr should not contain JSON parse errors
    const stderr = result.stderr || "";
    assert.ok(
      !stderr.includes("SyntaxError: Unexpected token"),
      "should not have JSON parse errors",
    );
  });
});
