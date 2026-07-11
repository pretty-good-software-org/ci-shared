const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { createCompliantRepository, execute, temporaryDirectories } = require("./fixture.ts");

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

const captureCurrentResults = (): Record<string, unknown> =>
  Object.fromEntries(
    scenarios.map((scenario) => {
      const root = createCompliantRepository();
      scenario.configure(root);
      return [scenario.name, execute(currentChecker, root)];
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

  it("keeps the reusable workflow runner and action wiring explicit", () => {
    const workflow = readFileSync(".github/workflows/template-guard.yml", "utf8");
    const expectedSequence = [
      "runs-on: [self-hosted, Linux, ARM64]",
      "uses: actions/checkout@v4",
      "uses: pretty-good-software-org/ci-shared/actions/guard@main",
    ];
    assertWorkflowSequence(workflow, expectedSequence);
  });
});
