const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs, mockExec, noopWrite } = require("../../../../lib/test-helpers.ts");
const plan = require("../plan.ts");
const { run, MAX_PLAN_LENGTH } = plan;

const EXPECTED_COMMAND_COUNT = 3;
const TRUNCATION_OVERSHOOT = 100;
const defaultResponses = () => ({ "plan ": "", "show -json": "{}", "show -no-color": "No changes." });
const collectWrites = () => {
  const writes: { data: string; path: string }[] = [];
  return { writeFn: (fp: string, fd: string) => writes.push({ data: fd, path: fp }), writes };
};

describe("run command order and flags", () => {
  it("executes plan, show, and show -json in order", () => {
    const { commands, exec } = mockExec({
      "plan ": "",
      "show -json": '{"format_version":"1.0"}',
      "show -no-color": "No changes.",
    });
    run({ workingDirectory: "tofu" }, exec, collectWrites().writeFn);
    assert.strictEqual(commands.length, EXPECTED_COMMAND_COUNT, "should execute exactly 3 commands");
    assert.match(commands[0], /plan -no-color -out=plan\.tfplan/, "first command should be plan");
    assert.match(commands[1], /show -no-color plan\.tfplan/, "second command should be show text");
    assert.match(commands[EXPECTED_COMMAND_COUNT - 1], /show -json plan\.tfplan/, "third should be show json");
  });
  it("includes -chdir in all commands", () => {
    const { commands, exec } = mockExec({ "plan ": "", show: "x" });
    run({ workingDirectory: "infra" }, exec, noopWrite);
    for (const cmd of commands) {
      assert.match(cmd, /-chdir=infra/, `command should include -chdir=infra: ${cmd}`);
    }
  });
});

describe("run results and file writing", () => {
  it("returns plan text from show command", () => {
    const { exec } = mockExec({ "plan ": "", "show -json": "{}", "show -no-color": "Plan: 2 to add." });
    assert.strictEqual(run({ workingDirectory: "tofu" }, exec, noopWrite).plan, "Plan: 2 to add.", "plan mismatch");
  });
  it("returns correct file paths", () => {
    const result = run({ workingDirectory: "infra" }, mockExec({ "plan ": "", show: "x" }).exec, noopWrite);
    assert.strictEqual(result.planFile, "infra/plan.tfplan", "planFile path mismatch");
    assert.strictEqual(result.planJson, "infra/plan.json", "planJson path mismatch");
  });
  it("writes JSON plan to file", () => {
    const jsonContent = '{"resource_changes":[]}';
    const { exec } = mockExec({ "plan ": "", "show -json": jsonContent, "show -no-color": "x" });
    const { writeFn, writes } = collectWrites();
    run({ workingDirectory: "tofu" }, exec, writeFn);
    assert.strictEqual(writes.length, 1, "should write exactly one file");
    assert.strictEqual(writes[0].path, "tofu/plan.json", "should write to plan.json");
    assert.strictEqual(writes[0].data, jsonContent, "should write the JSON show output");
  });
});

describe("run truncation", () => {
  it("truncates plan text longer than MAX_PLAN_LENGTH", () => {
    const longPlan = "x".repeat(MAX_PLAN_LENGTH + TRUNCATION_OVERSHOOT);
    const { exec } = mockExec({ "plan ": "", "show -json": "{}", "show -no-color": longPlan });
    const result = run({ workingDirectory: "tofu" }, exec, noopWrite);
    assert.ok(result.plan.length < longPlan.length, "result should be shorter than original");
    assert.ok(result.plan.endsWith("\n... (truncated)"), "should end with truncation marker");
    assert.strictEqual(result.plan.length, MAX_PLAN_LENGTH + "\n... (truncated)".length, "truncated length mismatch");
  });
  it("does not truncate plan text at or below MAX_PLAN_LENGTH", () => {
    const { exec: shortExec } = mockExec({ "plan ": "", "show -json": "{}", "show -no-color": "No changes." });
    assert.strictEqual(run({ workingDirectory: "tofu" }, shortExec, noopWrite).plan, "No changes.", "short mismatch");
    const exactPlan = "y".repeat(MAX_PLAN_LENGTH);
    const { exec: exactExec } = mockExec({ "plan ": "", "show -json": "{}", "show -no-color": exactPlan });
    const result = run({ workingDirectory: "tofu" }, exactExec, noopWrite);
    assert.strictEqual(result.plan.length, MAX_PLAN_LENGTH, "exact-length plan should not be truncated");
    assert.ok(!result.plan.includes("truncated"), "should not contain truncation marker");
  });
});

describe("error handling", () => {
  it("propagates plan failure without calling show or write", () => {
    const commands: string[] = [];
    const throwExec = (bin: string, args: string[]) => {
      const cmd = [bin, ...args].join(" ");
      commands.push(cmd);
      if (cmd.includes("plan")) {
        throw new Error("command failed");
      }
      return "";
    };
    const { writeFn, writes } = collectWrites();
    assert.throws(() => run({ workingDirectory: "tofu" }, throwExec, writeFn), { message: "command failed" });
    assert.strictEqual(commands.length, 1, "should only execute the plan command before failing");
    assert.strictEqual(writes.length, 0, "should not write any files when plan fails");
  });
});

describe("main entry point", () => {
  it("sets all three outputs via writeOutput", async () => {
    const { exec } = mockExec({ "plan ": "", "show -json": '{"ok":true}', "show -no-color": "No changes." });
    const { outputs, writeOutput } = captureOutputs();
    await plan({ env: {}, exec, write: noopWrite, writeOutput });
    assert.strictEqual(outputs["plan"], "No changes.", "plan output mismatch");
    assert.strictEqual(outputs["plan-file"], "tofu/plan.tfplan", "plan-file output mismatch");
    assert.strictEqual(outputs["plan-json"], "tofu/plan.json", "plan-json output mismatch");
  });
  it("uses core.setOutput when core is provided", async () => {
    const { exec } = mockExec({ "plan ": "", "show -json": "{}", "show -no-color": "text" });
    const { outputs, writeOutput: setOutput } = captureOutputs();
    await plan({ core: { setOutput }, env: {}, exec, write: noopWrite });
    assert.strictEqual(outputs["plan"], "text", "should use core.setOutput for plan");
    assert.ok("plan-file" in outputs, "should set plan-file via core.setOutput");
    assert.ok("plan-json" in outputs, "should set plan-json via core.setOutput");
  });
  it("defaults working directory to 'tofu'", async () => {
    const { commands, exec } = mockExec(defaultResponses());
    await plan({ env: {}, exec, write: noopWrite, writeOutput: noopWrite });
    assert.match(commands[0], /-chdir=tofu/, "should use default working directory 'tofu'");
  });
  it("reads INPUT_WORKING_DIRECTORY from env", async () => {
    const { commands, exec } = mockExec(defaultResponses());
    await plan({ env: { INPUT_WORKING_DIRECTORY: "infrastructure" }, exec, write: noopWrite, writeOutput: noopWrite });
    assert.match(commands[0], /-chdir=infrastructure/, "should use INPUT_WORKING_DIRECTORY from env");
  });
});
