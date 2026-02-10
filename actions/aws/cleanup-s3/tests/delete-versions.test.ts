const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");
const { deleteAllVersions } = require("../delete-versions.ts");

const BATCH_CMD_COUNT = 2;
const PAGINATED_CMD_COUNT = 4;
const TOTAL_OBJECTS = 3;
const EMPTY = JSON.stringify({});
const VERSIONS = JSON.stringify({
  DeleteMarkers: [{ Key: "file3.txt", VersionId: "dm1" }],
  Versions: [
    { Key: "file1.txt", VersionId: "v1" },
    { Key: "file2.txt", VersionId: "v2" },
  ],
});
const PAGE1 = JSON.stringify({
  IsTruncated: true,
  NextKeyMarker: "file2.txt",
  NextVersionIdMarker: "v2",
  Versions: [
    { Key: "file1.txt", VersionId: "v1" },
    { Key: "file2.txt", VersionId: "v2" },
  ],
});
const PAGE2 = JSON.stringify({ Versions: [{ Key: "file3.txt", VersionId: "v3" }] });

const paginatedExec = (_b: string, _a: string[]): string => {
  const cmd = [_b, ..._a].join(" ");
  if (!cmd.includes("list-object-versions")) {
    return "";
  }
  if (cmd.includes("--key-marker")) {
    return PAGE2;
  }
  return PAGE1;
};
const throwVersionsExec = (_b: string, _a: string[]) => {
  throw new Error("versions failed");
};

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
    const exec = (bin: string, args: string[]): string => {
      commands.push([bin, ...args].join(" "));
      return paginatedExec(bin, args);
    };
    deleteAllVersions("my-bucket", "us-east-1", exec);
    assert.strictEqual(commands.length, PAGINATED_CMD_COUNT, "2 list pages + 2 batch deletes");
    assert.match(commands[0], /list-object-versions/, "first list call");
    assert.match(commands[1], /delete-objects/, "first batch delete");
    assert.match(commands[BATCH_CMD_COUNT], /--key-marker file2\.txt/, "second list uses key marker");
    assert.match(commands[BATCH_CMD_COUNT], /--version-id-marker v2/, "second list uses version-id marker");
  });
});

describe("deleteAllVersions batch chunking", () => {
  it("chunks deletes when objects exceed 1000", () => {
    const BATCH_LIMIT = 1000;
    const TOTAL = 1500;
    const versions = Array.from({ length: TOTAL }, (_, i) => ({ Key: `file${i}.txt`, VersionId: `v${i}` }));
    const response = JSON.stringify({ Versions: versions });
    const { commands, exec } = mockExec({ "list-object-versions": response }, "");
    deleteAllVersions("my-bucket", "us-east-1", exec);
    const deleteCmds = commands.filter((c: string) => c.includes("delete-objects"));
    assert.strictEqual(deleteCmds.length, 2, "should split into 2 batch delete calls");
    const firstPayload = JSON.parse(deleteCmds[0].split("--delete ")[1]);
    const secondPayload = JSON.parse(deleteCmds[1].split("--delete ")[1]);
    assert.strictEqual(firstPayload.Objects.length, BATCH_LIMIT, "first batch should have 1000 objects");
    assert.strictEqual(secondPayload.Objects.length, TOTAL - BATCH_LIMIT, "second batch should have remaining 500");
  });
});

describe("deleteAllVersions error propagation", () => {
  it("propagates exec failures", () => {
    assert.throws(() => deleteAllVersions("b", "us-east-1", throwVersionsExec), { message: "versions failed" });
  });
});
