import test from "node:test";
import assert from "node:assert/strict";

import { classifyToolRisk } from "../../plugins/harness-engineering/scripts/lib/harness/risk-classify.mjs";

const rules = [
  { name: "no-rm-rf", pattern: "rm\\s+-rf?\\s+/", severity: "critical", applies_to: ["Bash"] },
  { name: "cred-write", pattern: "(?:AWS_SECRET|OPENAI_API_KEY)\\s*=", severity: "high", applies_to: ["Bash", "Write"] },
  { name: "sudo", pattern: "\\bsudo\\b", severity: "medium", applies_to: ["Bash"] },
  { name: "write-outside", pattern: "\\.\\./\\.\\./|/etc/|/usr/", severity: "high", applies_to: ["Write", "Edit"] },
];

test("classifyToolRisk returns critical for rm -rf /", () => {
  const result = classifyToolRisk("Bash", { command: "rm -rf /" }, rules);
  assert.equal(result.level, "critical");
});

test("classifyToolRisk returns low with no matched rule for benign command", () => {
  const result = classifyToolRisk("Bash", { command: "ls -la" }, rules);
  assert.equal(result.level, "low");
  assert.equal(result.matchedRule, null);
});

test("classifyToolRisk returns medium for sudo", () => {
  const result = classifyToolRisk("Bash", { command: "sudo apt install" }, rules);
  assert.equal(result.level, "medium");
});

test("classifyToolRisk returns high for write to /etc/passwd", () => {
  const result = classifyToolRisk("Write", { file_path: "/etc/passwd" }, rules);
  assert.equal(result.level, "high");
});

test("classifyToolRisk returns low for unmatched tool type", () => {
  const result = classifyToolRisk("Read", { file_path: "src/index.js" }, rules);
  assert.equal(result.level, "low");
});

test("classifyToolRisk supports custom rules", () => {
  const customRules = [
    ...rules,
    { name: "trunc", pattern: "TRUNCATE\\s+TABLE", severity: "high", applies_to: ["Bash"] },
  ];
  const result = classifyToolRisk("Bash", { command: "TRUNCATE TABLE" }, customRules);
  assert.equal(result.level, "high");
});

test("applies_to filtering prevents cross-tool matches", () => {
  // The "sudo" rule only applies_to ["Bash"], so "Write" tool should not match it
  const result = classifyToolRisk("Write", { command: "sudo something" }, rules);
  assert.equal(result.level, "low");
});

test("severity ordering: critical is matched before medium", () => {
  // A command that matches both critical (rm -rf /) and medium (sudo)
  const result = classifyToolRisk("Bash", { command: "sudo rm -rf /" }, rules);
  assert.equal(result.level, "critical");
});
