const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs } = require("../../../../lib/test-helpers.ts");
const buildPolicySummary = require("../action.ts");

describe("main output passing", () => {
  it("sets policy-summary output via resolveOutputWriter", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_ACTOR: "testuser",
      INPUT_HAS_VIOLATIONS: "false",
    };
    await buildPolicySummary({ env, writeOutput });
    assert.ok(outputs["policy-summary"], "policy-summary output should be set");
    assert.match(outputs["policy-summary"], /PASSED/, "output should contain PASSED");
    assert.match(outputs["policy-summary"], /@testuser/, "output should contain actor");
  });
});

describe("main output violations", () => {
  it("sets policy-summary with FAILED when HAS_VIOLATIONS=true", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_ACTOR: "deployer",
      INPUT_HAS_VIOLATIONS: "true",
    };
    await buildPolicySummary({ env, writeOutput });
    assert.match(outputs["policy-summary"], /FAILED/, "should show FAILED when violations exist");
    assert.match(outputs["policy-summary"], /Policy Violations/, "should show policy violation message");
  });
});
