const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureCommands } = require("../../../../lib/test-helpers.ts");

const fmtCheck = require("../action.ts");
const { run } = fmtCheck;

const throwExec = (_bin: string, _args: string[]) => {
  throw new Error("command failed");
};

describe("run command construction", () => {
  it("includes -chdir with the working directory", () => {
    const { commands, exec } = captureCommands();
    run({ workingDirectory: "infra/tofu" }, exec);

    assert.match(commands[0], /-chdir=infra\/tofu/, "should include -chdir with custom directory");
  });

  it("includes -check and -recursive flags", () => {
    const { commands, exec } = captureCommands();
    run({ workingDirectory: "tofu" }, exec);

    assert.match(commands[0], /-check/, "should include -check flag");
    assert.match(commands[0], /-recursive/, "should include -recursive flag");
  });

  it("executes exactly one command", () => {
    const { commands, exec } = captureCommands();
    run({ workingDirectory: "tofu" }, exec);

    assert.strictEqual(commands.length, 1, "should execute exactly one command");
  });
});

describe("main env parsing", () => {
  it("defaults working directory to 'tofu'", () => {
    const { commands, exec } = captureCommands();
    fmtCheck({ env: {}, exec });

    assert.match(commands[0], /-chdir=tofu/, "should use default working directory 'tofu'");
  });

  it("reads INPUT_WORKING_DIRECTORY from env", () => {
    const { commands, exec } = captureCommands();
    fmtCheck({
      env: { INPUT_WORKING_DIRECTORY: "custom" },
      exec,
    });

    assert.match(commands[0], /-chdir=custom/, "should use INPUT_WORKING_DIRECTORY from env");
  });
});

describe("error handling", () => {
  it("propagates exec failure", () => {
    assert.throws(() => run({ workingDirectory: "tofu" }, throwExec), { message: "command failed" });
  });
});

// Snapshot: full command with defaults
describe("snapshot", () => {
  it("matches expected full command with default env", () => {
    const { commands, exec } = captureCommands();
    fmtCheck({ env: {}, exec });

    assert.strictEqual(
      commands[0],
      "tofu -chdir=tofu fmt -check -recursive",
      "full command should match expected output",
    );
  });
});
