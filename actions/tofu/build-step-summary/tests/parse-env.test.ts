const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseEnv } = require("../parse-env.ts");

describe("parseEnv mapping", () => {
  it("maps INPUT_* env vars to StepSummaryArgs", () => {
    const env = {
      INPUT_FMT_OUTCOME: "success",
      INPUT_INIT_OUTCOME: "failure",
      INPUT_VALIDATE_OUTCOME: "cancelled",
      INPUT_PLAN_OUTCOME: "skipped",
    };
    const args = parseEnv(env);
    assert.strictEqual(args.fmtOutcome, "success", "fmtOutcome mismatch");
    assert.strictEqual(args.initOutcome, "failure", "initOutcome mismatch");
    assert.strictEqual(args.validateOutcome, "cancelled", "validateOutcome mismatch");
    assert.strictEqual(args.planOutcome, "skipped", "planOutcome mismatch");
  });
});

describe("parseEnv defaults", () => {
  it("preserves undefined for missing fields", () => {
    const args = parseEnv({});
    assert.strictEqual(args.fmtOutcome, undefined, "missing fmtOutcome should be undefined");
    assert.strictEqual(args.initOutcome, undefined, "missing initOutcome should be undefined");
    assert.strictEqual(args.validateOutcome, undefined, "missing validateOutcome should be undefined");
    assert.strictEqual(args.planOutcome, undefined, "missing planOutcome should be undefined");
  });
});
