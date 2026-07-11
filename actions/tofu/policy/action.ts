// Run Conftest policy checks against an OpenTofu plan.
//
// 1. Runs conftest test against the JSON plan file
// 2. Sets has_violations and policy_violations outputs

const { execCapture } = require("../../../lib/exec.ts");
const { resolveOutputWriter } = require("../../../lib/github-output.ts");

interface RunArgs {
  planJson: string;
}

interface PolicyResult {
  hasViolations: boolean;
  policyViolations: string;
  policyIntegrityFailed: boolean;
}

type ExecFn = typeof execCapture;

const MINIMUM_POLICY_TESTS = 5;
const POLICY_REPOSITORY = "git::ssh://git@github.com/pretty-good-software-org/opa-policies.git//policy";
const POLICY_SUMMARY_PATTERN = /(?:^|\n)\s*(\d+) tests?,/;

const policyIntegrityFailure = (output: string): string => {
  const summary = output.match(POLICY_SUMMARY_PATTERN);
  if (!summary) {
    return "Policy integrity check failed: conftest did not report a loaded-test count; refusing to trust the policy result";
  }

  const loadedTestCount = Number(summary[1]);
  if (loadedTestCount < MINIMUM_POLICY_TESTS) {
    return `Policy integrity check failed: conftest loaded ${loadedTestCount} tests; require at least ${MINIMUM_POLICY_TESTS}`;
  }

  return "";
};

const successfulPolicyResult = (output: string): PolicyResult => {
  const integrityFailure = policyIntegrityFailure(output);
  if (integrityFailure) {
    return {
      hasViolations: true,
      policyIntegrityFailed: true,
      policyViolations: integrityFailure,
    };
  }

  return { hasViolations: false, policyIntegrityFailed: false, policyViolations: "" };
};

const execErrorOutput = (error: unknown): string => {
  const execError = error as { message?: string; stdout?: string; stderr?: string };
  return (execError.stdout || "") + (execError.stderr || "") || execError.message || "unknown error";
};

const runPolicyTest = (planJson: string, exec: ExecFn): PolicyResult => {
  try {
    const output = exec("conftest", ["test", "--quiet=false", planJson]);
    return successfulPolicyResult(output);
  } catch (error: unknown) {
    return {
      hasViolations: true,
      policyIntegrityFailed: false,
      policyViolations: execErrorOutput(error),
    };
  }
};

const run = ({ planJson }: RunArgs, exec: ExecFn = execCapture): PolicyResult => {
  try {
    exec("conftest", ["pull", POLICY_REPOSITORY]);
  } catch (error: unknown) {
    return {
      hasViolations: true,
      policyIntegrityFailed: true,
      policyViolations: `Policy integrity check failed: conftest pull failed: ${execErrorOutput(error)}`,
    };
  }

  return runPolicyTest(planJson, exec);
};

const enforcePolicyIntegrity = (result: PolicyResult): void => {
  if (result.policyIntegrityFailed) {
    throw new Error(result.policyViolations);
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
  enforcePolicyIntegrity(result);
};

module.exports = Object.assign(main, { run });
