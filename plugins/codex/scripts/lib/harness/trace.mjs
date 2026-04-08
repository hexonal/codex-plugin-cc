import crypto from "node:crypto";
import fs from "node:fs";

export function generateTraceId() {
  return "hrns-" + crypto.randomBytes(8).toString("hex");
}

export function getTraceId() {
  return process.env.CODEX_HARNESS_TRACE_ID || null;
}

export function propagateTraceId(traceId) {
  const envFile = process.env.CLAUDE_ENV_FILE;
  fs.appendFileSync(envFile, `export CODEX_HARNESS_TRACE_ID=${traceId}\n`, "utf8");
}
