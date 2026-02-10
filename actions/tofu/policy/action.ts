// Run Conftest policy checks against an OpenTofu plan.
//
// 1. Runs conftest update to pull latest policies
// 2. Runs conftest test against the JSON plan file
// 3. Sets has_violations and policy_violations outputs

const { execCapture } = require("../../../lib/exec.ts");
const { resolveOutputWriter } = require("../../../lib/github-output.ts");

interface RunArgs {
  planJson: string;
}

interface PolicyResult {
  hasViolations: boolean;
  policyViolations: string;
}

type ExecFn = typeof execCapture;

const run = ({ planJson }: RunArgs, exec: ExecFn = execCapture): PolicyResult => {
  exec("conftest", ["update"]);

  try {
    exec("conftest", ["test", planJson]);
    return { hasViolations: false, policyViolations: "" };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    const output = (execError.stdout || "") + (execError.stderr || "");
    return { hasViolations: true, policyViolations: output };
  }
};

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const { env = process.env, exec = execCapture } = args;
  const planJson = env.INPUT_PLAN_JSON || "tofu/plan.json";
  const result = run({ planJson }, exec);

  const setOutput = resolveOutputWriter(args);
  setOutput("has_violations", String(result.hasViolations));
  setOutput("policy_violations", result.policyViolations);
};

module.exports = Object.assign(main, { run });
