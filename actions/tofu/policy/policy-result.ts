import type { ExecFn, PolicyResult } from "./policy-types";

const MINIMUM_POLICY_TESTS = 5;
const POLICY_SUMMARY_PATTERN = /(?:^|\n)\s*(\d+) tests?,/;

const policyIntegrityFailure = (output: string, floorExemptReason: string): string => {
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

const successfulPolicyResult = (output: string, floorExemptReason: string): PolicyResult => {
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

const evaluatePolicy = (args: string[], exec: ExecFn, floorExemptReason: string): PolicyResult => {
  try {
    const output = exec("conftest", args);
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

module.exports = { evaluatePolicy, execErrorOutput };
