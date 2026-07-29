import type { ExecFn } from "./policy-types";

const fs = require("node:fs");
const { mkdtempSync } = fs;
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { validateNamespaceNames, validateRequiredNamespaces } = require("./policy-namespace.ts");
const { resolvePolicyDataDirectory } = require("./policy-data.ts");
const { hashPolicyTree } = require("./policy-tree.ts");
const { writeIsolatedConfig } = require("./conftest-config.ts");

const POLICY_REPOSITORY = "ssh://git@github.com/pretty-good-software-org/opa-policies.git";
const POLICY_DIRECTORY = "policy";
const POLICY_REF_PATTERN = /^[0-9a-f]{40}$/;

interface PolicySources {
  configFile: string;
  dataDirectory?: string;
  policyDirectory: string;
}

interface PinnedPolicyArgs<Result> {
  evaluatePolicy: (sources: PolicySources) => Result;
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

// Verifies the verified tree is still byte-identical once conftest has run.
// A replacement would mean something reached past the pinning flags.
const verifyPolicyTreeUnchanged = (policyDirectory: string, fetchedDigest: string): void => {
  if (hashPolicyTree(policyDirectory) === fetchedDigest) {
    return;
  }
  throw new Error("Policy integrity check failed: the verified policy tree changed during evaluation");
};

const executePinnedPolicy = <Result>(args: ExecutePinnedPolicyArgs<Result>): Result => {
  fetchPinnedPolicy(args.checkoutRoot, args.policyRef, args.exec);
  verifyFetchedCommit(args.checkoutRoot, args.policyRef, args.exec);
  const policyDirectory = join(args.checkoutRoot, POLICY_DIRECTORY);
  // Digest first, so the strict name check is what touches the tree first. The
  // Namespace scan reads names as text, so an undecodable one reaches it as a
  // Path that does not exist and it dies on ENOENT, hiding the refusal that
  // Names the offending bytes. Same value either way; only the message differs.
  const fetchedDigest = hashPolicyTree(policyDirectory);
  validateRequiredNamespaces(policyDirectory, args.requiredNamespaces);
  const dataDirectory = resolvePolicyDataDirectory(args.checkoutRoot, policyDirectory);
  const configFile = writeIsolatedConfig(args.checkoutRoot);
  const result = args.evaluatePolicy({ configFile, dataDirectory, policyDirectory });
  verifyPolicyTreeUnchanged(policyDirectory, fetchedDigest);
  return result;
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
    fs.rmSync(checkoutRoot, cleanupOptions);
  } catch (error: unknown) {
    throw new Error(`Policy checkout cleanup failed: ${errorMessage(error)}`, { cause: error });
  }
};

const removeCheckoutBestEffort = (checkoutRoot: string): void => {
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
    return executePinnedPolicy(executionArgs);
  } finally {
    removeCheckoutBestEffort(checkoutRoot);
  }
};

module.exports = { withPinnedPolicy };
