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
const runBuildWithStubCompiler = (): CompilerRun => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-install-ok-"));
  try {
    mkdirSync(join(root, "node_modules/typescript"), { recursive: true });
    mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
    mkdirSync(join(root, "actions/example"), { recursive: true });
    writeFileSync(join(root, "actions/example/action.ts"), "module.exports = {};\n", "utf8");
    const log = join(root, "calls.log");
    writeFileSync(join(root, "node_modules/.bin/ncc"), `#!/usr/bin/env bash\necho "$*" >> ${log}\n`, "utf8");
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

  it("rejects a pnpm-linked node_modules", () => {
    const result = runBuildGuard((root: string) => mkdirSync(join(root, "node_modules/.pnpm"), { recursive: true }));
    assert.equal(result.status, 1, "a pnpm store must stop the build");
    assert.match(result.stderr, /run 'npm ci'/, "the refusal must say how to recover");
  });

  it("rejects a linked package where npm writes a directory", () => {
    const result = runBuildGuard((root: string) => {
      const modules = join(root, "node_modules");
      mkdirSync(join(modules, "store"), { recursive: true });
      symlinkSync(join(modules, "store"), join(modules, "typescript"));
    });
    assert.equal(result.status, 1, "a linked package must stop the build");
    assert.match(result.stderr, /run 'npm ci'/, "the refusal must say how to recover");
  });

  // A fixture without a compiler exits 127, and asserting only "not 1" would pass
  // on that. The stub makes the success path observable: the build must reach it,
  // invoke it once per action, and exit zero.
  it("compiles every action when the tree looks like an npm install", () => {
    const invocations = runBuildWithStubCompiler();
    assert.equal(invocations.status, 0, "a clean npm tree must build successfully");
    assert.doesNotMatch(invocations.stderr, /refusing to build/, "no refusal should be printed for an npm tree");
    assert.deepEqual(
      invocations.calls,
      ["build actions/example/action.ts -o actions/example/dist"],
      "the guard must hand every action to the compiler unchanged",
    );
  });
});
