const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseEnv } = require("../parse-env.ts");

describe("parseEnv mapping", () => {
  it("maps INPUT_* env vars to BuildCommentArgs", () => {
    const env = {
      INPUT_ACTOR: "octocat",
      INPUT_FMT_OUTCOME: "success",
      INPUT_HAS_VIOLATIONS: "false",
      INPUT_INIT_OUTCOME: "failure",
      INPUT_PLAN: "some plan",
      INPUT_PLAN_OUTCOME: "success",
      INPUT_VALIDATE_OUTCOME: "cancelled",
    };
    const args = parseEnv(env);
    assert.strictEqual(args.actor, "octocat", "actor mismatch");
    assert.strictEqual(args.fmtOutcome, "success", "fmtOutcome mismatch");
    assert.strictEqual(args.initOutcome, "failure", "initOutcome mismatch");
    assert.strictEqual(args.validateOutcome, "cancelled", "validateOutcome mismatch");
    assert.strictEqual(args.planOutcome, "success", "planOutcome mismatch");
    assert.strictEqual(args.plan, "some plan", "plan mismatch");
    assert.strictEqual(args.hasViolations, false, "hasViolations should be false");
  });
});

describe("parseEnv boolean conversion", () => {
  it("converts HAS_VIOLATIONS=true to boolean true", () => {
    const args = parseEnv({ INPUT_HAS_VIOLATIONS: "true" });
    assert.strictEqual(args.hasViolations, true, "hasViolations should be true");
  });
  it("converts HAS_VIOLATIONS=false to boolean false", () => {
    const args = parseEnv({ INPUT_HAS_VIOLATIONS: "false" });
    assert.strictEqual(args.hasViolations, false, "hasViolations should be false");
  });
  it("treats missing HAS_VIOLATIONS as false", () => {
    const args = parseEnv({});
    assert.strictEqual(args.hasViolations, false, "missing HAS_VIOLATIONS should be false");
  });
});

describe("parseEnv boolean case sensitivity", () => {
  it("treats uppercase TRUE as false (strict comparison)", () => {
    const args = parseEnv({ INPUT_HAS_VIOLATIONS: "TRUE" });
    assert.strictEqual(args.hasViolations, false, "uppercase TRUE should be false");
  });
  it("treats '1' as false (strict comparison)", () => {
    const args = parseEnv({ INPUT_HAS_VIOLATIONS: "1" });
    assert.strictEqual(args.hasViolations, false, "'1' should be false");
  });
});

describe("parseEnv defaults", () => {
  it("defaults missing plan to empty string", () => {
    const args = parseEnv({});
    assert.strictEqual(args.plan, "", "missing plan should default to empty string");
  });
  it("preserves undefined for optional string fields", () => {
    const args = parseEnv({});
    assert.strictEqual(args.actor, undefined, "missing actor should be undefined");
    assert.strictEqual(args.fmtOutcome, undefined, "missing fmtOutcome should be undefined");
    assert.strictEqual(args.initOutcome, undefined, "missing initOutcome should be undefined");
    assert.strictEqual(args.validateOutcome, undefined, "missing validateOutcome should be undefined");
    assert.strictEqual(args.planOutcome, undefined, "missing planOutcome should be undefined");
  });
});
