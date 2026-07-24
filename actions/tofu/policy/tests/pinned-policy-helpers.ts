const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { captureOutputs } = require("../../../../lib/test-helpers.ts");

const policy = require("../action.ts");

const POLICY_COMMIT = "1111111111111111111111111111111111111111";
const OTHER_COMMIT = "2222222222222222222222222222222222222222";
const SUCCESS_OUTPUT = "5 tests, 5 passed, 0 warnings, 0 failures";

interface PinnedExecOptions {
  fetchedCommit?: string;
  packages?: string[];
}

const writePolicySource = (checkoutRoot: string, packages: string[]): void => {
  const policyDirectory = join(checkoutRoot, "policy");
  mkdirSync(policyDirectory, { recursive: true });
  packages.forEach((packageName, index) => {
    writeFileSync(join(policyDirectory, `policy-${index}.rego`), `package ${packageName}\n`, "utf8");
  });
};

const isGitInit = (bin: string, args: string[]): boolean => bin === "git" && args[0] === "init";
const isGitRevisionCheck = (bin: string, args: string[]): boolean => bin === "git" && args.includes("rev-parse");

const pinnedExec = ({ fetchedCommit = POLICY_COMMIT, packages = ["policies.s3"] }: PinnedExecOptions = {}) => {
  const commands: string[] = [];
  let checkoutRoot = "";

  const exec = (bin: string, args: string[]): string => {
    commands.push([bin, ...args].join(" "));
    if (isGitInit(bin, args)) {
      checkoutRoot = args.at(-1) || "";
      writePolicySource(checkoutRoot, packages);
      return "";
    }
    if (isGitRevisionCheck(bin, args)) {
      return `${fetchedCommit}\n`;
    }
    if (bin === "conftest") {
      return SUCCESS_OUTPUT;
    }
    return "";
  };

  return { commands, exec, getCheckoutRoot: () => checkoutRoot };
};

const runPinnedAction = (
  policyRef: string,
  requiredNamespaces: string,
  exec: (bin: string, args: string[]) => string,
) => {
  const { outputs, writeOutput } = captureOutputs();
  const env = {
    INPUT_PLAN_JSON: "tofu/plan.json",
    INPUT_POLICY_REF: policyRef,
    INPUT_REQUIRED_NAMESPACES: requiredNamespaces,
  };
  const action = policy({ env, exec, writeOutput });
  return { action, outputs };
};

module.exports = { OTHER_COMMIT, POLICY_COMMIT, pinnedExec, runPinnedAction };
