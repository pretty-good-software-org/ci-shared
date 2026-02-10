const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureCommands } = require("../../../../lib/test-helpers.ts");

const apply = require("../action.ts");
const { run } = apply;

const throwExec = (_bin: string, _args: string[]) => {
  throw new Error("command failed");
};

describe("run command construction", () => {
  it("includes -input=false flag", () => {
    const { commands, exec } = captureCommands();
    run({ planFile: "plan.tfplan", workingDirectory: "tofu" }, exec);

    assert.match(commands[0], /-input=false/, "should include -input=false");
  });

  it("includes -auto-approve flag", () => {
    const { commands, exec } = captureCommands();
    run({ planFile: "plan.tfplan", workingDirectory: "tofu" }, exec);

    assert.match(commands[0], /-auto-approve/, "should include -auto-approve");
  });

  it("includes the plan file in the command", () => {
    const { commands, exec } = captureCommands();
    run({ planFile: "custom.tfplan", workingDirectory: "tofu" }, exec);

    assert.match(commands[0], /custom\.tfplan/, "should include the plan file name");
  });

  it("includes -chdir with the working directory", () => {
    const { commands, exec } = captureCommands();
    run({ planFile: "plan.tfplan", workingDirectory: "infra" }, exec);

    assert.match(commands[0], /-chdir=infra/, "should include -chdir with custom directory");
  });

  it("executes exactly one command", () => {
    const { commands, exec } = captureCommands();
    run({ planFile: "plan.tfplan", workingDirectory: "tofu" }, exec);

    assert.strictEqual(commands.length, 1, "should execute exactly one command");
  });
});

describe("main env parsing", () => {
  it("defaults working directory to 'tofu'", () => {
    const { commands, exec } = captureCommands();
    apply({ env: {}, exec });

    assert.match(commands[0], /-chdir=tofu/, "should use default working directory 'tofu'");
  });

  it("defaults plan file to 'plan.tfplan'", () => {
    const { commands, exec } = captureCommands();
    apply({ env: {}, exec });

    assert.match(commands[0], /plan\.tfplan/, "should use default plan file 'plan.tfplan'");
  });

  it("reads INPUT_WORKING_DIRECTORY from env", () => {
    const { commands, exec } = captureCommands();
    apply({
      env: { INPUT_WORKING_DIRECTORY: "infra" },
      exec,
    });

    assert.match(commands[0], /-chdir=infra/, "should use INPUT_WORKING_DIRECTORY from env");
  });

  it("reads INPUT_PLAN_FILE from env", () => {
    const { commands, exec } = captureCommands();
    apply({
      env: { INPUT_PLAN_FILE: "other.tfplan" },
      exec,
    });

    assert.match(commands[0], /other\.tfplan/, "should use INPUT_PLAN_FILE from env");
  });
});

describe("error handling", () => {
  it("propagates exec failure", () => {
    assert.throws(() => run({ planFile: "plan.tfplan", workingDirectory: "tofu" }, throwExec), {
      message: "command failed",
    });
  });
});

// Snapshot: full command with defaults
describe("snapshot", () => {
  it("matches expected full command with default env", () => {
    const { commands, exec } = captureCommands();
    apply({ env: {}, exec });

    assert.strictEqual(
      commands[0],
      "tofu -chdir=tofu apply -input=false -auto-approve plan.tfplan",
      "full command should match expected output",
    );
  });
});
