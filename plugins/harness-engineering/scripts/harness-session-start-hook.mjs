#!/usr/bin/env node
import fs from "node:fs";
import { loadConstitution } from "./lib/harness/constitution.mjs";
import { generateTraceId, propagateTraceId } from "./lib/harness/trace.mjs";
import { initBudget } from "./lib/harness/budget.mjs";
import { appendAuditEntry, pruneAuditLogs } from "./lib/harness/audit-log.mjs";
import { getBudgetLimits } from "./lib/harness/constitution.mjs";

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const constitution = loadConstitution(input.cwd);

  if (!constitution || constitution.mode === "off") {
    process.exit(0);
  }

  const traceId = generateTraceId();
  propagateTraceId(traceId);

  const limits = getBudgetLimits(input.cwd);
  initBudget(input.cwd, input.session_id, limits);

  pruneAuditLogs(input.cwd, 10);

  appendAuditEntry(input.cwd, {
    sessionId: input.session_id,
    event: "session_start",
    detail: "constitution_loaded",
    traceId,
  });

  process.exit(0);
} catch (err) {
  process.stderr.write("harness-session-start-hook: " + err.message + "\n");
  process.exit(0);
}
