import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeOutput } from "../../plugins/codex/scripts/lib/harness/sanitize.mjs";

describe("sanitizeOutput", () => {
  it("redacts AWS access key IDs", () => {
    const result = sanitizeOutput("AKIAIOSFODNN7EXAMPLE", {});
    assert.equal(result.modified, true);
    assert.ok(result.output.includes("[REDACTED:aws-key]"));
    assert.ok(result.redactions.includes("aws-key"));
  });

  it("redacts api_key assignments", () => {
    const result = sanitizeOutput("api_key=sk-abc123def456ghi789jkl", {});
    assert.equal(result.modified, true);
    assert.notEqual(result.output, "api_key=sk-abc123def456ghi789jkl");
  });

  it("redacts PEM private keys", () => {
    const pem =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----";
    const result = sanitizeOutput(pem, {});
    assert.equal(result.modified, true);
    assert.ok(!result.output.includes("BEGIN RSA PRIVATE KEY"));
  });

  it("passes through clean output unchanged", () => {
    const result = sanitizeOutput("Hello world", {});
    assert.equal(result.modified, false);
    assert.equal(result.output, "Hello world");
    assert.deepEqual(result.redactions, []);
  });

  it("redacts multiple secrets and reports all redaction types", () => {
    const input = "key=AKIAIOSFODNN7EXAMPLE and api_key=sk-abc123def456ghi789jkl";
    const result = sanitizeOutput(input, {});
    assert.equal(result.modified, true);
    assert.equal(result.redactions.length, 2);
  });

  it("supports custom patterns via options", () => {
    const result = sanitizeOutput(
      "https://internal.corp.example.com/api",
      {
        patterns: [
          {
            name: "internal-endpoint",
            pattern: "https://internal\\.corp\\.example\\.com",
            replacement: "[REDACTED:internal-endpoint]",
          },
        ],
      },
    );
    assert.equal(result.modified, true);
    assert.ok(result.output.includes("[REDACTED:internal-endpoint]"));
  });

  it("preserves surrounding context around redacted secrets", () => {
    const result = sanitizeOutput(
      "The key is AKIAIOSFODNN7EXAMPLE in production",
      {},
    );
    assert.equal(result.modified, true);
    assert.ok(result.output.startsWith("The key is "));
    assert.ok(result.output.endsWith(" in production"));
    assert.ok(result.output.includes("[REDACTED:aws-key]"));
  });
});
