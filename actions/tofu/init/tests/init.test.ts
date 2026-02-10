const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureCommands } = require("../../../../lib/test-helpers.ts");

const init = require("../init.ts");
const { run } = init;

const throwExec = (_bin: string, _args: string[]) => { throw new Error("command failed"); };

describe("run command construction", () => {
  it("includes -backend=true when backend is true", () => {
    const { commands, exec } = captureCommands();
    run({ backend: true, workingDirectory: "tofu" }, exec);

    assert.match(commands[0], /-backend=true/, "should include -backend=true");
  });

  it("includes -backend=false when backend is false", () => {
    const { commands, exec } = captureCommands();
    run({ backend: false, workingDirectory: "tofu" }, exec);

    assert.match(commands[0], /-backend=false/, "should include -backend=false");
  });

  it("includes -chdir with the working directory", () => {
    const { commands, exec } = captureCommands();
    run({ backend: true, workingDirectory: "infra" }, exec);

    assert.match(commands[0], /-chdir=infra/, "should include -chdir with custom directory");
  });

  it("executes exactly one command", () => {
    const { commands, exec } = captureCommands();
    run({ backend: true, workingDirectory: "tofu" }, exec);

    assert.strictEqual(commands.length, 1, "should execute exactly one command");
  });
});

describe("main env parsing: backend", () => {
  it("defaults backend to true when INPUT_BACKEND is not set", () => {
    const { commands, exec } = captureCommands();
    init({ env: {}, exec });
    assert.match(commands[0], /-backend=true/, "should default backend to true");
  });

  it("sets backend to false when INPUT_BACKEND is 'false'", () => {
    const { commands, exec } = captureCommands();
    init({ env: { INPUT_BACKEND: "false" }, exec });
    assert.match(commands[0], /-backend=false/, "should set backend to false");
  });

  it("treats INPUT_BACKEND='true' as true", () => {
    const { commands, exec } = captureCommands();
    init({ env: { INPUT_BACKEND: "true" }, exec });
    assert.match(commands[0], /-backend=true/, "should treat 'true' as true");
  });

  it("treats INPUT_BACKEND='anything' as true (only 'false' disables)", () => {
    const { commands, exec } = captureCommands();
    init({ env: { INPUT_BACKEND: "yes" }, exec });
    assert.match(commands[0], /-backend=true/, "should treat non-'false' values as true");
  });
});

describe("main env parsing: working directory", () => {
  it("defaults working directory to 'tofu'", () => {
    const { commands, exec } = captureCommands();
    init({ env: {}, exec });
    assert.match(commands[0], /-chdir=tofu/, "should use default working directory 'tofu'");
  });

  it("reads INPUT_WORKING_DIRECTORY from env", () => {
    const { commands, exec } = captureCommands();
    init({
      env: { INPUT_WORKING_DIRECTORY: "infra" },
      exec,
    });
    assert.match(commands[0], /-chdir=infra/, "should use INPUT_WORKING_DIRECTORY from env");
  });
});

describe("error handling", () => {
  it("propagates exec failure", () => {
    assert.throws(() => run({ backend: true, workingDirectory: "tofu" }, throwExec), { message: "command failed" });
  });
});

// Snapshot: full command with defaults
describe("snapshot", () => {
  it("matches expected full command with default env", () => {
    const { commands, exec } = captureCommands();
    init({ env: {}, exec });

    assert.strictEqual(commands[0], "tofu -chdir=tofu init -backend=true", "full command should match expected output");
  });
});
