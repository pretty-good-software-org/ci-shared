// The committed action bundles are built from the installed dependency tree.
// ncc derives module ids from where those modules sit on disk, so bun and pnpm,
// which link packages into a store instead of writing real directories, emit
// bundles that differ from the runner's on actions a change never touched.
// One manager is authoritative, and the build refuses a tree it did not install.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
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

  it("proceeds past the guard when the tree looks like an npm install", () => {
    const result = runBuildGuard((root: string) => mkdirSync(join(root, "node_modules/typescript"), { recursive: true }));
    assert.notEqual(result.status, 1, "a clean npm tree must reach the compiler");
    assert.doesNotMatch(result.stderr, /refusing to build/, "no refusal should be printed for an npm tree");
  });
});
