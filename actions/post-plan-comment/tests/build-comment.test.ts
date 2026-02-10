const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildComment } = require("../post-plan-comment.ts");

const defaults = {
  actor: "testuser" as string | undefined,
  fmtOutcome: "success" as string | undefined,
  hasViolations: false,
  initOutcome: "success" as string | undefined,
  plan: "No changes." as string | undefined,
  planOutcome: "success" as string | undefined,
  validateOutcome: "success" as string | undefined,
};

describe("buildComment heading and sections", () => {
  it("starts with the literal heading", () => {
    const body = buildComment(defaults);
    assert.match(body, /^### OpenTofu Plan Results\n/);
  });

  it("renders all four step outcome headings", () => {
    const body = buildComment({
      ...defaults,
      fmtOutcome: "success",
      initOutcome: "failure",
      planOutcome: "skipped",
      validateOutcome: "cancelled",
    });
    assert.match(body, /#### Format Check: `success`/);
    assert.match(body, /#### Init: `failure`/);
    assert.match(body, /#### Validate: `cancelled`/);
    assert.match(body, /#### Plan: `skipped`/);
  });

  it("renders actor with @ mention at the end", () => {
    const body = buildComment({ ...defaults, actor: "octocat" });
    assert.match(body, /\*Pushed by: @octocat\*$/);
  });
});

describe("buildComment plan nesting", () => {
  it("places plan inside terraform code block inside details tag", () => {
    const body = buildComment({ ...defaults, plan: "resource changes" });
    const detailsOpen = body.indexOf("<details><summary>Show Plan</summary>");
    const codeOpen = body.indexOf("```terraform");
    const planText = body.indexOf("resource changes");
    const codeClose = body.indexOf("```\n", codeOpen + 1);
    const detailsClose = body.indexOf("</details>");

    // Verify structural ordering: details > code fence > plan > close fence > close details
    assert.ok(detailsOpen < codeOpen, "details must open before code block");
    assert.ok(codeOpen < planText, "code block must open before plan");
    assert.ok(planText < codeClose, "plan must appear before code block close");
    assert.ok(codeClose < detailsClose, "code block must close before details close");
  });
});

describe("buildComment policy status", () => {
  it("shows PASSED with all-clear message by default", () => {
    const body = buildComment(defaults);
    assert.match(body, /Conftest Policy Check: `PASSED`/);
    assert.match(body, /All policies passed/);
    assert.ok(!body.includes("FAILED"), "must not mention FAILED");
  });

  it("shows FAILED with violation details when violations exist", () => {
    const body = buildComment({ ...defaults, hasViolations: true });
    assert.match(body, /Conftest Policy Check: `FAILED`/);
    assert.match(body, /Policy Violations/);
    assert.ok(!body.includes("PASSED"), "must not mention PASSED");
    assert.ok(!body.includes("All policies passed"), "must not show all-clear");
  });
});

describe("buildComment step outcomes", () => {
  const outcomes = ["success", "failure", "cancelled", "skipped"];

  for (const outcome of outcomes) {
    it(`renders fmtOutcome=${outcome}`, () => {
      const body = buildComment({ ...defaults, fmtOutcome: outcome });
      assert.match(body, new RegExp(`Format Check: \`${outcome}\``));
    });
  }
});

describe("buildComment edge cases", () => {
  it("handles empty plan string", () => {
    const body = buildComment({ ...defaults, plan: "" });
    assert.match(body, /```terraform\n\n```/);
  });

  it("handles undefined actor", () => {
    const body = buildComment({ ...defaults, actor: undefined });
    assert.match(body, /\*Pushed by: @undefined\*/);
  });

  it("handles undefined plan as empty", () => {
    const body = buildComment({ ...defaults, plan: undefined });
    // Array.join converts undefined to empty string
    assert.match(body, /```terraform\n\n```/);
  });
});

// Snapshot: full output for the default happy-path input
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
