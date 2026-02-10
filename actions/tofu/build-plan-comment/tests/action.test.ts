const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs } = require("../../../../lib/test-helpers.ts");
const buildPlanComment = require("../action.ts");

describe("main output passing", () => {
  it("sets comment-body output via resolveOutputWriter", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_ACTOR: "testuser",
      INPUT_FMT_OUTCOME: "success",
      INPUT_HAS_VIOLATIONS: "false",
      INPUT_INIT_OUTCOME: "success",
      INPUT_PLAN: "No changes.",
      INPUT_PLAN_OUTCOME: "success",
      INPUT_VALIDATE_OUTCOME: "success",
    };
    await buildPlanComment({ env, writeOutput });
    assert.ok(outputs["comment-body"], "comment-body output should be set");
    assert.ok(outputs["comment-body"].startsWith("### OpenTofu Plan Results"), "output should start with heading");
    assert.match(outputs["comment-body"], /@testuser/, "output should contain actor");
    assert.match(outputs["comment-body"], /No changes\./, "output should contain plan text");
  });
});

describe("main output violations", () => {
  it("sets comment-body with FAILED when HAS_VIOLATIONS=true", async () => {
    const { outputs, writeOutput } = captureOutputs();
    const env = {
      INPUT_ACTOR: "deployer",
      INPUT_FMT_OUTCOME: "success",
      INPUT_HAS_VIOLATIONS: "true",
      INPUT_INIT_OUTCOME: "success",
      INPUT_PLAN: "resource change",
      INPUT_PLAN_OUTCOME: "success",
      INPUT_VALIDATE_OUTCOME: "success",
    };
    await buildPlanComment({ env, writeOutput });
    assert.match(outputs["comment-body"], /FAILED/, "should show FAILED when violations exist");
    assert.match(outputs["comment-body"], /Policy Violations/, "should show policy violation message");
  });
});
