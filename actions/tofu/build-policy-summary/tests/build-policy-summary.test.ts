const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildPolicySummary, fallback } = require("../build-policy-summary.ts");

const defaults = {
  hasViolations: false,
  actor: "testuser" as string | undefined,
};

describe("buildPolicySummary policy status", () => {
  it("shows PASSED with all-clear message by default", () => {
    const body = buildPolicySummary(defaults);
    assert.match(body, /Conftest Policy Check: `PASSED`/);
    assert.match(body, /All policies passed/);
    assert.ok(!body.includes("FAILED"), "must not mention FAILED");
  });
  it("shows FAILED with violation details when violations exist", () => {
    const body = buildPolicySummary({ ...defaults, hasViolations: true });
    assert.match(body, /Conftest Policy Check: `FAILED`/);
    assert.match(body, /Policy Violations/);
    assert.ok(!body.includes("PASSED"), "must not mention PASSED");
    assert.ok(!body.includes("All policies passed"), "must not show all-clear");
  });
});

describe("buildPolicySummary actor rendering", () => {
  it("renders actor with @ mention at the end", () => {
    assert.match(buildPolicySummary({ ...defaults, actor: "octocat" }), /\*Pushed by: @octocat\*$/);
  });
  it("handles undefined actor with fallback", () => {
    assert.match(buildPolicySummary({ ...defaults, actor: undefined }), /\*Pushed by: @unknown\*/);
  });
});

describe("buildPolicySummary section order", () => {
  it("renders policy status before actor line", () => {
    const body = buildPolicySummary(defaults);
    const policyLine = body.indexOf("#### Conftest Policy Check:");
    const actorLine = body.indexOf("*Pushed by:");
    assert.ok(policyLine < actorLine, "policy status must come before actor");
  });
});

describe("fallback", () => {
  it("returns the value when defined", () => {
    assert.strictEqual(fallback("hello"), "hello");
  });
  it("returns 'unknown' for undefined", () => {
    assert.strictEqual(fallback(undefined), "unknown");
  });
  it("returns 'unknown' for empty string", () => {
    assert.strictEqual(fallback(""), "unknown");
  });
});
