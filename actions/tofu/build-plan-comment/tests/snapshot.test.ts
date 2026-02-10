const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildComment, fallback } = require("../build-comment.ts");

const defaults = {
  actor: "testuser" as string | undefined,
  fmtOutcome: "success" as string | undefined,
  hasViolations: false,
  initOutcome: "success" as string | undefined,
  plan: "No changes." as string | undefined,
  planOutcome: "success" as string | undefined,
  validateOutcome: "success" as string | undefined,
};

describe("buildComment snapshot", () => {
  it("matches expected full output", () => {
    const expected = [
      "### OpenTofu Plan Results",
      "#### Format Check: `success`",
      "#### Init: `success`",
      "#### Validate: `success`",
      "#### Plan: `success`",
      "<details><summary>Show Plan</summary>",
      "",
      "```terraform",
      "No changes.",
      "```",
      "",
      "</details>",
      "#### Conftest Policy Check: `PASSED`",
      "All policies passed",
      "*Pushed by: @testuser*",
    ].join("\n");
    assert.strictEqual(buildComment(defaults), expected);
  });
});

describe("fallback", () => {
  it("returns the value when defined", () => {
    assert.strictEqual(fallback("hello"), "hello");
  });
  it("returns 'unknown' for undefined", () => {
    assert.strictEqual(fallback(undefined), "unknown");
  });
  it("returns 'unknown' for empty string", () => {
    assert.strictEqual(fallback(""), "unknown");
  });
});
