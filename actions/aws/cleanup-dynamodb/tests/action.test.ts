const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");

const cleanupDynamodb = require("../action.ts");
const { run } = cleanupDynamodb;

const EXPECTED_LIST_DELETE_COMMANDS = 3;
const SECOND_DELETE_CALL = 2;
const TOTAL_DELETE_ATTEMPTS = 3;
const emptyTablesExec = (_bin: string, _args: string[]): string => JSON.stringify({ TableNames: [] });
const throwExec = (_bin: string, _args: string[]): string => {
  throw new Error("command failed");
};

describe("run orchestration", () => {
  it("lists tables then deletes each matching table", () => {
    const { commands, exec } = mockExec({
      "list-tables": JSON.stringify({ TableNames: ["test-locks", "test-state"] }),
    });
    const result = run({ prefix: "test-", region: "us-east-1" }, exec);
    assert.deepStrictEqual(result, ["test-locks", "test-state"], "should return deleted table names");
    assert.strictEqual(
      commands.length,
      EXPECTED_LIST_DELETE_COMMANDS,
      "should execute 3 commands (1 list + 2 deletes)",
    );
    assert.match(commands[0], /list-tables/, "first command should list tables");
    assert.match(commands[1], /delete-table --table-name test-locks/, "should delete first table");
    assert.match(
      commands[EXPECTED_LIST_DELETE_COMMANDS - 1],
      /delete-table --table-name test-state/,
      "should delete second table",
    );
  });
  it("returns empty array when no tables match", () => {
    assert.deepStrictEqual(
      run({ prefix: "test-", region: "us-east-1" }, emptyTablesExec),
      [],
      "should return empty array",
    );
  });
});

describe("main prefix validation", () => {
  it("throws when prefix is empty", () => {
    assert.throws(
      () => cleanupDynamodb({ env: { INPUT_PREFIX: "" } }),
      { message: "INPUT_PREFIX is required" },
      "should throw on empty prefix",
    );
  });
  it("throws when prefix is not set", () => {
    assert.throws(
      () => cleanupDynamodb({ env: {} }),
      { message: "INPUT_PREFIX is required" },
      "should throw on missing prefix",
    );
  });
  it("throws when prefix is whitespace-only", () => {
    assert.throws(
      () => cleanupDynamodb({ env: { INPUT_PREFIX: "   " } }),
      { message: "INPUT_PREFIX is required" },
      "should throw on whitespace-only prefix",
    );
  });
  it("throws when prefix is shorter than 5 characters", () => {
    assert.throws(
      () => cleanupDynamodb({ env: { INPUT_PREFIX: "ab-" } }),
      { message: /at least 5 characters/ },
      "should reject short prefix",
    );
  });
  it("accepts prefix of exactly 5 characters", () => {
    const { exec } = mockExec({}, JSON.stringify({ TableNames: [] }));
    cleanupDynamodb({ env: { INPUT_PREFIX: "test-" }, exec });
  });
});

describe("run partial failure", () => {
  it("continues deleting after a failure and reports all failures", () => {
    let callCount = 0;
    const exec = (bin: string, args: string[]): string => {
      const cmd = [bin, ...args].join(" ");
      if (cmd.includes("list-tables")) {
        return JSON.stringify({ TableNames: ["test-a", "test-b", "test-c"] });
      }
      callCount++;
      if (callCount === SECOND_DELETE_CALL) {
        throw new Error("delete failed");
      }
      return "";
    };
    assert.throws(
      () => run({ prefix: "test-", region: "us-east-1" }, exec),
      { message: /Failed to delete 1 table\(s\): test-b/ },
      "should report the failed table",
    );
    assert.strictEqual(callCount, TOTAL_DELETE_ATTEMPTS, "should attempt all three deletes");
  });
});

describe("main region and env parsing", () => {
  it("throws on invalid region", () => {
    assert.throws(
      () => cleanupDynamodb({ env: { INPUT_PREFIX: "test-", INPUT_REGION: "invalid" } }),
      { message: /Invalid AWS region/ },
      "should throw on invalid region",
    );
  });
  it("accepts valid region", () => {
    const { exec } = mockExec({}, JSON.stringify({ TableNames: [] }));
    cleanupDynamodb({ env: { INPUT_PREFIX: "test-", INPUT_REGION: "eu-west-1" }, exec });
  });
  it("defaults region to 'us-east-1'", () => {
    const { commands, exec } = mockExec({}, JSON.stringify({ TableNames: [] }));
    cleanupDynamodb({ env: { INPUT_PREFIX: "test-" }, exec });
    assert.match(commands[0], /--region us-east-1/, "should use default region");
  });
  it("reads INPUT_REGION from env", () => {
    const { commands, exec } = mockExec({}, JSON.stringify({ TableNames: [] }));
    cleanupDynamodb({ env: { INPUT_PREFIX: "test-", INPUT_REGION: "eu-west-1" }, exec });
    assert.match(commands[0], /--region eu-west-1/, "should use INPUT_REGION from env");
  });
});

describe("run error handling", () => {
  it("propagates exec failure", () => {
    assert.throws(
      () => run({ prefix: "test-", region: "us-east-1" }, throwExec),
      { message: "command failed" },
      "should propagate exec failure from run",
    );
  });
});
