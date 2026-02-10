const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseEnv } = require("../parse-env.ts");

describe("parseEnv mapping", () => {
  it("maps INPUT_PLAN to plan field", () => {
    const args = parseEnv({ INPUT_PLAN: "some plan output" });
    assert.strictEqual(args.plan, "some plan output", "plan mismatch");
  });
});

describe("parseEnv defaults", () => {
  it("defaults missing plan to empty string", () => {
    const args = parseEnv({});
    assert.strictEqual(args.plan, "", "missing plan should default to empty string");
  });
});
