const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs } = require("../../../../lib/test-helpers.ts");
const buildStepSummary = require("../action.ts");

describe("main output passing", () => {
  it("sets step-summary output via resolveOutputWriter", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_FMT_OUTCOME: "success",
      INPUT_INIT_OUTCOME: "success",
      INPUT_PLAN_OUTCOME: "success",
      INPUT_VALIDATE_OUTCOME: "success",
    };
    await buildStepSummary({ env, writeOutput });
    assert.ok(outputs["step-summary"], "step-summary output should be set");
    assert.ok(outputs["step-summary"].startsWith("### OpenTofu Plan Results"), "output should start with heading");
  });
});

describe("main output with mixed outcomes", () => {
  it("renders all four outcomes correctly", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_FMT_OUTCOME: "success",
      INPUT_INIT_OUTCOME: "failure",
      INPUT_PLAN_OUTCOME: "skipped",
      INPUT_VALIDATE_OUTCOME: "cancelled",
    };
    await buildStepSummary({ env, writeOutput });
    assert.match(outputs["step-summary"], /Format Check: `success`/, "should contain fmt outcome");
    assert.match(outputs["step-summary"], /Init: `failure`/, "should contain init outcome");
    assert.match(outputs["step-summary"], /Validate: `cancelled`/, "should contain validate outcome");
    assert.match(outputs["step-summary"], /Plan: `skipped`/, "should contain plan outcome");
  });
});
