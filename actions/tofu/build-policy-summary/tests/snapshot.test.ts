const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildPolicySummary } = require("../build-policy-summary.ts");

describe("buildPolicySummary snapshot", () => {
  it("matches expected full output for PASSED", () => {
    const expected = [
      "#### Conftest Policy Check: `PASSED`",
      "All policies passed",
      "*Pushed by: @testuser*",
    ].join("\n");
    assert.strictEqual(buildPolicySummary({ hasViolations: false, actor: "testuser" }), expected);
  });
  it("matches expected full output for FAILED", () => {
    const expected = [
      "#### Conftest Policy Check: `FAILED`",
      "**Policy Violations:** See Conftest step output for details",
      "*Pushed by: @deployer*",
    ].join("\n");
    assert.strictEqual(buildPolicySummary({ hasViolations: true, actor: "deployer" }), expected);
  });
});
