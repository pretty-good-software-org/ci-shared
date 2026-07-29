// Drives the real action against the real conftest binary.
// Only git is stubbed: the fetch and commit verification have their own tests.
// This seam is about what conftest does once the policy is on disk.
// Conftest runs with the hostile checkout as its working directory.
// That is exactly how it runs on a runner.

const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { captureOutputs } = require("../../../../lib/test-helpers.ts");
const { REQUIRED_NAMESPACES, installVerifiedPolicy } = require("./live-policy-fixture.ts");

const policy = require("../action.ts");

const POLICY_COMMIT = "1111111111111111111111111111111111111111";

interface Fixture {
  checkout: string;
  root: string;
}

interface LiveOptions {
  // Reaches conftest only, standing in for a variable that got past the boundary.
  childOnlyEnv?: NodeJS.ProcessEnv;
  // Inherited by the action and by conftest, which is how a runner supplies one.
  env?: Record<string, string>;
  silentPolicy?: boolean;
  transform?: (args: string[]) => string[];
}

// Strips one guard from the argument vector just before conftest runs.
// Controls built this way keep every other guard, so they cannot pass by accident.
const dropFlag = (flag: string) => (args: string[]) => {
  const flagIndex = args.indexOf(flag);
  const afterValue = 2;
  return [...args.slice(0, flagIndex), ...args.slice(flagIndex + afterValue)];
};

const withoutConfigIsolation = dropFlag("--config-file");
const withoutUpdatePin = dropFlag("--update");
const withoutColorPin = (args: string[]): string[] => args.filter((arg: string) => arg !== "--no-color");
const withoutParserPin = dropFlag("--parser");
const withoutNoFailPin = (args: string[]): string[] => args.filter((arg: string) => arg !== "--no-fail=false");
const withoutCombinePin = (args: string[]): string[] => args.filter((arg: string) => arg !== "--combine=false");

// Reproduces the invocation as it stood before this pin.
// The consumer configuration file is read and nothing states that updates are off.
const withoutPinning = (args: string[]): string[] => withoutUpdatePin(withoutConfigIsolation(args));

const childEnvironment = (options: LiveOptions): NodeJS.ProcessEnv => {
  if (options.childOnlyEnv) {
    return options.childOnlyEnv;
  }
  return { ...process.env, ...options.env };
};

const runConftest = (args: string[], fixture: Fixture, options: LiveOptions): string => {
  const transform = options.transform || ((given: string[]) => given);
  const env = childEnvironment(options);
  return execFileSync("conftest", transform(args), {
    cwd: fixture.checkout,
    encoding: "utf8",
    env,
    stdio: "pipe",
  });
};

const isGitInit = (bin: string, args: string[]): boolean => bin === "git" && args[0] === "init";

// Answers the git calls the pinned checkout makes, without touching a network.
const stubbedGit = (args: string[]): string => {
  if (args.includes("rev-parse")) {
    return `${POLICY_COMMIT}\n`;
  }
  return "";
};

const liveExec = (fixture: Fixture, options: LiveOptions) => {
  let checkoutRoot = "";
  const exec = (bin: string, args: string[]): string => {
    if (isGitInit(bin, args)) {
      checkoutRoot = args.at(-1) || "";
      installVerifiedPolicy(checkoutRoot, options.silentPolicy);
      return "";
    }
    if (bin === "git") {
      return stubbedGit(args);
    }
    return runConftest(args, fixture, options);
  };
  return { exec, getCheckoutRoot: () => checkoutRoot };
};

// Runs the action end to end and reports its outputs plus the verified tree it used.
const runLivePolicy = async (fixture: Fixture, options: LiveOptions = {}) => {
  const { exec, getCheckoutRoot } = liveExec(fixture, options);
  const { outputs, writeOutput } = captureOutputs();
  const env = {
    INPUT_PLAN_JSON: "plan.json",
    INPUT_POLICY_REF: POLICY_COMMIT,
    INPUT_REQUIRED_NAMESPACES: REQUIRED_NAMESPACES.join("\n"),
    ...options.env,
  };
  const args = { cwd: fixture.checkout, env, exec, logWarning: () => {}, writeOutput };
  const rejection = await policy(args).then(
    () => "",
    (error: Error) => error.message,
  );
  return { getCheckoutRoot, outputs, rejection };
};

// Reads what the checked-in policy directory holds after a run.
const checkedInPolicyText = (fixture: Fixture): string =>
  readFileSync(join(fixture.checkout, "policy", "policies.s3.rego"), "utf8");

module.exports = {
  POLICY_COMMIT,
  checkedInPolicyText,
  runLivePolicy,
  withoutColorPin,
  withoutCombinePin,
  withoutConfigIsolation,
  withoutNoFailPin,
  withoutParserPin,
  withoutPinning,
  withoutUpdatePin,
};
