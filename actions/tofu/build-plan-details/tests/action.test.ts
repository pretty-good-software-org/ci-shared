const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs } = require("../../../../lib/test-helpers.ts");
const buildPlanDetails = require("../action.ts");

describe("main output passing", () => {
  it("sets plan-details output via resolveOutputWriter", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_PLAN: "No changes.",
    };
    await buildPlanDetails({ env, writeOutput });
    assert.ok(outputs["plan-details"], "plan-details output should be set");
    assert.match(outputs["plan-details"], /<details>/, "output should contain details tag");
    assert.match(outputs["plan-details"], /No changes\./, "output should contain plan text");
  });
});

describe("main output with empty plan", () => {
  it("sets plan-details with empty code block", async () => {
    const { outputs, writeOutput } = captureOutputs();
    await buildPlanDetails({ env: {}, writeOutput });
    assert.ok(outputs["plan-details"], "plan-details output should be set");
    assert.match(outputs["plan-details"], /```terraform\n\n```/, "should produce empty code block");
  });
});
