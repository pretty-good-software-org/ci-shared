// Resolves the canonical policy/data directory inside the pinned checkout.
// Conftest does not auto-load data from --policy or the working directory.
// The pinned runner must therefore pass this directory explicitly with --data.
// Only the immutable checkout's own directory is used, never a consumer path.
// The path is guarded against symlink and traversal escapes below.

const fs = require("node:fs");
const { isAbsolute, join, relative } = require("node:path");

const POLICY_DATA_DIRECTORY = "data";

const integrityError = (message: string): Error => new Error(`Policy integrity check failed: ${message}`);

// True when the resolved data path is a strict descendant of the checkout root.
// Equal paths and any escaping path (starting with "..", or absolute) fail.
const isWithinRoot = (realRoot: string, realData: string): boolean => {
  const rel = relative(realRoot, realData);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

// Validates the candidate's real, symlink-resolved location.
// It must be a directory strictly inside the checkout root.
// Any escape or non-directory throws a policy-integrity error.
const assertDataDirectoryContained = (checkoutRoot: string, candidate: string): void => {
  const realRoot = fs.realpathSync(checkoutRoot);
  const realData = fs.realpathSync(candidate);
  if (!isWithinRoot(realRoot, realData)) {
    throw integrityError("policy data directory resolves outside the policy checkout");
  }
  if (!fs.statSync(realData).isDirectory()) {
    throw integrityError("policy data path is not a directory");
  }
};

// Returns the checkout-relative policy/data path to pass to --data.
// Returns undefined when the checkout ships no data directory.
// That covers older pinned commits and stays backward compatible.
// The returned path is the plain join path, matching the --policy argument.
const resolvePolicyDataDirectory = (checkoutRoot: string, policyDirectory: string): string | undefined => {
  const candidate = join(policyDirectory, POLICY_DATA_DIRECTORY);
  if (!fs.existsSync(candidate)) {
    return undefined;
  }
  assertDataDirectoryContained(checkoutRoot, candidate);
  return candidate;
};

module.exports = { resolvePolicyDataDirectory };
