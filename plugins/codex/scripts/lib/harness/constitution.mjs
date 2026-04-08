import fs from "node:fs";
import path from "node:path";

const VALID_MODES = new Set(["standard", "audit-only", "off"]);

/**
 * Minimal YAML subset parser. Handles scalars, nested maps (2-space indent),
 * arrays of strings, and arrays of objects.
 */
function parseYaml(text) {
  const lines = text.split("\n");
  try {
    return parseBlock(lines, 0, 0).value;
  } catch {
    return null;
  }
}

function parseBlock(lines, start, indent) {
  const result = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) { i++; continue; }
    const lineIndent = line.search(/\S/);
    if (lineIndent < indent) break;
    if (lineIndent > indent) break; // shouldn't happen at top level

    const match = line.match(/^(\s*)([\w_-]+):\s*(.*)/);
    if (!match) return null; // malformed

    const key = match[2];
    const restVal = match[3].trim();

    if (restVal !== "") {
      // scalar value
      result[key] = parseScalar(restVal);
      i++;
    } else {
      // peek next non-empty line
      let nextIdx = i + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim() === "") nextIdx++;
      if (nextIdx >= lines.length) { result[key] = null; i = nextIdx; continue; }

      const nextIndent = lines[nextIdx].search(/\S/);
      if (nextIndent <= indent) { result[key] = null; i++; continue; }

      const nextTrimmed = lines[nextIdx].trimStart();
      if (nextTrimmed.startsWith("- ")) {
        // array
        const arr = parseArray(lines, nextIdx, nextIndent);
        result[key] = arr.value;
        i = arr.nextIndex;
      } else {
        // nested map
        const nested = parseBlock(lines, nextIdx, nextIndent);
        result[key] = nested.value;
        i = nested.nextIndex;
      }
    }
  }
  return { value: result, nextIndex: i };
}

function parseArray(lines, start, indent) {
  const arr = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) { i++; continue; }
    const lineIndent = line.search(/\S/);
    if (lineIndent < indent) break;
    if (lineIndent > indent) break; // continuation of object handled below

    const trimmed = line.trimStart();
    if (!trimmed.startsWith("- ")) break;

    const after = trimmed.slice(2).trim();
    // Check if it's key: value (object item)
    const kvMatch = after.match(/^([\w_-]+):\s*(.*)/);
    if (kvMatch) {
      // array of objects
      const obj = {};
      obj[kvMatch[1]] = parseScalar(kvMatch[2].trim());
      i++;
      // read continuation lines (deeper indent)
      while (i < lines.length) {
        const cl = lines[i];
        if (cl.trim() === "") { i++; continue; }
        const ci = cl.search(/\S/);
        if (ci <= indent) break;
        const ct = cl.trimStart();
        if (ct.startsWith("- ")) break; // next array item
        const ckv = ct.match(/^([\w_-]+):\s*(.*)/);
        if (ckv) {
          obj[ckv[1]] = parseScalar(ckv[2].trim());
          i++;
        } else {
          break;
        }
      }
      arr.push(obj);
    } else {
      // simple string array item
      arr.push(parseScalar(after));
      i++;
    }
  }
  return { value: arr, nextIndex: i };
}

function parseScalar(s) {
  if (s === "") return null;
  // strip quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  const n = Number(s);
  if (!isNaN(n) && s !== "") return n;
  return s;
}

// ---------------------------------------------------------------------------

export function loadConstitution(workspaceRoot) {
  const filePath = path.join(workspaceRoot, ".codex-harness", "constitution.yaml");
  let text;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const parsed = parseYaml(text);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  // Validate version
  if (parsed.version !== 1) {
    process.stderr.write(`[constitution] warning: unsupported version ${parsed.version}\n`);
  }

  // Validate mode
  if (!VALID_MODES.has(parsed.mode)) {
    process.stderr.write(`[constitution] warning: invalid mode "${parsed.mode}", defaulting to "off"\n`);
    parsed.mode = "off";
  }

  return parsed;
}

export function getRiskRules(workspaceRoot) {
  const c = loadConstitution(workspaceRoot);
  if (!c || !Array.isArray(c.risk_rules)) return [];

  return c.risk_rules.filter((rule) => {
    if (!rule.pattern) return false;
    try {
      new RegExp(rule.pattern);
      return true;
    } catch {
      process.stderr.write(`[constitution] warning: invalid regex "${rule.pattern}", skipping rule\n`);
      return false;
    }
  });
}

export function getPermissionProfile(workspaceRoot) {
  const defaults = { blockOn: [], requireApprovalOn: [], alwaysAllow: [], alwaysBlock: [] };
  const c = loadConstitution(workspaceRoot);
  if (!c || !c.permissions) return defaults;

  const p = c.permissions;
  return {
    blockOn: Array.isArray(p.block_on) ? p.block_on : defaults.blockOn,
    requireApprovalOn: Array.isArray(p.require_approval_on) ? p.require_approval_on : defaults.requireApprovalOn,
    alwaysAllow: Array.isArray(p.always_allow) ? p.always_allow : defaults.alwaysAllow,
    alwaysBlock: Array.isArray(p.always_block) ? p.always_block : defaults.alwaysBlock,
  };
}

export function getBudgetLimits(workspaceRoot) {
  const defaults = { max_tool_calls: 100, max_prompt_tokens: 50000, max_concurrent_jobs: 4 };
  const c = loadConstitution(workspaceRoot);
  if (!c || !c.budget) return { ...defaults };

  const b = c.budget;
  return {
    max_tool_calls: typeof b.max_tool_calls === "number" ? b.max_tool_calls : defaults.max_tool_calls,
    max_prompt_tokens: typeof b.max_prompt_tokens === "number" ? b.max_prompt_tokens : defaults.max_prompt_tokens,
    max_concurrent_jobs: typeof b.max_concurrent_jobs === "number" ? b.max_concurrent_jobs : defaults.max_concurrent_jobs,
  };
}
