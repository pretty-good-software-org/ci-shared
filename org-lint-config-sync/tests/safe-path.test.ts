const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, symlinkSync, writeFileSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { assertSafeRelativePath, resolveWithinRoot } = require("../safe-path.ts");
const { temporaryProjectRoot } = require("./fixture-helpers.ts");

describe("assertSafeRelativePath: structural rejection", () => {
  it("rejects an empty path", () => {
    assert.throws(() => assertSafeRelativePath("label", ""), /non-empty/);
  });

  it("rejects an absolute path", () => {
    assert.throws(() => assertSafeRelativePath("label", "/etc/passwd"), /relative path/);
  });

  it("rejects a path containing a traversal segment", () => {
    assert.throws(() => assertSafeRelativePath("label", "a/../../b"), /\.\./);
  });

  it("rejects a path containing a bare current-directory segment", () => {
    assert.throws(() => assertSafeRelativePath("label", "a/./b"), /segments/);
  });

  it("accepts a normal nested relative path", () => {
    assert.doesNotThrow(() => assertSafeRelativePath("label", "configs/yamllint.yml"));
  });
});

describe("resolveWithinRoot: ordinary paths", () => {
  it("resolves a nested relative path that does not exist yet", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    const resolved = resolveWithinRoot("label", root, "new/nested/file.yml");
    assert.strictEqual(resolved, path.join(root, "new/nested/file.yml"));
  });

  it("rejects a relativePath containing a traversal segment", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    assert.throws(() => resolveWithinRoot("label", root, "../escape"), /\.\./);
  });
});

describe("resolveWithinRoot: symlink escapes", () => {
  it("rejects when an existing intermediate directory is a symlink pointing outside root", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    const outside = temporaryProjectRoot(context);
    symlinkSync(outside, path.join(root, "escape"), "dir");

    assert.throws(
      () => resolveWithinRoot("label", root, "escape/inner.yml"),
      /escapes/,
      "an intermediate symlink must not be trusted just because the leaf path looks contained",
    );
  });

  it("rejects when the target itself is a symlink pointing outside root", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    const outside = temporaryProjectRoot(context);
    const outsideFile = path.join(outside, "secret.yml");
    writeFileSync(outsideFile, "secret\n");
    symlinkSync(outsideFile, path.join(root, "link.yml"), "file");

    assert.throws(() => resolveWithinRoot("label", root, "link.yml"), /escapes/);
  });

  it("accepts a path whose existing ancestor stays within root", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    mkdirSync(path.join(root, "configs"), { recursive: true });

    assert.doesNotThrow(() => resolveWithinRoot("label", root, "configs/yamllint.yml"));
  });
});
