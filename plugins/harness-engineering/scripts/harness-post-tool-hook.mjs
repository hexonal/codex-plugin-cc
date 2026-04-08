#!/usr/bin/env node
import fs from "node:fs";
import { loadConstitution } from "./lib/harness/constitution.mjs";
import { sanitizeOutput } from "./lib/harness/sanitize.mjs";
import { appendAuditEntry } from "./lib/harness/audit-log.mjs";
import { recordToolCall } from "./lib/harness/budget.mjs";
import { getTraceId } from "./lib/harness/trace.mjs";

try {
  const raw = fs.readFileSync(0, "utf8");
  const input = JSON.parse(raw);

  const cwd = input.cwd;
  const workspaceRoot = cwd;

  const constitution = loadConstitution(workspaceRoot);
  if (!constitution || constitution.mode === "off") {
    process.exit(0);
  }

  const output = input.tool_response && input.tool_response.output ? input.tool_response.output : "";

  const sanitizeResult = sanitizeOutput(output, constitution.sanitize);

  // Append audit entry
  appendAuditEntry(workspaceRoot, {
    sessionId: input.session_id,
    event: "PostToolUse",
    toolName: input.tool_name,
    sanitized: sanitizeResult.modified,
    redactions: sanitizeResult.redactions,
    traceId: getTraceId(),
  });

  // Record tool call for budget (ignore errors if budget file doesn't exist)
  try {
    recordToolCall(workspaceRoot, input.session_id, input.tool_name);
  } catch {
    // budget file may not be initialized
  }

  if (sanitizeResult.modified) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { permittedOutput: sanitizeResult.output },
    }));
  }

  process.exit(0);
} catch (err) {
  process.stderr.write("harness-post-tool-hook error: " + err.message + "\n");
  process.exit(0);
}
