const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");

interface CommandResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

const repositoryRoot = resolve(".");
const projectConfig = join(repositoryRoot, ".rumdl.toml");
const formatterTask = join(repositoryRoot, "mise-tasks/format/markdown");
const rumdlPath = execFileSync("mise", ["which", "rumdl"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const rumdlBinDirectory = dirname(rumdlPath);
const temporaryProjects: string[] = [];
const markdownFile = "fixture.md";
const formatterScript = "format-markdown";
const noCache = "--no-cache";
const denyConfigWarnings = "--deny-config-warnings";
const formatterOverride = "--extend-enable MD029,MD060 --config 'MD060.enabled = true'";
const dualViolationFixture =
  "1. Item 1\n1. Item 2\n1. Item 3\n\n# Table\n\n| Name | Age |\n|---|---|\n| Alice | 30 |\n";
const expectedFormattedFixture =
  "1. Item 1\n2. Item 2\n3. Item 3\n\n# Table\n\n| Name  | Age |\n| ----- | --- |\n| Alice | 30  |\n";
const formatterCallSites: Array<{ expected: string; path: string }> = [
  {
    path: "lefthook/ci.yml",
    expected: `run: rumdl fmt ${formatterOverride} --check -- {staged_files}`,
  },
  {
    path: "lefthook/lint.yml",
    expected: `run: rumdl fmt ${formatterOverride} --check -- {staged_files}`,
  },
  {
    path: "mise-tasks/check/markdown-format",
    expected: `git ls-files -z -- '*.md' | xargs -0 rumdl fmt ${formatterOverride} --check --`,
  },
  {
    path: "mise-tasks/format/markdown",
    expected: `git ls-files -z -- '*.md' | xargs -0 rumdl fmt ${formatterOverride} --silent --`,
  },
];

const createProject = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-rumdl-boundary-"));
  temporaryProjects.push(root);
  copyFileSync(projectConfig, join(root, ".rumdl.toml"));
  copyFileSync(formatterTask, join(root, formatterScript));
  chmodSync(join(root, formatterScript), 0o755);
  writeFileSync(join(root, markdownFile), dualViolationFixture);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", markdownFile], { cwd: root });
  return root;
};

const commandEnvironment = (root: string): NodeJS.ProcessEnv => ({
  ...process.env,
  MISE_PROJECT_ROOT: root,
  PATH: `${rumdlBinDirectory}${delimiter}${process.env.PATH ?? ""}`,
  RUMDL_CACHE_DIR: join(root, ".rumdl_cache"),
});

const runRumdl = (root: string, args: string[]): CommandResult => {
  const result = spawnSync(rumdlPath, args, {
    cwd: root,
    encoding: "utf8",
    env: commandEnvironment(root),
  });
  assert.ifError(result.error);
  return { status: result.status, stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
};

const runFormatter = (root: string): CommandResult => {
  const result = spawnSync(join(root, formatterScript), [], {
    cwd: root,
    encoding: "utf8",
    env: commandEnvironment(root),
  });
  assert.ifError(result.error);
  return { status: result.status, stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
};

const output = (result: CommandResult): string => `${result.stdout}\n${result.stderr}`;

const assertFormattedFixture = (root: string, result: CommandResult): void => {
  assert.strictEqual(result.status, 0, `production formatter must succeed; output=${output(result)}`);
  assert.strictEqual(
    readFileSync(join(root, markdownFile), "utf8"),
    expectedFormattedFixture,
    "production formatter must fix both source-disabled rules",
  );
};

afterEach(() => {
  for (const root of temporaryProjects.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("source-disabled rumdl formatter boundaries", () => {
  it("does not report MD029 or MD060 for one dual-violation fixture during lint", () => {
    const root = createProject();
    const result = runRumdl(root, ["check", noCache, denyConfigWarnings, "--", markdownFile]);
    const lintOutput = output(result);

    assert.strictEqual(result.status, 0, `source-disabled rules must pass lint; output=${lintOutput}`);
    assert.doesNotMatch(lintOutput, /\bMD029\b/, "source-disabled MD029 must not be reported by lint");
    assert.doesNotMatch(lintOutput, /\bMD060\b/, "source-disabled MD060 must not be reported by lint");
  });

  it("formats both source-disabled rules through the production formatter task", () => {
    const root = createProject();
    assertFormattedFixture(root, runFormatter(root));
  });

  it("fails the formatter regression when its external override is removed", () => {
    const root = createProject();
    const scriptPath = join(root, formatterScript);
    const script = readFileSync(scriptPath, "utf8");
    const mutatedScript = script.replace(formatterOverride, "");

    assert.notStrictEqual(mutatedScript, script, "mutation must remove the formatter-only override");
    writeFileSync(scriptPath, mutatedScript);
    chmodSync(scriptPath, 0o755);

    const result = runFormatter(root);
    assert.throws(
      () => assertFormattedFixture(root, result),
      /production formatter must fix both source-disabled rules/,
      "removing the formatter-only override must make the formatter regression fail",
    );
  });

  it("keeps every production formatter call site on the minimal override", () => {
    for (const callSite of formatterCallSites) {
      const source = readFileSync(join(repositoryRoot, callSite.path), "utf8");
      assert.ok(source.includes(callSite.expected), `${callSite.path} must carry the minimal formatter override`);
      assert.doesNotMatch(source, /MD071|global\.disable\s*=\s*\[\s*\]/, `${callSite.path} must not widen the override`);
    }
  });
});
