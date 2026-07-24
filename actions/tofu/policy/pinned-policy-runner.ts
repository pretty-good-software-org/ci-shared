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

const commandArguments = (args: RunPinnedPolicyArgs, policyDirectory: string): string[] => {
  const namespaceArguments = args.requiredNamespaces.flatMap((namespace) => ["--namespace", namespace]);
  return ["test", "--policy", policyDirectory, ...namespaceArguments, "--quiet=false", args.planJson];
};

const evaluateFetchedPolicy = (args: RunPinnedPolicyArgs, policyDirectory: string): PolicyResult => {
  const argsForConftest = commandArguments(args, policyDirectory);
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
    evaluatePolicy: (policyDirectory: string) => evaluateFetchedPolicy(args, policyDirectory),
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
