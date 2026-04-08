import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONSTITUTION_PATH = path.resolve(__dirname, "../../../schemas/codex-constitution.yaml");

let _cached = null;

function parseSimpleYaml(text) {
  const result = {};
  let currentSection = null;
  let currentArray = null;
  let currentObj = null;

  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // Top-level key (no indent)
    const topMatch = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (topMatch) {
      if (currentObj && currentArray) { currentArray.push(currentObj); currentObj = null; }
      const [, key, val] = topMatch;
      if (val && val.trim()) {
        result[key] = parseScalar(val.trim());
      } else {
        result[key] = {};
        currentSection = result[key];
      }
      currentArray = null;
      continue;
    }

    // Sub-key (2-space indent) — always check, even if currentArray is set
    const subKeyMatch = line.match(/^  (\w[\w_]*):\s*(.*)$/);
    if (subKeyMatch && currentSection) {
      // Flush any pending object from previous array
      if (currentObj && currentArray) { currentArray.push(currentObj); currentObj = null; }
      const [, key, val] = subKeyMatch;
      if (val && val.trim()) {
        currentSection[key] = parseScalar(val.trim());
        currentArray = null;
      } else {
        currentSection[key] = [];
        currentArray = currentSection[key];
      }
      continue;
    }

    // Array item (4-space indent)
    const arrayItemMatch = line.match(/^    - (.+)$/);
    if (arrayItemMatch && currentArray) {
      const item = arrayItemMatch[1].trim();
      const kvMatch = item.match(/^(\w[\w_]*):\s*(.+)$/);
      if (kvMatch) {
        if (currentObj) currentArray.push(currentObj);
        currentObj = { [kvMatch[1]]: parseScalar(kvMatch[2].trim()) };
      } else {
        if (currentObj) { currentArray.push(currentObj); currentObj = null; }
        currentArray.push(parseScalar(item));
      }
      continue;
    }

    // Nested key-value within array object (6-space indent)
    const nestedKvMatch = line.match(/^      (\w[\w_]*):\s*(.+)$/);
    if (nestedKvMatch && currentObj) {
      currentObj[nestedKvMatch[1]] = parseScalar(nestedKvMatch[2].trim());
      continue;
    }
  }
  if (currentObj && currentArray) currentArray.push(currentObj);
  return result;
}

function parseScalar(val) {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  // Unescape YAML double-backslash to single backslash
  return val.replace(/^["']|["']$/g, "").replace(/\\\\/g, "\\");
}

export function loadConstitution() {
  if (_cached) return _cached;
  try {
    const raw = fs.readFileSync(CONSTITUTION_PATH, "utf8");
    _cached = parseSimpleYaml(raw);
    return _cached;
  } catch {
    return null;
  }
}

export function getRiskPatterns() {
  const c = loadConstitution();
  if (!c?.risk) return { destructive: [], elevated: [] };
  const compile = (arr) => (arr || []).map(p => {
    try { return { regex: new RegExp(p.pattern, "i"), reason: p.reason }; }
    catch { return null; }
  }).filter(Boolean);
  return {
    destructive: compile(c.risk.destructive_patterns),
    elevated: compile(c.risk.elevated_patterns)
  };
}

export function getBudgetConfig() {
  const c = loadConstitution();
  const b = c?.budget || {};
  return {
    limitTokens: b.default_limit_tokens ?? 2000000,
    warningThreshold: b.warning_threshold ?? 0.80,
    charsPerToken: b.chars_per_token_estimate ?? 4
  };
}

export function getSanitizePatterns() {
  const c = loadConstitution();
  return (c?.sanitize?.patterns || []).map(p => {
    try { return { name: p.name, regex: new RegExp(p.regex, "gi") }; }
    catch { return null; }
  }).filter(Boolean);
}
