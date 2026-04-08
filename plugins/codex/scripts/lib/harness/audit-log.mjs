import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = "harness-audit.jsonl";

/**
 * Append audit event to the JSONL log.
 * @param {string} stateDir
 * @param {object} event
 */
export function auditEvent(stateDir, event) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      ...event
    };
    fs.appendFileSync(path.join(stateDir, AUDIT_FILE), JSON.stringify(entry) + "\n");
  } catch { /* audit must never throw */ }
}
