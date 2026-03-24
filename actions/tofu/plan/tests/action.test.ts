const { describe, it } = require("node:test");
const assert = require("node:assert");
const { captureOutputs, mockExec, noopWrite } = require("../../../../lib/test-helpers.ts");
const main = require("../action.ts");

const defaultResponses = () => ({ "plan ": "", "show -json": "{}", "show -no-color": "No changes." });

describe("main entry point", () => {
  it("sets all three outputs via writeOutput", async () => {
    const { exec } = mockExec({ "plan ": "", "show -json": '{"ok":true}', "show -no-color": "No changes." });
    const { outputs, writeOutput } = captureOutputs();
    await main({ env: {}, exec, write: noopWrite, writeOutput });
    assert.strictEqual(outputs["plan"], "No changes.", "plan output mismatch");
    assert.strictEqual(outputs["plan-file"], "tofu/plan.tfplan", "plan-file output mismatch");
    assert.strictEqual(outputs["plan-json"], "tofu/plan.json", "plan-json output mismatch");
  });

  it("uses core.setOutput when core is provided", async () => {
    const { exec } = mockExec({ "plan ": "", "show -json": "{}", "show -no-color": "text" });
    const { outputs, writeOutput: setOutput } = captureOutputs();
    await main({ core: { setOutput }, env: {}, exec, write: noopWrite });
    assert.strictEqual(outputs["plan"], "text", "should use core.setOutput for plan");
    assert.ok("plan-file" in outputs, "should set plan-file via core.setOutput");
    assert.ok("plan-json" in outputs, "should set plan-json via core.setOutput");
  });

  it("defaults working directory to 'tofu'", async () => {
    const { commands, exec } = mockExec(defaultResponses());
    await main({ env: {}, exec, write: noopWrite, writeOutput: noopWrite });
    assert.match(commands[0], /-chdir=tofu/, "should use default working directory 'tofu'");
  });

  it("reads INPUT_WORKING_DIRECTORY from env", async () => {
    const { commands, exec } = mockExec(defaultResponses());
    await main({ env: { INPUT_WORKING_DIRECTORY: "infrastructure" }, exec, write: noopWrite, writeOutput: noopWrite });
    assert.match(commands[0], /-chdir=infrastructure/, "should use INPUT_WORKING_DIRECTORY from env");
  });

  it("passes INPUT_VAR_FILE to plan command", async () => {
    const { commands, exec } = mockExec(defaultResponses());
    await main({ env: { INPUT_VAR_FILE: "environments/prod.tfvars" }, exec, write: noopWrite, writeOutput: noopWrite });
    assert.match(commands[0], /-var-file=environments\/prod\.tfvars/, "should pass var-file to plan");
  });

  it("does not pass var-file when INPUT_VAR_FILE is empty", async () => {
    const { commands, exec } = mockExec(defaultResponses());
    await main({ env: { INPUT_VAR_FILE: "" }, exec, write: noopWrite, writeOutput: noopWrite });
    assert.ok(!commands[0].includes("-var-file"), "should not include -var-file when empty");
  });
});
