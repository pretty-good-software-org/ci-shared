const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { parseEnv } = require("../parse-env.ts");

const withPlanFile = (contents: string, run: (path: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "analyze-drift-"));
  const path = join(dir, "plan.json");
  writeFileSync(path, contents);
  try {
    run(path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

describe("parseEnv from file", () => {
  it("reads plan JSON from the INPUT_PLAN_JSON_FILE path", () => {
    withPlanFile('{"resource_changes":[]}', (path) => {
      const args = parseEnv({ INPUT_PLAN_JSON_FILE: path });
      assert.strictEqual(args.planJson, '{"resource_changes":[]}', "must read plan JSON from the file");
    });
  });

  it("prefers the file over the inline INPUT_PLAN_JSON when both are set", () => {
    withPlanFile('{"from":"file"}', (path) => {
      const args = parseEnv({ INPUT_PLAN_JSON: '{"from":"env"}', INPUT_PLAN_JSON_FILE: path });
      assert.strictEqual(args.planJson, '{"from":"file"}', "file path must take precedence over inline env");
    });
  });

  it("returns undefined when the plan file is missing (no artifact)", () => {
    const args = parseEnv({ INPUT_PLAN_JSON_FILE: join(tmpdir(), "analyze-drift-absent.json") });
    assert.strictEqual(args.planJson, undefined, "missing plan file must be treated as not-provided");
  });
});

describe("parseEnv inline fallback", () => {
  it("ignores a blank INPUT_PLAN_JSON_FILE and uses the inline JSON", () => {
    const args = parseEnv({ INPUT_PLAN_JSON: '{"from":"env"}', INPUT_PLAN_JSON_FILE: "   " });
    assert.strictEqual(args.planJson, '{"from":"env"}', "blank path must fall through to the inline env var");
  });

  it("reads INPUT_PLAN_JSON from environment when no file path is given", () => {
    const args = parseEnv({ INPUT_PLAN_JSON: '{"resource_changes":[]}' });
    assert.strictEqual(args.planJson, '{"resource_changes":[]}', "must read plan JSON from env");
  });

  it("returns undefined when neither file path nor inline JSON is set", () => {
    assert.strictEqual(parseEnv({}).planJson, undefined, "must return undefined when missing");
  });
});
