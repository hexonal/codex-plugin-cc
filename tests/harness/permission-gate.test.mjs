import test from "node:test";
import assert from "node:assert/strict";

import { checkPermission } from "../../plugins/harness-engineering/scripts/lib/harness/permission-gate.mjs";

const profile = {
  blockOn: ["critical"],
  requireApprovalOn: ["high"],
  alwaysAllow: ["Read", "Glob", "Grep", "LS"],
  alwaysBlock: [],
};

test("checkPermission allows low-risk tool calls", () => {
  const result = checkPermission({ level: "low" }, profile, "Bash");
  assert.equal(result.allow, true);
});

test("checkPermission blocks critical-risk tool calls", () => {
  const result = checkPermission({ level: "critical" }, profile, "Bash");
  assert.equal(result.allow, false);
  assert.match(result.reason, /blocked/i);
});

test("checkPermission requires approval for high-risk tool calls", () => {
  const result = checkPermission({ level: "high" }, profile, "Bash");
  assert.equal(result.allow, false);
  assert.match(result.reason, /approval/i);
});

test("checkPermission allows medium-risk tool calls", () => {
  const result = checkPermission({ level: "medium" }, profile, "Bash");
  assert.equal(result.allow, true);
});

test("checkPermission allows alwaysAllow tools even at critical risk", () => {
  const result = checkPermission({ level: "critical" }, profile, "Read");
  assert.equal(result.allow, true);
});

test("checkPermission blocks alwaysBlock tools unconditionally", () => {
  const blockProfile = { ...profile, alwaysBlock: ["Danger"] };
  const result = checkPermission({ level: "low" }, blockProfile, "Danger");
  assert.equal(result.allow, false);
});

test("checkPermission blocks nothing by severity when blockOn is empty", () => {
  const emptyBlockProfile = { ...profile, blockOn: [], requireApprovalOn: [] };
  const result = checkPermission({ level: "critical" }, emptyBlockProfile, "Bash");
  assert.equal(result.allow, true);
});
