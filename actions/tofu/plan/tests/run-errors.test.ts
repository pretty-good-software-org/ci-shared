const { describe, it } = require("node:test");
const assert = require("node:assert");
const { run } = require("../run.ts");

describe("run error handling", () => {
  it("propagates plan failure without calling show or write", () => {
    const commands: string[] = [];
    const writes: string[] = [];
    const throwExec = (bin: string, args: string[]) => {
      const cmd = [bin, ...args].join(" ");
      commands.push(cmd);
      if (cmd.includes("plan")) {
        throw new Error("command failed");
      }
      return "";
    };

    assert.throws(() => run({ workingDirectory: "tofu" }, throwExec, (path: string) => writes.push(path)), {
      message: "command failed",
    });
    assert.strictEqual(commands.length, 1, "should only execute the plan command before failing");
    assert.strictEqual(writes.length, 0, "should not write any files when plan fails");
  });
});
