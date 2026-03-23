const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseEnv } = require("../parse-env.ts");

describe("parseEnv mapping", () => {
  it("maps INPUT_* env vars to PolicySummaryArgs", () => {
    const env = {
      INPUT_ACTOR: "octocat",
      INPUT_HAS_VIOLATIONS: "false",
    };
    const args = parseEnv(env);
    assert.strictEqual(args.hasViolations, false, "hasViolations should be false");
    assert.strictEqual(args.actor, "octocat", "actor mismatch");
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
  it("preserves undefined for missing actor", () => {
    const args = parseEnv({});
    assert.strictEqual(args.actor, undefined, "missing actor should be undefined");
  });
});
