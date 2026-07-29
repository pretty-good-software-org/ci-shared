// The committed action bundles are built from the installed dependency tree.
// ncc derives module ids from where those modules sit on disk, so bun and pnpm,
// which link packages into a store instead of writing real directories, emit
// bundles that differ from the runner's on actions a change never touched.
// One manager is authoritative, and the build refuses a tree it did not install.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require("node:fs");
const { spawnSync } = require("node:child_process");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const repositoryRoot = resolve(".");
const buildTask = join(repositoryRoot, "mise-tasks/build/_default");
const FOREIGN_LOCKFILES = ["bun.lock", "bun.lockb", "pnpm-lock.yaml", "yarn.lock"];

interface GuardResult {
  status: number | null;
  stderr: string;
}

// Runs the real build task against a throwaway tree, so the assertion covers the
// task the runner executes rather than a copy of its rules.
const runBuildGuard = (prepare: (root: string) => void): GuardResult => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-install-"));
  try {
    mkdirSync(join(root, "actions"));
    prepare(root);
    const result = spawnSync("bash", [buildTask], { cwd: root, encoding: "utf8" });
    return { status: result.status, stderr: result.stderr };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};


interface CompilerRun {
  calls: string[];
  status: number | null;
  stderr: string;
}

// Stands a recording stub where ncc lives, so the success path is asserted by what
// the build actually did rather than by an exit code that anything could produce.
const runBuildWithStubCompiler = (exitCode = 0): CompilerRun => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-install-ok-"));
  try {
    mkdirSync(join(root, "node_modules/typescript"), { recursive: true });
    mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
    writeFileSync(join(root, "node_modules/.package-lock.json"), "{}\n", "utf8");
    // More than one action, because "one call per action" asserted against a
    // single action cannot see a loop that compiles only the first or the last.
    // CI would not see it either: its backstop diffs the bundles that changed,
    // and an action that was never recompiled leaves its committed bundle alone.
    ["example", "example-two"].forEach((name: string) => {
      mkdirSync(join(root, `actions/${name}`), { recursive: true });
      writeFileSync(join(root, `actions/${name}/action.ts`), "module.exports = {};\n", "utf8");
    });
    // Helpers and previous output must stay out of the compile list.
    mkdirSync(join(root, "actions/example/tests"), { recursive: true });
    writeFileSync(join(root, "actions/example/tests/action.ts"), "module.exports = {};\n", "utf8");
    mkdirSync(join(root, "actions/example/dist"), { recursive: true });
    writeFileSync(join(root, "actions/example/dist/action.ts"), "module.exports = {};\n", "utf8");
    const log = join(root, "calls.log");
    writeFileSync(join(root, "node_modules/.bin/ncc"), `#!/usr/bin/env bash\necho "$*" >> "${log}"\nexit ${exitCode}\n`, "utf8");
    chmodSync(join(root, "node_modules/.bin/ncc"), 0o755);

    const result = spawnSync("bash", [buildTask], { cwd: root, encoding: "utf8" });
    const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [];
    return { calls, status: result.status, stderr: result.stderr };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

describe("authoritative install manager", () => {
  it("declares npm as the only manager that may install this repository", () => {
    const manifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
    assert.match(manifest.packageManager, /^npm@\d+\.\d+\.\d+$/, "package.json must pin npm as the manager");
  });

  it("keeps no lockfile from another manager in the repository", () => {
    const present = FOREIGN_LOCKFILES.filter((lockfile: string) => existsSync(join(repositoryRoot, lockfile)));
    assert.deepEqual(present, [], "a second lockfile invites an install that relays out node_modules");
  });
});

describe("build refuses a tree npm did not install", () => {
  FOREIGN_LOCKFILES.forEach((lockfile: string) => {
    it(`rejects a checkout carrying ${lockfile}`, () => {
      const result = runBuildGuard((root: string) => writeFileSync(join(root, lockfile), "", "utf8"));
      assert.equal(result.status, 1, `${lockfile} must stop the build`);
      assert.match(result.stderr, /installs with npm only/, "the refusal must say which manager is authoritative");
    });
  });

  // Each layout another manager can leave behind, including the one that leaves
  // no marker and no lockfile at all, which a list of known markers walks past.
  const FOREIGN_LAYOUTS: [string, (root: string) => void][] = [
    ["a pnpm store", (root: string) => mkdirSync(join(root, "node_modules/.pnpm"), { recursive: true })],
    [
      "a yarn state file",
      (root: string) => {
        mkdirSync(join(root, "node_modules"), { recursive: true });
        writeFileSync(join(root, "node_modules/.yarn-state.yml"), "", "utf8");
      },
    ],
    ["a bun isolated store", (root: string) => mkdirSync(join(root, "node_modules/.bun"), { recursive: true })],
    [
      "a bun hoisted tree, which leaves no marker",
      (root: string) => mkdirSync(join(root, "node_modules/typescript"), { recursive: true }),
    ],
    [
      "a linked package where npm writes a directory",
      (root: string) => {
        const modules = join(root, "node_modules");
        mkdirSync(join(modules, "store"), { recursive: true });
        symlinkSync(join(modules, "store"), join(modules, "typescript"));
      },
    ],
  ];

  FOREIGN_LAYOUTS.forEach(([description, prepare]: [string, (root: string) => void]) => {
    it(`rejects ${description}`, () => {
      const result = runBuildGuard(prepare);
      assert.equal(result.status, 1, `${description} must stop the build`);
      assert.match(result.stderr, /run 'npm ci'/, "the refusal must say how to recover");
    });
  });

  // A fixture without a compiler exits 127, and asserting only "not 1" would pass
  // on that. The stub makes the success path observable: the build must reach it,
  // invoke it once per action, and exit zero.
  it("compiles every action when the tree looks like an npm install", () => {
    const invocations = runBuildWithStubCompiler();
    assert.equal(invocations.status, 0, "a clean npm tree must build successfully");
    assert.doesNotMatch(invocations.stderr, /refusing to build/, "no refusal should be printed for an npm tree");
    assert.deepEqual(
      invocations.calls.toSorted(),
      [
        "build actions/example-two/action.ts -o actions/example-two/dist",
        "build actions/example/action.ts -o actions/example/dist",
      ],
      "every action must be compiled, and only the actions",
    );
  });

  // Without this, appending `|| true` to the compiler line passes every test.
  it("fails the build when the compiler fails", () => {
    const invocations = runBuildWithStubCompiler(1);
    assert.notEqual(invocations.status, 0, "a failing compiler must fail the build");
    assert.equal(invocations.calls.length, 1, "it stops at the first failure");
  });
});
