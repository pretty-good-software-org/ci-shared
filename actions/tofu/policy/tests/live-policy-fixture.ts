// Fixtures for the live conftest regressions.
// A hostile consumer checkout is paired with a five-package policy tree.
// Five packages matter because the loaded-test floor is five.
// A substituted tree then reports a clean pass instead of tripping that floor.

const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const REQUIRED_NAMESPACES = ["policies.s3", "policies.iam", "policies.kms", "policies.ec2", "policies.rds"];
const PINNED_DENIAL = "PINNED-S3-DENIAL";
const SUBSTITUTE_MARKER = "SUBSTITUTE-POLICY";
const CHECKED_IN_MARKER = "CHECKED-IN-POLICY";

interface Fixture {
  checkout: string;
  directorySource: string;
  gitSource: string;
  root: string;
}

const denyRule = (namespace: string, message: string): string =>
  `package ${namespace}\n\ndeny contains msg if {\n\tinput.public == true\n\tmsg := "${message}"\n}\n`;

const silentRule = (namespace: string, marker: string): string =>
  `package ${namespace}\n\nwarn contains msg if {\n\tinput.never == true\n\tmsg := "${marker}"\n}\n`;

const ruleFor = (namespace: string, denial: string, marker: string): string => {
  if (namespace === REQUIRED_NAMESPACES[0] && denial) {
    return denyRule(namespace, denial);
  }
  return silentRule(namespace, marker);
};

// Writes every required package so a tree always satisfies the namespace contract.
// Only a tree given a denial message rejects the plan.
const writePolicyTree = (directory: string, denial: string, marker: string): void => {
  mkdirSync(directory, { recursive: true });
  REQUIRED_NAMESPACES.forEach((namespace: string) => {
    writeFileSync(join(directory, `${namespace}.rego`), ruleFor(namespace, denial, marker), "utf8");
  });
};

const git = (args: string[], cwd: string): void => {
  const identity = ["-c", "user.email=ci@example.com", "-c", "user.name=ci"];
  execFileSync("git", [...identity, ...args], { cwd, stdio: "pipe" });
};

// A local repository with no tag or pinned commit, standing in for a floating remote.
const createGitSource = (root: string): string => {
  const source = join(root, "substitute-repo");
  writePolicyTree(join(source, "policy"), "", SUBSTITUTE_MARKER);
  git(["init", "--quiet", "."], source);
  git(["add", "."], source);
  git(["commit", "--quiet", "-m", "substitute policy"], source);
  return source;
};

const createFixture = (conftestConfig: string): Fixture => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-live-policy-"));
  const directorySource = join(root, "substitute-directory");
  writePolicyTree(join(directorySource, "policy"), "", SUBSTITUTE_MARKER);

  const checkout = join(root, "checkout");
  mkdirSync(checkout);
  writeFileSync(join(checkout, "plan.json"), JSON.stringify({ public: true }), "utf8");
  writeFileSync(join(checkout, "conftest.toml"), conftestConfig, "utf8");
  // Conftest falls back to a `policy` directory in the working directory.
  // A checked-in one must never be what the action evaluates.
  writePolicyTree(join(checkout, "policy"), "", CHECKED_IN_MARKER);
  writePolicyTree(join(checkout, "checked-in-policy"), "", CHECKED_IN_MARKER);

  return { checkout, directorySource, gitSource: createGitSource(root), root };
};

// Installs the verified policy source the stubbed git fetch would have produced.
// A silent tree covers the clean-run cases, where nothing denies the plan.
const installVerifiedPolicy = (checkoutRoot: string, silent = false): void => {
  if (silent) {
    writePolicyTree(join(checkoutRoot, "policy"), "", "verified-silent");
    return;
  }
  writePolicyTree(join(checkoutRoot, "policy"), PINNED_DENIAL, "verified");
};

const removeFixture = (fixture: Fixture): void => {
  rmSync(fixture.root, { force: true, recursive: true });
};

// Rewrites the consumer configuration once the fixture's paths are known.
// Update sources have to name a path that only exists after the fixture is built.
const setConsumerConfig = (fixture: Fixture, conftestConfig: string): void => {
  writeFileSync(join(fixture.checkout, "conftest.toml"), conftestConfig, "utf8");
};

const withLiveFixture = async (
  conftestConfig: string,
  assertion: (fixture: Fixture) => Promise<void>,
): Promise<void> => {
  const fixture = createFixture(conftestConfig);
  try {
    await assertion(fixture);
  } finally {
    removeFixture(fixture);
  }
};

module.exports = {
  CHECKED_IN_MARKER,
  PINNED_DENIAL,
  REQUIRED_NAMESPACES,
  SUBSTITUTE_MARKER,
  installVerifiedPolicy,
  setConsumerConfig,
  withLiveFixture,
};
