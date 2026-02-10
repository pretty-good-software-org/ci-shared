const { describe, it } = require("node:test");
const assert = require("node:assert");
const { BOT_COMMENT_IDENTIFIER, buildComment } = require("../post-plan-comment");

const defaults = {
  actor: "testuser",
  fmtOutcome: "success",
  hasViolations: false,
  initOutcome: "success",
  plan: "No changes.",
  planOutcome: "success",
  validateOutcome: "success",
};

describe("buildComment structure", () => {
  it("starts with bot comment identifier", () => {
    const body = buildComment(defaults);
    assert.ok(body.startsWith(BOT_COMMENT_IDENTIFIER));
  });

  it("includes all step outcomes", () => {
    const body = buildComment(defaults);
    assert.ok(body.includes("Format Check: `success`"));
    assert.ok(body.includes("Init: `success`"));
    assert.ok(body.includes("Validate: `success`"));
    assert.ok(body.includes("Plan: `success`"));
  });

  it("includes plan output in terraform code block", () => {
    const body = buildComment({ ...defaults, plan: 'resource "aws_s3_bucket" "b" {}' });
    assert.ok(body.includes("```terraform"));
    assert.ok(body.includes('resource "aws_s3_bucket" "b" {}'));
  });

  it("wraps plan in collapsible details", () => {
    const body = buildComment(defaults);
    assert.ok(body.includes("<details><summary>Show Plan</summary>"));
    assert.ok(body.includes("</details>"));
  });

  it("includes actor", () => {
    const body = buildComment({ ...defaults, actor: "octocat" });
    assert.ok(body.includes("@octocat"));
  });
});

describe("buildComment policy and edge cases", () => {
  it("shows PASSED when no violations", () => {
    const body = buildComment({ ...defaults, hasViolations: false });
    assert.ok(body.includes("`PASSED`"));
    assert.ok(body.includes("All policies passed"));
    assert.ok(!body.includes("`FAILED`"));
  });

  it("shows FAILED when violations exist", () => {
    const body = buildComment({ ...defaults, hasViolations: true });
    assert.ok(body.includes("`FAILED`"));
    assert.ok(body.includes("Policy Violations"));
    assert.ok(!body.includes("All policies passed"));
  });

  it("handles empty plan", () => {
    const body = buildComment({ ...defaults, plan: "" });
    assert.ok(body.includes("```terraform\n\n```"));
  });

  it("handles failure outcomes", () => {
    const body = buildComment({ ...defaults, fmtOutcome: "failure", initOutcome: "failure" });
    assert.ok(body.includes("Format Check: `failure`"));
    assert.ok(body.includes("Init: `failure`"));
  });
});
