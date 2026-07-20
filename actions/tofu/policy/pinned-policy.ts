import type { ExecFn } from "./policy-types";

const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { validateNamespaceNames, validateRequiredNamespaces } = require("./policy-namespace.ts");

const POLICY_REPOSITORY = "ssh://git@github.com/pretty-good-software-org/opa-policies.git";
const POLICY_DIRECTORY = "policy";
const POLICY_REF_PATTERN = /^[0-9a-f]{40}$/;

interface PinnedPolicyArgs<Result> {
  evaluatePolicy: (policyDirectory: string) => Result;
  exec: ExecFn;
  policyRef: string;
  requiredNamespaces: string[];
}

interface ExecutePinnedPolicyArgs<Result> extends PinnedPolicyArgs<Result> {
  checkoutRoot: string;
}

const validatePolicyRefPresence = (policyRef: string): void => {
  if (!policyRef) {
    throw new Error("Policy integrity check failed: policy-ref is required when required-namespaces is set");
  }
};

const validateNamespaceContractPresence = (requiredNamespaces: string[]): void => {
  if (requiredNamespaces.length === 0) {
    throw new Error("Policy integrity check failed: required-namespaces is required when policy-ref is set");
  }
};

const validatePolicyRefFormat = (policyRef: string): void => {
  if (!POLICY_REF_PATTERN.test(policyRef)) {
    throw new Error("Policy integrity check failed: policy-ref must be a lowercase 40-character commit SHA");
  }
};

const validatePinnedPolicyInputs = (policyRef: string, requiredNamespaces: string[]): void => {
  validatePolicyRefPresence(policyRef);
  validateNamespaceContractPresence(requiredNamespaces);
  validatePolicyRefFormat(policyRef);
  validateNamespaceNames(requiredNamespaces);
};

const fetchPinnedPolicy = (checkoutRoot: string, policyRef: string, exec: ExecFn): void => {
  const initializeArguments = ["init", "--quiet", checkoutRoot];
  exec("git", initializeArguments);
  const remoteArguments = ["-C", checkoutRoot, "remote", "add", "origin", POLICY_REPOSITORY];
  exec("git", remoteArguments);
  const fetchArguments = ["-C", checkoutRoot, "fetch", "--quiet", "--depth=1", "origin", policyRef];
  exec("git", fetchArguments);
  const checkoutArguments = ["-C", checkoutRoot, "checkout", "--quiet", "--detach", "FETCH_HEAD"];
  exec("git", checkoutArguments);
};

const verifyFetchedCommit = (checkoutRoot: string, policyRef: string, exec: ExecFn): void => {
  const commandArguments = ["-C", checkoutRoot, "rev-parse", "--verify", "HEAD"];
  const fetchedCommit = exec("git", commandArguments).trim();
  if (fetchedCommit !== policyRef) {
    throw new Error("Policy integrity check failed: fetched policy commit does not match policy-ref");
  }
};

const executePinnedPolicy = <Result>(args: ExecutePinnedPolicyArgs<Result>): Result => {
  fetchPinnedPolicy(args.checkoutRoot, args.policyRef, args.exec);
  verifyFetchedCommit(args.checkoutRoot, args.policyRef, args.exec);
  const policyDirectory = join(args.checkoutRoot, POLICY_DIRECTORY);
  validateRequiredNamespaces(policyDirectory, args.requiredNamespaces);
  return args.evaluatePolicy(policyDirectory);
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || "unknown error");
};

const removeCheckout = (checkoutRoot: string): void => {
  try {
    const cleanupOptions = { force: true, recursive: true };
    rmSync(checkoutRoot, cleanupOptions);
  } catch (error: unknown) {
    throw new Error(`Policy checkout cleanup failed: ${errorMessage(error)}`, { cause: error });
  }
};

const removeCheckoutAfterFailure = (checkoutRoot: string): void => {
  try {
    removeCheckout(checkoutRoot);
  } catch (error: unknown) {
    console.error(errorMessage(error));
  }
};

const withPinnedPolicy = <Result>(args: PinnedPolicyArgs<Result>): Result => {
  validatePinnedPolicyInputs(args.policyRef, args.requiredNamespaces);
  const checkoutRoot = mkdtempSync(join(tmpdir(), "ci-shared-opa-policies-"));
  const executionArgs = { ...args, checkoutRoot };
  try {
    const result = executePinnedPolicy(executionArgs);
    removeCheckout(checkoutRoot);
    return result;
  } catch (error: unknown) {
    removeCheckoutAfterFailure(checkoutRoot);
    throw error;
  }
};

module.exports = { withPinnedPolicy };
