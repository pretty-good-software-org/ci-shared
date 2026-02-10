const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildPlanDetails } = require("../build-plan-details.ts");

describe("buildPlanDetails snapshot", () => {
  it("matches expected full output", () => {
    const expected = [
      "<details><summary>Show Plan</summary>",
      "",
      "```terraform",
      "No changes.",
      "```",
      "",
      "</details>",
    ].join("\n");
    assert.strictEqual(buildPlanDetails({ plan: "No changes." }), expected);
  });
});
