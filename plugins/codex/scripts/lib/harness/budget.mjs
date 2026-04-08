import fs from "node:fs";
import path from "node:path";
import { getBudgetConfig } from "./constitution.mjs";

const BUDGET_FILE = "harness-budget.json";

function budgetPath(stateDir) {
  return path.join(stateDir, BUDGET_FILE);
}

function readBudget(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(budgetPath(stateDir), "utf8"));
  } catch {
    return { usedTokens: 0, calls: 0 };
  }
}

function writeBudget(stateDir, data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(budgetPath(stateDir), JSON.stringify(data));
  } catch { /* fire-and-forget */ }
}

/**
 * Check if budget allows another Codex call.
 * @param {string} stateDir
 * @returns {{ status: 'ok'|'warning'|'blocked', used: number, limit: number }}
 */
export function checkBudget(stateDir) {
  const config = getBudgetConfig();
  const budget = readBudget(stateDir);
  const limit = config.limitTokens;
  const used = budget.usedTokens;

  if (limit === 0) return { status: "ok", used, limit: 0 };
  if (used >= limit) return { status: "blocked", used, limit };
  if (used >= limit * config.warningThreshold) return { status: "warning", used, limit };
  return { status: "ok", used, limit };
}

/**
 * Record token usage from a Codex interaction.
 * @param {string} stateDir
 * @param {number} promptChars
 * @param {number} outputChars
 */
export function recordUsage(stateDir, promptChars, outputChars) {
  const config = getBudgetConfig();
  const budget = readBudget(stateDir);
  const tokens = Math.ceil((promptChars + outputChars) / config.charsPerToken);
  budget.usedTokens += tokens;
  budget.calls += 1;
  writeBudget(stateDir, budget);
}
