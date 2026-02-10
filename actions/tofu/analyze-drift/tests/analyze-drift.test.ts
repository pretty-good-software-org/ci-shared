const { describe, it } = require("node:test");
const assert = require("node:assert");
const { analyzeDrift } = require("../analyze-drift.ts");
const { parseEnv } = require("../parse-env.ts");

const buildPlanJson = (resourceChanges: { actions: string[]; address: string }[]): string =>
  JSON.stringify({
    resource_changes: resourceChanges.map((rc) => ({
      address: rc.address,
      change: { actions: rc.actions },
    })),
  });

describe("analyzeDrift missing input", () => {
  it("returns incomplete summary when planJson is undefined", () => {
    const result = analyzeDrift({ planJson: undefined });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false for undefined input");
    assert.match(result.summary, /### Drift Detection Incomplete/, "must include incomplete heading");
    assert.match(result.summary, /not provided/, "must mention plan JSON was not provided");
  });

  it("returns incomplete summary when planJson is empty string", () => {
    const result = analyzeDrift({ planJson: "" });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false for empty input");
    assert.match(result.summary, /### Drift Detection Incomplete/, "must include incomplete heading");
  });

  it("returns incomplete summary when planJson is whitespace only", () => {
    const result = analyzeDrift({ planJson: "   " });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false for whitespace input");
    assert.match(result.summary, /### Drift Detection Incomplete/, "must include incomplete heading");
  });

  it("returns incomplete summary when planJson is invalid JSON", () => {
    const result = analyzeDrift({ planJson: "not json" });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false for invalid JSON");
    assert.match(result.summary, /### Drift Detection Incomplete/, "must include incomplete heading");
    assert.match(result.summary, /could not be parsed/, "must mention parse failure");
  });
});

describe("analyzeDrift no drift", () => {
  it("detects no drift when all resources are no-op", () => {
    const planJson = buildPlanJson([
      { actions: ["no-op"], address: "aws_s3_bucket.a" },
      { actions: ["no-op"], address: "aws_s3_bucket.b" },
    ]);
    const result = analyzeDrift({ planJson });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false when all resources are no-op");
    assert.match(result.summary, /### No Drift Detected/, "must include no-drift heading");
    assert.match(result.summary, /All resources match/, "must confirm all resources match");
  });

  it("detects no drift when resource_changes is empty", () => {
    const result = analyzeDrift({ planJson: JSON.stringify({ resource_changes: [] }) });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false for empty resource_changes");
    assert.match(result.summary, /### No Drift Detected/, "must include no-drift heading");
  });

  it("detects no drift when resource_changes key is missing", () => {
    const result = analyzeDrift({ planJson: JSON.stringify({}) });
    assert.strictEqual(result.hasDrift, false, "hasDrift must be false for missing resource_changes");
    assert.match(result.summary, /### No Drift Detected/, "must include no-drift heading");
  });
});

describe("analyzeDrift single action types", () => {
  it("detects drift for update", () => {
    const planJson = buildPlanJson([{ actions: ["update"], address: "aws_s3_bucket.main" }]);
    const result = analyzeDrift({ planJson });
    assert.strictEqual(result.hasDrift, true, "hasDrift must be true for update");
    assert.match(result.summary, /aws_s3_bucket\.main/, "must list the resource");
  });

  it("detects drift for delete-create (replace)", () => {
    const planJson = buildPlanJson([{ actions: ["delete", "create"], address: "aws_instance.web" }]);
    const result = analyzeDrift({ planJson });
    assert.strictEqual(result.hasDrift, true, "hasDrift must be true for replace");
    assert.match(result.summary, /aws_instance\.web/, "must list the resource");
  });

  it("detects drift for create", () => {
    const planJson = buildPlanJson([{ actions: ["create"], address: "aws_iam_role.new" }]);
    assert.strictEqual(analyzeDrift({ planJson }).hasDrift, true, "hasDrift must be true for create");
  });

  it("detects drift for delete", () => {
    const planJson = buildPlanJson([{ actions: ["delete"], address: "aws_iam_role.old" }]);
    assert.strictEqual(analyzeDrift({ planJson }).hasDrift, true, "hasDrift must be true for delete");
  });
});

describe("analyzeDrift filtering and ordering", () => {
  it("filters out no-op resources and only lists drifted ones", () => {
    const planJson = buildPlanJson([
      { actions: ["no-op"], address: "aws_s3_bucket.stable" },
      { actions: ["update"], address: "aws_s3_bucket.drifted" },
      { actions: ["no-op"], address: "aws_iam_role.stable" },
    ]);
    const result = analyzeDrift({ planJson });
    assert.strictEqual(result.hasDrift, true, "hasDrift must be true when any resource drifted");
    assert.match(result.summary, /aws_s3_bucket\.drifted/, "must list the drifted resource");
    assert.ok(!result.summary.includes("aws_s3_bucket.stable"), "must not list stable bucket");
    assert.ok(!result.summary.includes("aws_iam_role.stable"), "must not list stable role");
  });

  it("lists multiple drifted resources in input order", () => {
    const planJson = buildPlanJson([
      { actions: ["update"], address: "aws_s3_bucket.alpha" },
      { actions: ["no-op"], address: "aws_s3_bucket.beta" },
      { actions: ["delete", "create"], address: "aws_dynamodb_table.gamma" },
    ]);
    const result = analyzeDrift({ planJson });
    const alphaIdx = result.summary.indexOf("aws_s3_bucket.alpha");
    const gammaIdx = result.summary.indexOf("aws_dynamodb_table.gamma");
    assert.ok(alphaIdx < gammaIdx, "alpha must appear before gamma (input order preserved)");
    assert.ok(!result.summary.includes("aws_s3_bucket.beta"), "beta (no-op) must not appear");
  });
});

describe("parseEnv", () => {
  it("reads INPUT_PLAN_JSON from environment", () => {
    const args = parseEnv({ INPUT_PLAN_JSON: '{"resource_changes":[]}' });
    assert.strictEqual(args.planJson, '{"resource_changes":[]}', "must read plan JSON from env");
  });

  it("returns undefined when INPUT_PLAN_JSON is not set", () => {
    assert.strictEqual(parseEnv({}).planJson, undefined, "must return undefined when missing");
  });
});
