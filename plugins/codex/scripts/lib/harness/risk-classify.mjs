import { getRiskPatterns } from "./constitution.mjs";

/**
 * Classify risk level of a Codex task prompt.
 * @param {string} prompt
 * @param {{ write?: boolean }} options
 * @returns {{ level: 'safe'|'elevated'|'destructive', reasons: string[] }}
 */
export function classifyPromptRisk(prompt, options = {}) {
  if (!prompt) return { level: "safe", reasons: [] };

  const patterns = getRiskPatterns();
  const reasons = [];

  for (const p of patterns.destructive) {
    if (p.regex.test(prompt)) {
      reasons.push(`destructive: ${p.reason}`);
    }
  }
  if (reasons.length > 0) {
    return { level: "destructive", reasons };
  }

  for (const p of patterns.elevated) {
    if (p.regex.test(prompt)) {
      reasons.push(`elevated: ${p.reason}`);
    }
  }
  if (options.write) {
    reasons.push("elevated: write-mode enabled");
  }
  if (reasons.length > 0) {
    return { level: "elevated", reasons };
  }

  return { level: "safe", reasons: [] };
}
