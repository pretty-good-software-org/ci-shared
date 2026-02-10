const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");
const cleanupS3 = require("../cleanup-s3.ts");
const { deleteAllVersions, listBuckets, run } = cleanupS3;

const BATCH_CMD_COUNT = 2;
const PAGINATED_CMD_COUNT = 4;
const ORCHESTRATION_CMD_COUNT = 3;
const TOTAL_OBJECTS = 3;
const BUCKETS = JSON.stringify({ Buckets: [{ Name: "test-bucket-alpha" }, { Name: "test-bucket-beta" }, { Name: "prod-bucket-gamma" }] });
const EMPTY = JSON.stringify({});
const VERSIONS = JSON.stringify({
  DeleteMarkers: [{ Key: "file3.txt", VersionId: "dm1" }],
  Versions: [{ Key: "file1.txt", VersionId: "v1" }, { Key: "file2.txt", VersionId: "v2" }],
});
const PAGE1 = JSON.stringify({ IsTruncated: true, NextKeyMarker: "file2.txt", NextVersionIdMarker: "v2",
  Versions: [{ Key: "file1.txt", VersionId: "v1" }, { Key: "file2.txt", VersionId: "v2" }] });
const PAGE2 = JSON.stringify({ Versions: [{ Key: "file3.txt", VersionId: "v3" }] });
const bucketsExec = (_b: string, _a: string[]) => BUCKETS;
const emptyBucketsExec = (_b: string, _a: string[]) => JSON.stringify({ Buckets: [] });
const emptyExec = (_b: string, _a: string[]) => EMPTY;
const throwExec = (_b: string, _a: string[]) => { throw new Error("command failed"); };
const throwVersionsExec = (_b: string, _a: string[]) => { throw new Error("versions failed"); };
const paginatedExec = (_b: string, _a: string[]): string => {
  const cmd = [_b, ..._a].join(" ");
  if (!cmd.includes("list-object-versions")) { return ""; }
  if (cmd.includes("--key-marker")) { return PAGE2; }
  return PAGE1;
};

describe("listBuckets", () => {
  it("filters buckets by prefix", () => {
    assert.deepStrictEqual(listBuckets("test-bucket-", "us-east-1", bucketsExec), ["test-bucket-alpha", "test-bucket-beta"], "should return only matching buckets");
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

describe("deleteAllVersions batch delete", () => {
  it("batch-deletes all versions and delete markers", () => {
    const { commands, exec } = mockExec({ "list-object-versions": VERSIONS }, "");
    deleteAllVersions("my-bucket", "us-east-1", exec);
    assert.strictEqual(commands.length, BATCH_CMD_COUNT, "should execute list + batch delete");
    assert.match(commands[0], /list-object-versions/, "first command lists versions");
    assert.match(commands[1], /delete-objects/, "second command batch deletes");
    const payload = JSON.parse(commands[1].split("--delete ")[1]);
    assert.strictEqual(payload.Objects.length, TOTAL_OBJECTS, "should include all 3 objects");
    assert.strictEqual(payload.Quiet, true, "should use Quiet mode");
    assert.deepStrictEqual(payload.Objects[0], { Key: "file1.txt", VersionId: "v1" }, "first version correct");
  });
  it("skips delete when no versions exist", () => {
    const { commands, exec } = mockExec({ "list-object-versions": EMPTY }, "");
    deleteAllVersions("my-bucket", "us-east-1", exec);
    assert.strictEqual(commands.length, 1, "should only list versions");
  });
});

describe("deleteAllVersions pagination", () => {
  it("paginates using key and version-id markers", () => {
    const commands: string[] = [];
    const exec = (bin: string, args: string[]): string => { commands.push([bin, ...args].join(" ")); return paginatedExec(bin, args); };
    deleteAllVersions("my-bucket", "us-east-1", exec);
    assert.strictEqual(commands.length, PAGINATED_CMD_COUNT, "2 list pages + 2 batch deletes");
    assert.match(commands[0], /list-object-versions/, "first list call");
    assert.match(commands[1], /delete-objects/, "first batch delete");
    assert.match(commands[BATCH_CMD_COUNT], /--key-marker file2\.txt/, "second list uses key marker");
    assert.match(commands[BATCH_CMD_COUNT], /--version-id-marker v2/, "second list uses version-id marker");
  });
});

describe("run orchestration", () => {
  it("lists buckets, deletes versions, then removes bucket", () => {
    const responses = { "list-buckets": JSON.stringify({ Buckets: [{ Name: "test-one" }] }), "list-object-versions": EMPTY };
    const { commands, exec } = mockExec(responses, "");
    const result = run({ prefix: "test-", region: "us-east-1" }, exec);
    assert.deepStrictEqual(result, ["test-one"], "should return deleted bucket names");
    assert.strictEqual(commands.length, ORCHESTRATION_CMD_COUNT, "list-buckets + list-versions + rb");
    assert.match(commands[0], /list-buckets/, "first lists buckets");
    assert.match(commands[1], /list-object-versions.*--bucket test-one/, "then lists versions");
    assert.match(commands[BATCH_CMD_COUNT], /s3 rb s3:\/\/test-one/, "then removes bucket");
  });
  it("returns empty when no buckets match", () => {
    assert.deepStrictEqual(run({ prefix: "x-", region: "us-east-1" }, emptyBucketsExec), [], "should return empty");
  });
});

describe("main and error handling", () => {
  it("throws on missing/empty/whitespace prefix", () => {
    assert.throws(() => cleanupS3({ env: { INPUT_PREFIX: "" } }), { message: "INPUT_PREFIX is required" });
    assert.throws(() => cleanupS3({ env: {} }), { message: "INPUT_PREFIX is required" });
    assert.throws(() => cleanupS3({ env: { INPUT_PREFIX: "   " } }), { message: "INPUT_PREFIX is required" });
  });
  it("throws on invalid region", () => {
    assert.throws(() => cleanupS3({ env: { INPUT_PREFIX: "t-", INPUT_REGION: "invalid" } }), { message: /Invalid AWS region/ });
  });
  it("accepts valid region and defaults to us-east-1", () => {
    const m1 = mockExec({}, JSON.stringify({ Buckets: [] }));
    cleanupS3({ env: { INPUT_PREFIX: "t-", INPUT_REGION: "eu-west-1" }, exec: m1.exec });
    assert.match(m1.commands[0], /--region eu-west-1/, "should use provided region");
    const m2 = mockExec({}, JSON.stringify({ Buckets: [] }));
    cleanupS3({ env: { INPUT_PREFIX: "t-" }, exec: m2.exec });
    assert.match(m2.commands[0], /--region us-east-1/, "should default to us-east-1");
  });
  it("propagates exec failures", () => {
    assert.throws(() => run({ prefix: "t-", region: "us-east-1" }, throwExec), { message: "command failed" });
    assert.throws(() => deleteAllVersions("b", "us-east-1", throwVersionsExec), { message: "versions failed" });
  });
});
