const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildStepSummary } = require("../build-step-summary.ts");

const defaults = {
  fmtOutcome: "success" as string | undefined,
  initOutcome: "success" as string | undefined,
  planOutcome: "success" as string | undefined,
  validateOutcome: "success" as string | undefined,
};

describe("buildStepSummary snapshot", () => {
  it("matches expected full output", () => {
    const expected = [
      "### OpenTofu Plan Results",
      "#### Format Check: `success`",
      "#### Init: `success`",
      "#### Validate: `success`",
      "#### Plan: `success`",
    ].join("\n");
    assert.strictEqual(buildStepSummary(defaults), expected);
  });
});
