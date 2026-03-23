const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");
const cleanupS3 = require("../action.ts");
const { run } = cleanupS3;

const BATCH_CMD_COUNT = 2;
const ORCHESTRATION_CMD_COUNT = 3;
const EMPTY = JSON.stringify({});
const emptyBucketsExec = (_bin: string, _args: string[]) => JSON.stringify({ Buckets: [] });
const throwExec = (_bin: string, _args: string[]) => {
  throw new Error("command failed");
};

describe("run orchestration", () => {
  it("lists buckets, deletes versions, then removes bucket", () => {
    const responses = {
      "list-buckets": JSON.stringify({ Buckets: [{ Name: "test-one" }] }),
      "list-object-versions": EMPTY,
    };
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

describe("main validation", () => {
  it("throws when prefix is empty", () => {
    assert.throws(() => cleanupS3({ env: { INPUT_PREFIX: "" } }), { message: "INPUT_PREFIX is required" });
  });
  it("throws when prefix is not set", () => {
    assert.throws(() => cleanupS3({ env: {} }), { message: "INPUT_PREFIX is required" });
  });
  it("throws when prefix is whitespace-only", () => {
    assert.throws(() => cleanupS3({ env: { INPUT_PREFIX: "   " } }), { message: "INPUT_PREFIX is required" });
  });
  it("throws when prefix is shorter than 5 characters", () => {
    assert.throws(
      () => cleanupS3({ env: { INPUT_PREFIX: "ab-" } }),
      { message: /at least 5 characters/ },
      "should reject short prefix",
    );
  });
  it("throws on invalid region", () => {
    assert.throws(() => cleanupS3({ env: { INPUT_PREFIX: "test-", INPUT_REGION: "invalid" } }), {
      message: /Invalid AWS region/,
    });
  });
});

describe("run partial failure", () => {
  it("continues deleting after a failure and reports all failures", () => {
    let callCount = 0;
    const exec = (bin: string, args: string[]): string => {
      const cmd = [bin, ...args].join(" ");
      if (cmd.includes("list-buckets")) {
        return JSON.stringify({ Buckets: [{ Name: "test-a" }, { Name: "test-b" }] });
      }
      if (cmd.includes("list-object-versions")) {
        return JSON.stringify({});
      }
      if (cmd.includes("s3 rb")) {
        callCount++;
        if (callCount === 1) {
          throw new Error("rb failed");
        }
      }
      return "";
    };
    assert.throws(
      () => run({ prefix: "test-", region: "us-east-1" }, exec),
      { message: /Failed to delete 1 bucket\(s\): test-a/ },
      "should report the failed bucket",
    );
  });
});

describe("main env and defaults", () => {
  it("accepts valid region and defaults to us-east-1", () => {
    const m1 = mockExec({}, JSON.stringify({ Buckets: [] }));
    cleanupS3({ env: { INPUT_PREFIX: "test-", INPUT_REGION: "eu-west-1" }, exec: m1.exec });
    assert.match(m1.commands[0], /--region eu-west-1/, "should use provided region");
    const m2 = mockExec({}, JSON.stringify({ Buckets: [] }));
    cleanupS3({ env: { INPUT_PREFIX: "test-" }, exec: m2.exec });
    assert.match(m2.commands[0], /--region us-east-1/, "should default to us-east-1");
  });
});

describe("run error propagation", () => {
  it("propagates exec failures", () => {
    assert.throws(() => run({ prefix: "t-", region: "us-east-1" }, throwExec), { message: "command failed" });
  });
});
