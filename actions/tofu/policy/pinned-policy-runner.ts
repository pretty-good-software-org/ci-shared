import type { ExecFn, PolicyResult } from "./policy-types";

const { withPinnedPolicy } = require("./pinned-policy.ts");
const { evaluatePolicy, execErrorOutput } = require("./policy-result.ts");

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

const commandArguments = (args: RunPinnedPolicyArgs, policyDirectory: string, dataDirectory?: string): string[] => {
  const namespaceArguments = args.requiredNamespaces.flatMap((namespace) => ["--namespace", namespace]);
  const data = dataArguments(dataDirectory);
  return ["test", "--policy", policyDirectory, ...data, ...namespaceArguments, "--quiet=false", args.planJson];
};

const evaluateFetchedPolicy = (
  args: RunPinnedPolicyArgs,
  policyDirectory: string,
  dataDirectory?: string,
): PolicyResult => {
  const argsForConftest = commandArguments(args, policyDirectory, dataDirectory);
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
    evaluatePolicy: (policyDirectory: string, dataDirectory?: string) =>
      evaluateFetchedPolicy(args, policyDirectory, dataDirectory),
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
