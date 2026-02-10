// Create OpenTofu plan and capture outputs.
//
// 1. Runs tofu plan -no-color -out=plan.tfplan
// 2. Captures text output via tofu show, truncated to 60k chars
// 3. Exports JSON plan to plan.json
// 4. Writes plan, plan-file, and plan-json outputs

const { writeFileSync } = require("node:fs");
const { execCapture } = require("../../../lib/exec.ts");
const { resolveOutputWriter } = require("../../../lib/github-output.ts");

const MAX_PLAN_LENGTH = 60_000;

interface RunArgs {
  workingDirectory: string;
}

interface PlanResult {
  plan: string;
  planFile: string;
  planJson: string;
}

type ExecFn = typeof execCapture;
type WriteFn = (path: string, data: string) => void;

const truncatePlan = (text: string): string => {
  if (text.length > MAX_PLAN_LENGTH) {
    return `${text.substring(0, MAX_PLAN_LENGTH)}\n... (truncated)`;
  }
  return text;
};

const run = ({ workingDirectory }: RunArgs, exec: ExecFn = execCapture, write: WriteFn = writeFileSync): PlanResult => {
  exec("tofu", [`-chdir=${workingDirectory}`, "plan", "-no-color", "-out=plan.tfplan"]);

  const planText = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-no-color", "plan.tfplan"]);
  const planJsonOutput = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-json", "plan.tfplan"]);
  const planJsonPath = `${workingDirectory}/plan.json`;
  write(planJsonPath, planJsonOutput);

  return {
    plan: truncatePlan(planText),
    planFile: `${workingDirectory}/plan.tfplan`,
    planJson: planJsonPath,
  };
};

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  write?: WriteFn;
  writeOutput?: (name: string, value: string) => void;
}

const resolveMainArgs = (args: MainArgs) => ({
  env: args.env || process.env,
  exec: args.exec || execCapture,
  write: args.write || writeFileSync,
});

const main = async (args: MainArgs = {}): Promise<void> => {
  const { env, exec, write } = resolveMainArgs(args);
  const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
  const result = run({ workingDirectory }, exec, write);

  const setOutput = resolveOutputWriter(args);
  setOutput("plan", result.plan);
  setOutput("plan-file", result.planFile);
  setOutput("plan-json", result.planJson);
};

module.exports = Object.assign(main, { MAX_PLAN_LENGTH, run });
