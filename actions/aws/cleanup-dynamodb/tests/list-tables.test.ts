const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");

const { listTables } = require("../list-tables.ts");

const TABLES_RESPONSE = JSON.stringify({ TableNames: ["test-locks", "test-state", "prod-locks"] });
const EXPECTED_PAGINATION_CALLS = 2;
const emptyTablesExec = (_bin: string, _args: string[]) => JSON.stringify({ TableNames: [] });
const emptyObjectExec = (_bin: string, _args: string[]) => JSON.stringify({});
const throwExec = (_bin: string, _args: string[]) => {
  throw new Error("list failed");
};

describe("listTables filtering", () => {
  it("filters tables by prefix", () => {
    const exec = (_bin: string, _args: string[]) => TABLES_RESPONSE;
    assert.deepStrictEqual(
      listTables("test-", "us-east-1", exec),
      ["test-locks", "test-state"],
      "should return only matching tables",
    );
  });
  it("returns empty array when no tables match", () => {
    const exec = (_bin: string, _args: string[]) => TABLES_RESPONSE;
    assert.deepStrictEqual(
      listTables("staging-", "us-east-1", exec),
      [],
      "should return empty array for non-matching prefix",
    );
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
    const exec = (_bin: string, _args: string[]) => {
      callCount += 1;
      if (callCount === 1) {
        return page1;
      }
      return page2;
    };
    assert.deepStrictEqual(
      listTables("test-", "us-east-1", exec),
      ["test-a", "test-b", "test-c"],
      "should collect matches across pages",
    );
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

describe("listTables error handling", () => {
  it("propagates exec failure", () => {
    assert.throws(() => listTables("test-", "us-east-1", throwExec), { message: "list failed" });
  });
});
