const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs, mockExec } = require("../../../../lib/test-helpers.ts");

const policy = require("../action.ts");
const { run } = policy;

const successOutput = "5 tests, 5 passed, 0 warnings, 0 failures";
const successExec = (_bin: string, _args: string[]) => successOutput;
const conftestThrowExec = (_bin: string, args: string[]) => {
  if (args[0] === "pull") {
    return "";
  }
  const error = new Error("conftest failed") as Error & { stdout: string; stderr: string };
  error.stdout = "FAIL - policy/deny.rego\n";
  error.stderr = "1 test, 0 passed, 0 warnings, 1 failure\n";
  throw error;
};
const conftestBareThrowExec = (_bin: string, args: string[]) => {
  if (args[0] === "pull") {
    return "";
  }
  throw new Error("exit code 1");
};
const conftestFailExec = (_bin: string, args: string[]) => {
  if (args[0] === "pull") {
    return "";
  }
  const error = new Error("fail") as Error & { stdout: string; stderr: string };
  error.stdout = "FAIL";
  error.stderr = "";
  throw error;
};

describe("run command execution", () => {
  it("calls conftest test", () => {
    const { commands, exec } = mockExec({}, successOutput);
    run({ planJson: "tofu/plan.json" }, exec);
    assert.deepStrictEqual(
      commands,
      [
        "conftest pull git::ssh://git@github.com/pretty-good-software-org/opa-policies.git//policy",
        "conftest test --all-namespaces --quiet=false tofu/plan.json",
      ],
      "commands should fetch policies before testing and keep the count summary visible",
    );
  });
  it("passes plan-json path to conftest test", () => {
    const { commands, exec } = mockExec({}, successOutput);
    run({ planJson: "custom/plan.json" }, exec);
    assert.match(commands[1], /custom\/plan\.json/, "should include the plan-json path");
  });
});

describe("run policy result", () => {
  it("returns no violations when conftest loads the minimum policy count", () => {
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
  it("uses the error message when conftest emits no output", () => {
    const result = run({ planJson: "tofu/plan.json" }, conftestBareThrowExec);
    assert.strictEqual(result.hasViolations, true, "hasViolations should be true");
    assert.strictEqual(
      result.policyViolations,
      "exit code 1",
      "policyViolations should retain the available error context",
    );
  });
});

describe("main output writing", () => {
  it("sets outputs on success", async () => {
    const { outputs, writeOutput } = captureOutputs();
    await policy({
      env: {},
      exec: successExec,
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
    const { commands, exec } = mockExec({}, successOutput);
    await policy({ env: {}, exec, writeOutput: () => {} });
    assert.match(commands[1], /tofu\/plan\.json/, "should use default plan-json path");
  });
  it("reads INPUT_PLAN_JSON from env", async () => {
    const { commands, exec } = mockExec({}, successOutput);
    await policy({ env: { INPUT_PLAN_JSON: "custom/plan.json" }, exec, writeOutput: () => {} });
    assert.match(commands[1], /custom\/plan\.json/, "should use INPUT_PLAN_JSON from env");
  });
});
