const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const assert = require("node:assert");

const ACTION_PATH = resolve("actions/tofu/policy/action.yml");
const AUTH_HEADER_KEY = "http.https://github.com/.extraheader";
const CONFIGURE_STEP_NAME = "    - name: Configure git for cross-repo policy fetching";
const RUN_BLOCK_START = "      run: |";
const SCRIPT_INDENT = "        ";

interface AuthResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

export interface AuthFixture {
  addGlobalHeader: (value: string) => void;
  addLocalHeader: (value: string) => void;
  globalHeaders: () => string[];
  run: (appToken: string) => AuthResult;
}

const findRunIndex = (lines: string[], stepIndex: number): number => {
  const runIndex = lines.findIndex((line: string, index: number) => index > stepIndex && line === RUN_BLOCK_START);
  assert.notStrictEqual(runIndex, -1, "the git authentication step should contain a shell script");
  return runIndex;
};

const extractScriptLines = (lines: string[], runIndex: number): string[] => {
  const scriptLines: string[] = [];
  for (const line of lines.slice(runIndex + 1)) {
    if (line.startsWith("    - ")) {
      break;
    }
    assert.ok(
      line === "" || line.startsWith(SCRIPT_INDENT),
      "every git authentication script line should use the YAML block indentation",
    );
    scriptLines.push(line.slice(SCRIPT_INDENT.length));
  }
  return scriptLines;
};

const extractConfigureScript = (): string => {
  const lines = readFileSync(ACTION_PATH, "utf8").split("\n");
  const stepIndex = lines.indexOf(CONFIGURE_STEP_NAME);
  assert.notStrictEqual(stepIndex, -1, "the policy action should contain the git authentication step");
  const runIndex = findRunIndex(lines, stepIndex);
  return extractScriptLines(lines, runIndex).join("\n");
};

const CONFIGURE_SCRIPT = extractConfigureScript();

const parseNullDelimitedValues = (output: string): string[] => {
  if (!output) {
    return [];
  }
  assert.ok(output.endsWith("\0"), "git config should terminate every value with NUL");
  return output.slice(0, -1).split("\0");
};

const addGlobalHeader = (globalConfig: string, value: string): void => {
  const args = ["config", "--file", globalConfig, "--add", AUTH_HEADER_KEY, value];
  execFileSync("git", args, { stdio: "pipe" });
};

const addLocalHeader = (repository: string, value: string): void => {
  const args = ["config", "--local", "--add", AUTH_HEADER_KEY, value];
  execFileSync("git", args, { cwd: repository, stdio: "pipe" });
};

const globalHeaders = (globalConfig: string): string[] => {
  try {
    const args = ["config", "--file", globalConfig, "--null", "--get-all", AUTH_HEADER_KEY];
    const output = execFileSync("git", args, { encoding: "utf8", stdio: "pipe" });
    return parseNullDelimitedValues(output);
  } catch (error: unknown) {
    const exitCode = (error as { status?: number }).status;
    assert.strictEqual(exitCode, 1, "reading an absent global header should be the only accepted git failure");
    return [];
  }
};

const runConfigureScript = (repository: string, globalConfig: string, appToken: string): AuthResult => {
  const environment = {
    ...process.env,
    APP_TOKEN: appToken,
    GIT_CONFIG_GLOBAL: globalConfig,
  };
  const commandArguments = ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", CONFIGURE_SCRIPT];
  const options = { cwd: repository, encoding: "utf8", env: environment };
  return spawnSync("bash", commandArguments, options);
};

const createFixture = (repository: string, globalConfig: string): AuthFixture => ({
  addGlobalHeader: (value: string) => addGlobalHeader(globalConfig, value),
  addLocalHeader: (value: string) => addLocalHeader(repository, value),
  globalHeaders: () => globalHeaders(globalConfig),
  run: (appToken: string) => runConfigureScript(repository, globalConfig, appToken),
});

const withAuthFixture = (assertion: (fixture: AuthFixture) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-policy-auth-"));
  const repository = join(root, "repository");
  const globalConfig = join(root, "global-gitconfig");
  mkdirSync(repository);
  execFileSync("git", ["init", "--quiet"], { cwd: repository, stdio: "pipe" });
  try {
    assertion(createFixture(repository, globalConfig));
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

module.exports = { withAuthFixture };
