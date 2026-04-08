#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { classifyToolRisk } from "./lib/harness/risk-classify.mjs";
import { checkPermission } from "./lib/harness/permission-gate.mjs";
import { appendAuditEntry } from "./lib/harness/audit-log.mjs";
import { getTraceId } from "./lib/harness/trace.mjs";

/**
 * Lightweight YAML-subset parser that handles nested arrays within
 * array-of-objects (which the built-in mini parser does not).
 */
function parseConstitutionFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const lines = text.split("\n");
  return parseMap(lines, { i: 0 }, 0);
}

function parseMap(lines, state, indent) {
  const result = {};
  while (state.i < lines.length) {
    const line = lines[state.i];
    if (line.trim() === "" || line.trim().startsWith("#")) { state.i++; continue; }
    const li = line.search(/\S/);
    if (li < indent) break;
    if (li > indent) break;
    const m = line.match(/^(\s*)([\w_-]+):\s*(.*)/);
    if (!m) break;
    const key = m[2];
    const rest = m[3].trim();
    if (rest !== "") {
      result[key] = scalar(rest);
      state.i++;
    } else {
      state.i++;
      skipEmpty(lines, state);
      if (state.i >= lines.length) { result[key] = null; continue; }
      const ni = lines[state.i].search(/\S/);
      if (ni <= indent) { result[key] = null; continue; }
      if (lines[state.i].trimStart().startsWith("- ")) {
        result[key] = parseArray(lines, state, ni);
      } else {
        result[key] = parseMap(lines, state, ni);
      }
    }
  }
  return result;
}

function parseArray(lines, state, indent) {
  const arr = [];
  while (state.i < lines.length) {
    const line = lines[state.i];
    if (line.trim() === "" || line.trim().startsWith("#")) { state.i++; continue; }
    const li = line.search(/\S/);
    if (li !== indent) break;
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("- ")) break;
    const after = trimmed.slice(2).trim();
    const kv = after.match(/^([\w_-]+):\s*(.*)/);
    if (kv) {
      const obj = {};
      obj[kv[1]] = scalar(kv[2].trim());
      state.i++;
      // Read continuation keys for this object item
      while (state.i < lines.length) {
        const cl = lines[state.i];
        if (cl.trim() === "") { state.i++; continue; }
        const ci = cl.search(/\S/);
        if (ci <= indent) break;
        const ct = cl.trimStart();
        if (ct.startsWith("- ")) break;
        const ckv = ct.match(/^([\w_-]+):\s*(.*)/);
        if (ckv) {
          const crest = ckv[2].trim();
          if (crest !== "") {
            obj[ckv[1]] = scalar(crest);
            state.i++;
          } else {
            // Nested value (array or map) under this key
            state.i++;
            skipEmpty(lines, state);
            if (state.i >= lines.length) { obj[ckv[1]] = null; continue; }
            const ni = lines[state.i].search(/\S/);
            if (ni <= ci) { obj[ckv[1]] = null; continue; }
            if (lines[state.i].trimStart().startsWith("- ")) {
              obj[ckv[1]] = parseArray(lines, state, ni);
            } else {
              obj[ckv[1]] = parseMap(lines, state, ni);
            }
          }
        } else {
          break;
        }
      }
      arr.push(obj);
    } else {
      arr.push(scalar(after));
      state.i++;
    }
  }
  return arr;
}

function skipEmpty(lines, state) {
  while (state.i < lines.length && (lines[state.i].trim() === "" || lines[state.i].trim().startsWith("#"))) {
    state.i++;
  }
}

function scalar(s) {
  if (s === "") return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    // Process basic escape sequences for double-quoted strings
    const inner = s.slice(1, -1);
    if (s.startsWith('"')) {
      return inner.replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    }
    return inner;
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (s === "[]") return [];
  const n = Number(s);
  if (!isNaN(n) && s !== "") return n;
  return s;
}

// ---------------------------------------------------------------------------

try {
  const raw = fs.readFileSync(0, "utf8");
  const input = JSON.parse(raw);

  const cwd = input.cwd;
  const workspaceRoot = cwd;

  const constitutionPath = path.join(workspaceRoot, ".codex-harness", "constitution.yaml");
  const constitution = parseConstitutionFile(constitutionPath);
  if (!constitution || constitution.mode === "off") {
    process.exit(0);
  }

  // Extract and validate risk rules
  const riskRules = (Array.isArray(constitution.risk_rules) ? constitution.risk_rules : []).filter((rule) => {
    if (!rule.pattern) return false;
    try { new RegExp(rule.pattern); return true; } catch { return false; }
  });

  const riskResult = classifyToolRisk(input.tool_name, input.tool_input, riskRules);

  // Build permission profile supporting both camelCase and snake_case keys
  const p = constitution.permissions || {};
  const profile = {
    blockOn: Array.isArray(p.blockOn) ? p.blockOn : Array.isArray(p.block_on) ? p.block_on : [],
    requireApprovalOn: Array.isArray(p.requireApprovalOn) ? p.requireApprovalOn : Array.isArray(p.require_approval_on) ? p.require_approval_on : [],
    alwaysAllow: Array.isArray(p.alwaysAllow) ? p.alwaysAllow : Array.isArray(p.always_allow) ? p.always_allow : [],
    alwaysBlock: Array.isArray(p.alwaysBlock) ? p.alwaysBlock : Array.isArray(p.always_block) ? p.always_block : [],
  };

  const permission = checkPermission(riskResult, profile, input.tool_name);

  // In audit-only mode, allow regardless
  if (constitution.mode === "audit-only") {
    permission.allow = true;
  }

  // Append audit entry
  appendAuditEntry(workspaceRoot, {
    sessionId: input.session_id,
    event: "PreToolUse",
    toolName: input.tool_name,
    risk: riskResult,
    permission,
    traceId: getTraceId(),
  });

  if (!permission.allow) {
    process.stdout.write(JSON.stringify({ decision: "block", reason: permission.reason }));
  }

  process.exit(0);
} catch (err) {
  process.stderr.write("harness-pre-tool-hook error: " + err.message + "\n");
  process.exit(0);
}
