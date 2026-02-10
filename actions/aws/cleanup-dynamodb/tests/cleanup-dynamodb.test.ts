const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");

const cleanupDynamodb = require("../cleanup-dynamodb.ts");
const { listTables, run } = cleanupDynamodb;

const TABLES_RESPONSE = JSON.stringify({ TableNames: ["test-locks", "test-state", "prod-locks"] });
const EXPECTED_LIST_DELETE_COMMANDS = 3;
const EXPECTED_PAGINATION_CALLS = 2;
const emptyTablesExec = (_bin: string, _args: string[]) => JSON.stringify({ TableNames: [] });
const emptyObjectExec = (_bin: string, _args: string[]) => JSON.stringify({});
const throwExec = (_bin: string, _args: string[]) => { throw new Error("command failed"); };
const throwListExec = (_bin: string, _args: string[]) => { throw new Error("list failed"); };

describe("listTables filtering", () => {
  it("filters tables by prefix", () => {
    const exec = (_bin: string, _args: string[]) => TABLES_RESPONSE;
    assert.deepStrictEqual(listTables("test-", "us-east-1", exec), ["test-locks", "test-state"], "should return only matching tables");
  });
  it("returns empty array when no tables match", () => {
    const exec = (_bin: string, _args: string[]) => TABLES_RESPONSE;
    assert.deepStrictEqual(listTables("staging-", "us-east-1", exec), [], "should return empty array for non-matching prefix");
  });
  it("handles empty TableNames array", () => {
    assert.deepStrictEqual(listTables("test-", "us-east-1", emptyTablesExec), [], "should return empty array");
  });
  it("handles undefined TableNames", () => {
    assert.deepStrictEqual(listTables("test-", "us-east-1", emptyObjectExec), [], "should return empty array");
  });
  it("passes correct region to aws command", () => {
    const { commands, exec } = mockExec({}, JSON.stringify({ TableNames: [] }));
    listTables("test-", "eu-west-1", exec);
    assert.match(commands[0], /--region eu-west-1/, "should include correct region");
  });
});

describe("listTables pagination", () => {
  it("collects matches across pages", () => {
    const page1 = JSON.stringify({ LastEvaluatedTableName: "prod-x", TableNames: ["test-a", "prod-x"] });
    const page2 = JSON.stringify({ TableNames: ["test-b", "test-c"] });
    let callCount = 0;
    const exec = (_bin: string, _args: string[]) => { callCount += 1; if (callCount === 1) { return page1; } return page2; };
    assert.deepStrictEqual(listTables("test-", "us-east-1", exec), ["test-a", "test-b", "test-c"], "should collect matches across pages");
  });
  it("passes exclusive-start-table-name on subsequent pages", () => {
    const page1 = JSON.stringify({ LastEvaluatedTableName: "t1", TableNames: ["t1"] });
    const page2 = JSON.stringify({ TableNames: [] });
    const { commands, exec } = mockExec({ "exclusive-start-table-name": page2 }, page1);
    listTables("t", "us-east-1", exec);
    assert.strictEqual(commands.length, EXPECTED_PAGINATION_CALLS, "should make exactly two API calls");
    assert.match(commands[1], /--exclusive-start-table-name t1/, "second call should include start table");
    assert.ok(!commands[0].includes("exclusive-start-table-name"), "first call should not include start table");
  });
});

describe("run orchestration", () => {
  it("lists tables then deletes each matching table", () => {
    const { commands, exec } = mockExec({ "list-tables": JSON.stringify({ TableNames: ["test-locks", "test-state"] }) });
    const result = run({ prefix: "test-", region: "us-east-1" }, exec);
    assert.deepStrictEqual(result, ["test-locks", "test-state"], "should return deleted table names");
    assert.strictEqual(commands.length, EXPECTED_LIST_DELETE_COMMANDS, "should execute 3 commands (1 list + 2 deletes)");
    assert.match(commands[0], /list-tables/, "first command should list tables");
    assert.match(commands[1], /delete-table --table-name test-locks/, "should delete first table");
    assert.match(commands[EXPECTED_LIST_DELETE_COMMANDS - 1], /delete-table --table-name test-state/, "should delete second table");
  });
  it("returns empty array when no tables match", () => {
    assert.deepStrictEqual(run({ prefix: "test-", region: "us-east-1" }, emptyTablesExec), [], "should return empty array");
  });
});

describe("main validation", () => {
  it("throws when prefix is empty", () => {
    assert.throws(() => cleanupDynamodb({ env: { INPUT_PREFIX: "" } }), { message: "INPUT_PREFIX is required" }, "should throw on empty prefix");
  });
  it("throws when prefix is not set", () => {
    assert.throws(() => cleanupDynamodb({ env: {} }), { message: "INPUT_PREFIX is required" }, "should throw on missing prefix");
  });
  it("throws when prefix is whitespace-only", () => {
    assert.throws(() => cleanupDynamodb({ env: { INPUT_PREFIX: "   " } }), { message: "INPUT_PREFIX is required" }, "should throw on whitespace-only prefix");
  });
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
});

describe("main env parsing", () => {
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

describe("error handling", () => {
  it("propagates exec failure from run", () => {
    assert.throws(() => run({ prefix: "test-", region: "us-east-1" }, throwExec), { message: "command failed" });
  });
  it("propagates exec failure from listTables", () => {
    assert.throws(() => listTables("test-", "us-east-1", throwListExec), { message: "list failed" });
  });
});
