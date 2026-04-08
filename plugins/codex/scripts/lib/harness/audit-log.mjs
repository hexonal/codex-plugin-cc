import fs from "node:fs";
import path from "node:path";

const LOGS_DIR = ".codex-harness/logs";

export function resolveAuditLogFile(workspaceRoot, sessionId) {
  return path.join(workspaceRoot, LOGS_DIR, "audit-" + sessionId + ".jsonl");
}

export function appendAuditEntry(workspaceRoot, entry) {
  try {
    const logFile = resolveAuditLogFile(workspaceRoot, entry.sessionId);
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const record = { ...entry };
    if (!record.ts) {
      record.ts = new Date().toISOString();
    }
    fs.appendFileSync(logFile, JSON.stringify(record) + "\n");
  } catch (err) {
    process.stderr.write("audit-log: " + err.message + "\n");
  }
}

export function pruneAuditLogs(workspaceRoot, retainSessions) {
  const logsDir = path.join(workspaceRoot, LOGS_DIR);
  if (!fs.existsSync(logsDir)) return;

  const files = fs
    .readdirSync(logsDir)
    .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
    .map((f) => {
      const fp = path.join(logsDir, f);
      return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs };
    })
    .sort((a, b) => a.mtime - b.mtime);

  const toRemove = files.length - retainSessions;
  for (let i = 0; i < toRemove; i++) {
    fs.unlinkSync(files[i].path);
  }
}
