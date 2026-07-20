const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { createCompliantRepository, execute, temporaryDirectories } = require("./fixture.ts");

interface ExecutionResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

interface Scenario {
  configure: (root: string) => void;
  name: string;
}

const { scenarios }: { scenarios: Scenario[] } = require("./scenarios.ts");

const actionRoot = resolve("actions/guard");
const currentChecker = join(actionRoot, "guard.sh");
const referenceChecker = join(actionRoot, "tests/reference/mise-tasks/guard/default");
const goldenPath = join(actionRoot, "tests/golden/parity.json");
const jsonIndent = 2;
const gnuAwkWarningPrefix = "awk: cmd. line:10: warning: regexp escape sequence";
const gnuAwkWarningSuffix = "is not a known regexp operator";

const normalizeGoldenResult = (result: ExecutionResult): ExecutionResult => {
  const stderrLines = result.stderr.split("\n");
  const portableStderr = stderrLines
    .filter((line) => !(line.startsWith(gnuAwkWarningPrefix) && line.endsWith(gnuAwkWarningSuffix)))
    .join("\n");
  return { ...result, stderr: portableStderr };
};

const captureCurrentResults = (): Record<string, ExecutionResult> =>
  Object.fromEntries(
    scenarios.map((scenario) => {
      const root = createCompliantRepository();
      scenario.configure(root);
      const result = execute(currentChecker, root);
      return [scenario.name, normalizeGoldenResult(result)];
    }),
  );

const assertWorkflowSequence = (workflow: string, expectedSequence: string[]): void => {
  let previousIndex = -1;
  for (const value of expectedSequence) {
    const index = workflow.indexOf(value);
    assert.ok(index > previousIndex, `${value} must appear in workflow order`);
    previousIndex = index;
  }
};

const assertLintTaskOrdersReadOnlyBeforeFormatter = (): void => {
  const lintTask = readFileSync("mise-tasks/lint/_default", "utf8");
  const readOnlyLintTasks =
    "mise run lint:actions ::: lint:yaml ::: lint:markdown ::: lint:ts ::: lint:typecheck ::: lint:format:check";
  const readOnlyIndex = lintTask.indexOf(readOnlyLintTasks);
  const formatterCheckIndex = lintTask.indexOf("mise run check:markdown-format");
  assert.notEqual(readOnlyIndex, -1, "lint task must run all read-only linters concurrently");
  assert.ok(
    formatterCheckIndex > readOnlyIndex,
    "lint task must run the formatter check after read-only linters complete",
  );
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("template guard checker parity", () => {
  it("matches the base-template checker byte-for-byte for every parity scenario", () => {
    for (const scenario of scenarios) {
      const root = createCompliantRepository();
      scenario.configure(root);
      const expected = execute(referenceChecker, root);
      const actual = execute(currentChecker, root);
      assert.deepStrictEqual(actual, expected, `${scenario.name} diverged from the base-template checker`);
    }
  });

  it("matches the reviewed full-output golden file", () => {
    const actual = `${JSON.stringify(captureCurrentResults(), undefined, jsonIndent)}\n`;
    const expected = readFileSync(goldenPath, "utf8");
    assert.strictEqual(actual, expected, "guard output must match the reviewed parity golden file");
  });
});

describe("template guard action wiring", () => {
  it("runs the checker bundled beside the composite action", () => {
    const action = readFileSync(join(actionRoot, "action.yml"), "utf8");
    assert.match(action, /run: bash "\$\{GITHUB_ACTION_PATH\}\/guard\.sh"/);
    assert.doesNotMatch(action, /\.\.\/\.\.\//);
  });

  it("keeps workflow wiring explicit and orders read-only lint before formatting", () => {
    const workflow = readFileSync(".github/workflows/template-guard.yml", "utf8");
    const expectedSequence = [
      "runs-on: ubuntu-24.04-arm",
      "uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5",
      "uses: pretty-good-software-org/ci-shared/actions/guard@",
    ];
    assertWorkflowSequence(workflow, expectedSequence);
    assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}\b/);
    // Supply-chain: the guard action must be pinned to an immutable commit SHA.
    // Never a mutable ref such as @main.
    assert.match(workflow, /uses: pretty-good-software-org\/ci-shared\/actions\/guard@[0-9a-f]{40}\b/);

    assertLintTaskOrdersReadOnlyBeforeFormatter();
  });
});
