import type { ExecFn, PolicyResult } from "./policy-types";

const { withPinnedPolicy } = require("./pinned-policy.ts");
const { evaluatePolicy, execErrorOutput } = require("./policy-result.ts");

interface PolicySources {
  configFile: string;
  dataDirectory?: string;
  policyDirectory: string;
}

interface RunPinnedPolicyArgs {
  exec: ExecFn;
  floorExemptReason: string;
  planJson: string;
  policyRef: string;
  requiredNamespaces: string[];
}

// --data is added only when the pinned checkout ships a data directory.
// An older policy commit without one keeps the exact legacy command.
// The directory is always the immutable checkout's own, never a consumer path.
const dataArguments = (dataDirectory?: string): string[] => {
  if (!dataDirectory) {
    return [];
  }
  return ["--data", dataDirectory];
};

// Every input that decides what conftest evaluates is stated here as a flag.
// Flags outrank the configuration file and CONFTEST_* environment variables alike.
// Conftest has no flag for turning updates off.
// An empty --update is therefore what denies a CONFTEST_UPDATE download.
const commandArguments = (args: RunPinnedPolicyArgs, sources: PolicySources): string[] => {
  const namespaceArguments = args.requiredNamespaces.flatMap((namespace) => ["--namespace", namespace]);
  const data = dataArguments(sources.dataDirectory);
  return [
    "test",
    "--config-file",
    sources.configFile,
    "--policy",
    sources.policyDirectory,
    "--update",
    "",
    ...data,
    ...namespaceArguments,
    // A parser that cannot read the plan turns it into an empty document.
    // Every policy then passes against nothing. The input is the JSON plan.
    "--parser",
    "json",
    // Without this, a run that found violations can still exit zero.
    // A zero exit is read here as a clean policy result.
    "--no-fail=false",
    // Conftest colours its summary even when stdout is not a terminal.
    // The loaded-test count is read back out of that summary.
    // Colour codes sit between the newline and the count, hiding it.
    "--no-color",
    "--quiet=false",
    args.planJson,
  ];
};

const evaluateFetchedPolicy = (args: RunPinnedPolicyArgs, sources: PolicySources): PolicyResult => {
  const argsForConftest = commandArguments(args, sources);
  return evaluatePolicy(argsForConftest, args.exec, args.floorExemptReason);
};

const pinnedPolicyFailure = (error: unknown): string => {
  const output = execErrorOutput(error);
  if (output.startsWith("Policy integrity check failed:")) {
    return output;
  }
  return `Policy integrity check failed: pinned policy preparation failed: ${output}`;
};

const failedPinnedPolicyResult = (args: RunPinnedPolicyArgs, error: unknown): PolicyResult => ({
  floorExemptReason: args.floorExemptReason,
  hasViolations: true,
  policyIntegrityFailed: true,
  policyViolations: pinnedPolicyFailure(error),
});

const runPinnedPolicy = (args: RunPinnedPolicyArgs): PolicyResult => {
  const checkoutArgs = {
    evaluatePolicy: (sources: PolicySources) => evaluateFetchedPolicy(args, sources),
    exec: args.exec,
    policyRef: args.policyRef,
    requiredNamespaces: args.requiredNamespaces,
  };
  try {
    return withPinnedPolicy(checkoutArgs);
  } catch (error: unknown) {
    return failedPinnedPolicyResult(args, error);
  }
};

module.exports = { runPinnedPolicy };
