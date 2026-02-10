const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildPlanDetails } = require("../build-plan-details.ts");

const defaults = {
  plan: "No changes." as string | undefined,
};

describe("buildPlanDetails nesting", () => {
  it("places plan inside terraform code block inside details tag", () => {
    const body = buildPlanDetails({ plan: "resource changes" });
    const detailsOpen = body.indexOf("<details><summary>Show Plan</summary>");
    const codeOpen = body.indexOf("```terraform");
    const planText = body.indexOf("resource changes");
    const codeClose = body.indexOf("```\n", codeOpen + 1);
    const detailsClose = body.indexOf("</details>");
    assert.ok(detailsOpen < codeOpen, "details must open before code block");
    assert.ok(codeOpen < planText, "code block must open before plan");
    assert.ok(planText < codeClose, "plan must appear before code block close");
    assert.ok(codeClose < detailsClose, "code block must close before details close");
  });
  it("wraps plan in details > code fence > text order", () => {
    const body = buildPlanDetails(defaults);
    const lines = body.split("\n");
    assert.strictEqual(lines[0], "<details><summary>Show Plan</summary>", "first line must be details open");
    assert.strictEqual(lines[1], "", "second line must be blank");
    assert.strictEqual(lines[2], "```terraform", "third line must be code fence open");
    assert.strictEqual(lines[3], "No changes.", "fourth line must be plan text");
    assert.strictEqual(lines[4], "```", "fifth line must be code fence close");
    assert.strictEqual(lines[5], "", "sixth line must be blank");
    assert.strictEqual(lines[6], "</details>", "seventh line must be details close");
  });
});

describe("buildPlanDetails backtick escaping", () => {
  it("escapes triple backticks in plan text to prevent code fence breakout", () => {
    const body = buildPlanDetails({ plan: "resource ``` injected" });
    assert.ok(!body.includes("resource ```"), "raw triple backticks must not appear in output");
    assert.match(body, /resource ` ` ` injected/, "backticks should be escaped with spaces");
  });
  it("escapes multiple occurrences of triple backticks", () => {
    const body = buildPlanDetails({ plan: "a ``` b ``` c" });
    assert.ok(!body.includes("a ```"), "first raw triple backticks must not appear");
    assert.match(body, /a ` ` ` b ` ` ` c/, "all occurrences should be escaped");
  });
});

describe("buildPlanDetails edge cases", () => {
  it("handles empty plan string", () => {
    const body = buildPlanDetails({ plan: "" });
    assert.match(body, /```terraform\n\n```/, "empty plan should produce empty code block");
  });
  it("handles undefined plan as empty", () => {
    const body = buildPlanDetails({ plan: undefined });
    assert.match(body, /```terraform\n\n```/, "undefined plan should produce empty code block");
  });
});
