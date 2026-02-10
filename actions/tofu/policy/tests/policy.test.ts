const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs, mockExec, noopExec } = require("../../../../lib/test-helpers.ts");

const policy = require("../policy.ts");
const { run } = policy;

const EXPECTED_COMMAND_COUNT = 2;
const successExec = (_bin: string, _args: string[]) => "5 tests, 5 passed, 0 warnings, 0 failures";
const conftestThrowExec = (bin: string, args: string[]) => {
  const cmd = [bin, ...args].join(" ");
  if (cmd.includes("conftest test")) {
    const error = new Error("conftest failed") as Error & { stdout: string; stderr: string };
    error.stdout = "FAIL - policy/deny.rego\n";
    error.stderr = "1 test, 0 passed, 0 warnings, 1 failure\n";
    throw error;
  }
  return "";
};
const conftestBareThrowExec = (bin: string, args: string[]) => {
  const cmd = [bin, ...args].join(" ");
  if (cmd.includes("conftest test")) {
    throw new Error("exit code 1");
  }
  return "";
};
const conftestFailExec = (bin: string, args: string[]) => {
  const cmd = [bin, ...args].join(" ");
  if (cmd.includes("conftest test")) {
    const error = new Error("fail") as Error & { stdout: string; stderr: string };
    error.stdout = "FAIL";
    error.stderr = "";
    throw error;
  }
  return "";
};

describe("run command execution", () => {
  it("calls conftest update before conftest test", () => {
    const { commands, exec } = mockExec();
    run({ planJson: "tofu/plan.json" }, exec);
    assert.strictEqual(commands.length, EXPECTED_COMMAND_COUNT, "should execute exactly 2 commands");
    assert.match(commands[0], /conftest update/, "first command should be conftest update");
    assert.match(commands[1], /conftest test/, "second command should be conftest test");
  });
  it("passes plan-json path to conftest test", () => {
    const { commands, exec } = mockExec();
    run({ planJson: "custom/plan.json" }, exec);
    assert.match(commands[1], /custom\/plan\.json/, "should include the plan-json path");
  });
});

describe("run policy result", () => {
  it("returns no violations when conftest succeeds", () => {
    const result = run({ planJson: "tofu/plan.json" }, successExec);
    assert.strictEqual(result.hasViolations, false, "hasViolations should be false");
    assert.strictEqual(result.policyViolations, "", "policyViolations should be empty");
  });
  it("returns violations when conftest throws", () => {
    const result = run({ planJson: "tofu/plan.json" }, conftestThrowExec);
    assert.strictEqual(result.hasViolations, true, "hasViolations should be true");
    assert.match(result.policyViolations, /FAIL/, "policyViolations should contain failure details");
    assert.match(result.policyViolations, /1 failure/, "policyViolations should contain stderr");
  });
  it("handles error with no stdout or stderr", () => {
    const result = run({ planJson: "tofu/plan.json" }, conftestBareThrowExec);
    assert.strictEqual(result.hasViolations, true, "hasViolations should be true");
    assert.strictEqual(result.policyViolations, "", "policyViolations should be empty when no output");
  });
});

describe("main output writing", () => {
  it("sets outputs on success", async () => {
    const { outputs, writeOutput } = captureOutputs();
    await policy({
      env: {},
      exec: noopExec,
      writeOutput,
    });
    assert.strictEqual(outputs["has_violations"], "false", "has_violations should be 'false'");
    assert.strictEqual(outputs["policy_violations"], "", "policy_violations should be empty");
  });
  it("sets outputs on violation", async () => {
    const { outputs, writeOutput } = captureOutputs();
    await policy({
      env: {},
      exec: conftestFailExec,
      writeOutput,
    });
    assert.strictEqual(outputs["has_violations"], "true", "has_violations should be 'true'");
    assert.match(outputs["policy_violations"], /FAIL/, "policy_violations should contain details");
  });
});

describe("main env parsing", () => {
  it("defaults plan-json to 'tofu/plan.json'", async () => {
    const { commands, exec } = mockExec();
    await policy({ env: {}, exec, writeOutput: () => {} });
    assert.match(commands[1], /tofu\/plan\.json/, "should use default plan-json path");
  });
  it("reads INPUT_PLAN_JSON from env", async () => {
    const { commands, exec } = mockExec();
    await policy({ env: { INPUT_PLAN_JSON: "custom/plan.json" }, exec, writeOutput: () => {} });
    assert.match(commands[1], /custom\/plan\.json/, "should use INPUT_PLAN_JSON from env");
  });
});
