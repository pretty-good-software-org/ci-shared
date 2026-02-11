const { describe, it } = require("node:test");
const assert = require("node:assert");
const { analyzeDrift } = require("../analyze-drift.ts");

const buildPlanJson = (resourceChanges: { actions: string[]; address: string }[]): string =>
  JSON.stringify({
    resource_changes: resourceChanges.map((rc) => ({
      address: rc.address,
      change: { actions: rc.actions },
    })),
  });

describe("analyzeDrift drift snapshot", () => {
  it("matches expected full output for drift detected", () => {
    const planJson = buildPlanJson([{ actions: ["update"], address: "aws_s3_bucket.main" }]);
    const expected = [
      "### Drift Detected",
      "",
      "The following resources have drifted from their expected state:",
      "",
      "```",
      "aws_s3_bucket.main",
      "```",
      "",
      "**Action Required**: Review and reconcile drift",
    ].join("\n");
    assert.strictEqual(analyzeDrift({ planJson }).summary, expected);
  });

  it("matches expected full output for no drift", () => {
    const planJson = buildPlanJson([{ actions: ["no-op"], address: "aws_s3_bucket.main" }]);
    const expected = ["### No Drift Detected", "", "All resources match their expected state."].join("\n");
    assert.strictEqual(analyzeDrift({ planJson }).summary, expected);
  });

  it("matches expected full output for incomplete (missing input)", () => {
    const expected = ["### Drift Detection Incomplete", "", "Plan JSON was not provided."].join("\n");
    assert.strictEqual(analyzeDrift({ planJson: undefined }).summary, expected);
  });

  it("matches expected full output for incomplete (invalid JSON)", () => {
    const expected = ["### Drift Detection Incomplete", "", "Plan JSON could not be parsed."].join("\n");
    assert.strictEqual(analyzeDrift({ planJson: "not json" }).summary, expected);
  });
});
