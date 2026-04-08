#!/usr/bin/env node
import fs from "node:fs";
import { loadConstitution } from "./lib/harness/constitution.mjs";
import { getBudgetUsage } from "./lib/harness/budget.mjs";
import { appendAuditEntry } from "./lib/harness/audit-log.mjs";

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const constitution = loadConstitution(input.cwd);

  if (!constitution || constitution.mode === "off") {
    process.exit(0);
  }

  const usage = getBudgetUsage(input.cwd, input.session_id);

  appendAuditEntry(input.cwd, {
    sessionId: input.session_id,
    event: "session_end",
    budgetSummary: usage,
  });

  process.exit(0);
} catch (err) {
  process.stderr.write("harness-session-end-hook: " + err.message + "\n");
  process.exit(0);
}
