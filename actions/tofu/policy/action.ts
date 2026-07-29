// Run Conftest policy checks against an OpenTofu plan.

import type { ExecFn, PolicyResult } from "./policy-types";

const { execCapture } = require("../../../lib/exec.ts");
const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { findFloorExemptReason, validateConftestIntegrity } = require("./conftest-integrity.ts");
const { conftestEnvironmentFailure } = require("./policy-environment.ts");
const { parseRequiredNamespaces } = require("./policy-namespace.ts");
const { runPinnedPolicy } = require("./pinned-policy-runner.ts");
const { evaluatePolicy, execErrorOutput } = require("./policy-result.ts");

interface RunArgs {
  planJson: string;
  cwd?: string;
}

interface PolicyConfiguration {
  floorExemptReason: string;
  integrityFailure: string;
}

interface PolicyInputs {
  planJson: string;
  policyRef: string;
  requiredNamespaces: string[];
}

const POLICY_REPOSITORY = "git::ssh://git@github.com/pretty-good-software-org/opa-policies.git//policy";

const inspectPolicyConfiguration = (cwd: string): PolicyConfiguration => {
  const integrityFailure = validateConftestIntegrity(cwd);
  if (integrityFailure) {
    return { floorExemptReason: "", integrityFailure };
  }
  return { floorExemptReason: findFloorExemptReason(cwd), integrityFailure: "" };
};

const configurationFailureResult = (configuration: PolicyConfiguration): PolicyResult => ({
  floorExemptReason: configuration.floorExemptReason,
  hasViolations: true,
  policyIntegrityFailed: true,
  policyViolations: configuration.integrityFailure,
});

const run = ({ planJson, cwd = process.cwd() }: RunArgs, exec: ExecFn = execCapture): PolicyResult => {
  const configuration = inspectPolicyConfiguration(cwd);
  if (configuration.integrityFailure) {
    return configurationFailureResult(configuration);
  }

  try {
    const commandArguments = ["pull", POLICY_REPOSITORY];
    exec("conftest", commandArguments);
  } catch (error: unknown) {
    return {
      floorExemptReason: configuration.floorExemptReason,
      hasViolations: true,
      policyIntegrityFailed: true,
      policyViolations: `Policy integrity check failed: conftest pull failed: ${execErrorOutput(error)}`,
    };
  }

  // Conftest colours its summary even when stdout is not a terminal.
  // Colour codes hide the loaded-test count this action reads back.
  // Without this flag a clean unpinned run fails as an unreadable count.
  const commandArguments = ["test", "--no-color", "--quiet=false", planJson];
  return evaluatePolicy(commandArguments, exec, configuration.floorExemptReason);
};

const runPinned = (inputs: PolicyInputs, cwd: string | undefined, exec: ExecFn): PolicyResult => {
  const configuration = inspectPolicyConfiguration(cwd || process.cwd());
  if (configuration.integrityFailure) {
    return configurationFailureResult(configuration);
  }

  const pinnedPolicyArgs = {
    exec,
    floorExemptReason: configuration.floorExemptReason,
    planJson: inputs.planJson,
    policyRef: inputs.policyRef,
    requiredNamespaces: inputs.requiredNamespaces,
  };
  return runPinnedPolicy(pinnedPolicyArgs);
};

const resolvePolicyInputs = (env: NodeJS.ProcessEnv): PolicyInputs => ({
  planJson: env.INPUT_PLAN_JSON || "tofu/plan.json",
  policyRef: (env.INPUT_POLICY_REF || "").trim(),
  requiredNamespaces: parseRequiredNamespaces(env.INPUT_REQUIRED_NAMESPACES || ""),
});

const runRequestedPolicy = (inputs: PolicyInputs, cwd: string | undefined, exec: ExecFn): PolicyResult => {
  if (!inputs.policyRef && inputs.requiredNamespaces.length === 0) {
    const runArgs = { cwd, planJson: inputs.planJson };
    return run(runArgs, exec);
  }
  return runPinned(inputs, cwd, exec);
};

// Conftest settings in the environment outrank the isolated configuration file.
// The run therefore stops before any policy is fetched or evaluated.
const evaluateRequest = (args: MainArgs, env: NodeJS.ProcessEnv, exec: ExecFn): PolicyResult => {
  const environmentFailure = conftestEnvironmentFailure(env);
  if (environmentFailure) {
    const configuration = { floorExemptReason: "", integrityFailure: environmentFailure };
    return configurationFailureResult(configuration);
  }

  const policyInputs = resolvePolicyInputs(env);
  return runRequestedPolicy(policyInputs, args.cwd, exec);
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
  const result = evaluateRequest(args, env, exec);
  logFloorExemption(result.floorExemptReason, resolveWarningLogger(args.logWarning));

  const setOutput = resolveOutputWriter(args);
  setOutput("has_violations", String(result.hasViolations));
  setOutput("policy_violations", result.policyViolations);
  enforcePolicyIntegrity(result);
};

module.exports = Object.assign(main, { run });
