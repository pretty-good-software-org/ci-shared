const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");
const { listBuckets } = require("../list-buckets.ts");

const BUCKETS = JSON.stringify({
  Buckets: [{ Name: "test-bucket-alpha" }, { Name: "test-bucket-beta" }, { Name: "prod-bucket-gamma" }],
});
const bucketsExec = (_b: string, _a: string[]) => BUCKETS;
const emptyBucketsExec = (_b: string, _a: string[]) => JSON.stringify({ Buckets: [] });
const emptyExec = (_b: string, _a: string[]) => JSON.stringify({});

describe("listBuckets", () => {
  it("filters buckets by prefix", () => {
    assert.deepStrictEqual(
      listBuckets("test-bucket-", "us-east-1", bucketsExec),
      ["test-bucket-alpha", "test-bucket-beta"],
      "should return only matching buckets",
    );
  });
  it("returns empty when no match", () => {
    assert.deepStrictEqual(listBuckets("staging-", "us-east-1", bucketsExec), [], "no buckets should match");
  });
  it("handles empty or undefined Buckets", () => {
    assert.deepStrictEqual(listBuckets("test-", "us-east-1", emptyBucketsExec), [], "empty array case");
    assert.deepStrictEqual(listBuckets("test-", "us-east-1", emptyExec), [], "undefined case");
  });
  it("passes correct region", () => {
    const { commands, exec } = mockExec({}, JSON.stringify({ Buckets: [] }));
    listBuckets("test-", "eu-west-1", exec);
    assert.match(commands[0], /--region eu-west-1/, "should include correct region");
  });
});
