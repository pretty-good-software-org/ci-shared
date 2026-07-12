// Run Conftest policy checks against an OpenTofu plan.
//
// 1. Runs conftest test against the JSON plan file
// 2. Sets has_violations and policy_violations outputs

const { execCapture } = require("../../../lib/exec.ts");
const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { findFloorExemptReason, validateConftestIntegrity } = require("./conftest-integrity.ts");

interface RunArgs {
  planJson: string;
  cwd?: string;
}

interface PolicyResult {
  floorExemptReason: string;
  hasViolations: boolean;
  policyViolations: string;
  policyIntegrityFailed: boolean;
}

type ExecFn = typeof execCapture;

const MINIMUM_POLICY_TESTS = 5;
const POLICY_REPOSITORY = "git::ssh://git@github.com/pretty-good-software-org/opa-policies.git//policy";
const POLICY_SUMMARY_PATTERN = /(?:^|\n)\s*(\d+) tests?,/;

const policyIntegrityFailure = (output: string, floorExemptReason = ""): string => {
  const summary = output.match(POLICY_SUMMARY_PATTERN);
  if (!summary) {
    return "Policy integrity check failed: conftest did not report a loaded-test count; refusing to trust the policy result";
  }

  const loadedTestCount = Number(summary[1]);
  if (!floorExemptReason && loadedTestCount < MINIMUM_POLICY_TESTS) {
    return `Policy integrity check failed: conftest loaded ${loadedTestCount} tests; require at least ${MINIMUM_POLICY_TESTS}`;
  }

  return "";
};

const successfulPolicyResult = (output: string, floorExemptReason = ""): PolicyResult => {
  const integrityFailure = policyIntegrityFailure(output, floorExemptReason);
  if (integrityFailure) {
    return {
      floorExemptReason,
      hasViolations: true,
      policyIntegrityFailed: true,
      policyViolations: integrityFailure,
    };
  }

  return {
    floorExemptReason,
    hasViolations: false,
    policyIntegrityFailed: false,
    policyViolations: "",
  };
};

const execErrorOutput = (error: unknown): string => {
  const execError = error as { message?: string; stdout?: string; stderr?: string };
  return (execError.stdout || "") + (execError.stderr || "") || execError.message || "unknown error";
};

const runPolicyTest = (planJson: string, exec: ExecFn, floorExemptReason = ""): PolicyResult => {
  try {
    const output = exec("conftest", ["test", "--quiet=false", planJson]);
    return successfulPolicyResult(output, floorExemptReason);
  } catch (error: unknown) {
    return {
      floorExemptReason,
      hasViolations: true,
      policyIntegrityFailed: false,
      policyViolations: execErrorOutput(error),
    };
  }
};

const run = ({ planJson, cwd = process.cwd() }: RunArgs, exec: ExecFn = execCapture): PolicyResult => {
  const configIntegrityFailure = validateConftestIntegrity(cwd);
  if (configIntegrityFailure) {
    return {
      floorExemptReason: "",
      hasViolations: true,
      policyIntegrityFailed: true,
      policyViolations: configIntegrityFailure,
    };
  }

  const floorExemptReason = findFloorExemptReason(cwd);

  try {
    exec("conftest", ["pull", POLICY_REPOSITORY]);
  } catch (error: unknown) {
    return {
      floorExemptReason,
      hasViolations: true,
      policyIntegrityFailed: true,
      policyViolations: `Policy integrity check failed: conftest pull failed: ${execErrorOutput(error)}`,
    };
  }

  return runPolicyTest(planJson, exec, floorExemptReason);
};

const enforcePolicyIntegrity = (result: PolicyResult): void => {
  if (result.policyIntegrityFailed) {
    throw new Error(result.policyViolations);
  }
};

const resolveWarningLogger = (logWarning?: (message: string) => void): ((message: string) => void) =>
  logWarning || console.warn;

const logFloorExemption = (reason: string, logWarning: (message: string) => void): void => {
  if (reason) {
    logWarning(`POLICY FLOOR EXEMPTION ACTIVE: ${reason}`);
  }
};

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  logWarning?: (message: string) => void;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const { env = process.env, exec = execCapture } = args;
  const planJson = env.INPUT_PLAN_JSON || "tofu/plan.json";
  const result = run({ cwd: args.cwd, planJson }, exec);

  logFloorExemption(result.floorExemptReason, resolveWarningLogger(args.logWarning));

  const setOutput = resolveOutputWriter(args);
  setOutput("has_violations", String(result.hasViolations));
  setOutput("policy_violations", result.policyViolations);
  enforcePolicyIntegrity(result);
};

module.exports = Object.assign(main, { run });
