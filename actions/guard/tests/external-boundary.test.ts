const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { createCompliantRepository, execute, temporaryDirectories } = require("./fixture.ts");

const actionRoot = resolve("actions/guard");
const currentChecker = join(actionRoot, "guard.sh");
const mutationMode = 0o755;
const markdownToolArtifacts = [
  ".markdownlint-cli2.jsonc",
  ".markdownlint-cli2.yaml",
  ".markdownlint-cli2.yml",
  ".markdownlint.json",
  ".markdownlint.yaml",
  ".markdownlint.yml",
  "mise-tasks/lint/markdownlint",
  ".rumdl.toml",
  "mise-tasks/lint/rumdl",
];
const currentDependency = "  grep -Eq '^#MISE[[:space:]]+depends=.*lint:yamllint' \"$task\"";
const legacyDependency = "  grep -Eq '^#MISE[[:space:]]+depends=.*lint:markdownlint' \"$task\" || return 1";

const createMutationDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "ci-shared-guard-mutation-"));
  temporaryDirectories.push(directory);
  return directory;
};

const buildLegacyCheckerSource = (source: string): string => {
  const markerCount = source.split(currentDependency).length - 1;
  assert.strictEqual(markerCount, 1, "the current dependency check must provide one mutation marker");
  return source.replace(currentDependency, `${currentDependency}\n${legacyDependency}`);
};

const writeMutationChecker = (source: string): string => {
  const directory = createMutationDirectory();
  const checker = join(directory, "guard.sh");
  writeFileSync(checker, source);
  writeFileSync(join(directory, "lint-standards.toml"), readFileSync(join(actionRoot, "lint-standards.toml")));
  chmodSync(checker, mutationMode);
  return checker;
};

const createLegacyMarkdownRequirementChecker = (): string => {
  const source = readFileSync(currentChecker, "utf8");
  return writeMutationChecker(buildLegacyCheckerSource(source));
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("template guard external repository boundary", () => {
  it("passes a repository without Markdown linter artifacts", () => {
    const root = createCompliantRepository();
    for (const path of markdownToolArtifacts) {
      assert.strictEqual(existsSync(join(root, path)), false, `${path} must be absent from the external fixture`);
    }

    const result = execute(currentChecker, root);
    assert.strictEqual(
      result.status,
      0,
      `a repository without Markdown linter artifacts must pass; stdout=${result.stdout}; stderr=${result.stderr}`,
    );
    assert.match(
      result.stdout,
      /PASS d - lint default depends on actionlint and yamllint/,
      "the remaining dependency check must require only actionlint and yamllint",
    );
  });
});

describe("template guard Markdown requirement mutation control", () => {
  it("shows the old Markdown dependency requirement would reject that fixture", () => {
    const root = createCompliantRepository();
    const mutatedChecker = createLegacyMarkdownRequirementChecker();
    const result = execute(mutatedChecker, root);

    assert.strictEqual(
      result.status,
      1,
      `the old Markdown dependency requirement must fail the fixture; stdout=${result.stdout}; stderr=${result.stderr}`,
    );
    assert.match(
      result.stdout,
      /FAIL d - lint default depends on actionlint and yamllint/,
      "the mutation must fail the dependency boundary rather than an unrelated check",
    );
  });
});
