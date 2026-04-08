import fs from "node:fs";
import path from "node:path";

function budgetPath(workspaceRoot, sessionId) {
  return path.join(workspaceRoot, `budget-${sessionId}.json`);
}

export function initBudget(workspaceRoot, sessionId, limits) {
  const state = { totalPromptTokens: 0, totalCalls: 0, limits };
  fs.writeFileSync(budgetPath(workspaceRoot, sessionId), JSON.stringify(state), "utf8");
}

export function recordToolCall(workspaceRoot, sessionId, toolName) {
  const fp = budgetPath(workspaceRoot, sessionId);
  const state = JSON.parse(fs.readFileSync(fp, "utf8"));
  state.totalCalls += 1;
  state.totalPromptTokens += Math.ceil(toolName.length / 4);
  fs.writeFileSync(fp, JSON.stringify(state), "utf8");
}

export function checkPromptBudget(workspaceRoot, sessionId, estimatedTokens) {
  const fp = budgetPath(workspaceRoot, sessionId);
  const state = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (state.limits.max_prompt_tokens === 0) {
    return { allowed: true };
  }
  const allowed = (state.totalPromptTokens + estimatedTokens) <= state.limits.max_prompt_tokens;
  return { allowed };
}

export function getBudgetUsage(workspaceRoot, sessionId) {
  try {
    const fp = budgetPath(workspaceRoot, sessionId);
    const state = JSON.parse(fs.readFileSync(fp, "utf8"));
    return state;
  } catch {
    return { totalPromptTokens: 0, totalCalls: 0, limits: {} };
  }
}
