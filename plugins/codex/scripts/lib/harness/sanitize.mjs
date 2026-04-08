import { getSanitizePatterns } from "./constitution.mjs";

const BUILTIN_PATTERNS = [
  { name: "aws-key", regex: /AKIA[A-Z0-9]{16}/g },
  { name: "github-pat", regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "openai-key", regex: /sk-[a-zA-Z0-9]{48}/g },
  { name: "pem-block", regex: /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g },
  { name: "generic-secret", regex: /(?:password|passwd|secret)\s*[:=]\s*\S+/gi }
];

/**
 * Sanitize Codex output by redacting credentials.
 * @param {string} text
 * @returns {{ text: string, redactions: string[] }}
 */
export function sanitizeOutput(text) {
  if (!text) return { text: text ?? "", redactions: [] };

  const redactions = [];
  let result = text;

  const allPatterns = [...BUILTIN_PATTERNS, ...getSanitizePatterns()];
  for (const p of allPatterns) {
    const regex = new RegExp(p.regex.source, p.regex.flags);
    if (regex.test(result)) {
      redactions.push(p.name);
      result = result.replace(new RegExp(p.regex.source, p.regex.flags), `[REDACTED:${p.name}]`);
    }
  }

  return { text: result, redactions };
}
