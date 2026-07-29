// The digest scheme itself: what it reads, how it frames it, and in what order.
// The tripwire comparing a tree before and after a run lives alongside this file.
// These cases pin the value that comparison depends on.

import type { TestContext } from "node:test";

const fs = require("node:fs");
const { it } = require("node:test");
const assert = require("node:assert");
const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { hashPolicyTree } = require("../policy-tree.ts");

// Builds the same tree under whichever root it is given.
const digestTreeUnder = (root: string): string => {
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    writeFileSync(join(tree, "a.rego"), "package policies.s3\n", "utf8");
    symlinkSync("/nonexistent/policy.rego", join(tree, "link.rego"));
    return hashPolicyTree(tree);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

// Following a link would read host files into the digest.
// A dangling link would throw, and digesting the target text avoids both.
// The link is retargeted inside one fixed root, so only its target changes.
const retargetLink = (tree: string, target: string | Buffer): void => {
  const link = join(tree, "link.rego");
  rmSync(link, { force: true });
  symlinkSync(target, link);
};

// Creates the tree once and returns its digest before and after the link moves.
const digestsAroundRetarget = (tree: string): { after: string; before: string } => {
  mkdirSync(tree);
  writeFileSync(join(tree, "a.rego"), "package policies.s3\n", "utf8");
  retargetLink(tree, "/nonexistent/policy.rego");
  const before = hashPolicyTree(tree);
  retargetLink(tree, "/nonexistent/other.rego");
  return { after: hashPolicyTree(tree), before };
};

it("digests a symlink by its target text rather than following it", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-"));
  try {
    const { after, before } = digestsAroundRetarget(join(root, "policy"));
    assert.match(before, /^[0-9a-f]{64}$/, "a dangling link must not break the digest");
    assert.notStrictEqual(before, after, "retargeting a link must change the digest");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// The digest describes the tree, not where it was checked out.
it("digests the same tree identically under a different root", () => {
  const first = digestTreeUnder(mkdtempSync(join(tmpdir(), "ci-shared-digest-a-")));
  const second = digestTreeUnder(mkdtempSync(join(tmpdir(), "ci-shared-digest-b-")));
  assert.strictEqual(first, second, "an absolute path must not leak into the digest");
});

// Without a length prefix the digest stream is label + value repeated.
// A file body can then spell out the next entry's header.
// These two different trees produce the identical unframed stream.
const digestOfTree = (files: [string, string][]): string => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-frame-"));
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    files.forEach(([name, content]: [string, string]) => writeFileSync(join(tree, name), content, "utf8"));
    return hashPolicyTree(tree);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

it("does not let a file body imitate the next entry's header", () => {
  const smuggled = digestOfTree([["a.rego", "Xpath:b.regofile:Y"]]);
  const genuine = digestOfTree([
    ["a.rego", "X"],
    ["b.rego", "Y"],
  ]);
  assert.notStrictEqual(smuggled, genuine, "length prefixes must keep the two trees apart");
});

// A golden digest for a fixed tree, pinning the whole scheme at once.
// It covers relative paths, length-prefixed framing, byte reads and entry order.
// Regenerate it only with a reviewed diff.
// A change here means every verified tree digests differently from then on.
const GOLDEN_TREE_DIGEST = "2dc714328da335704a1d3482b0e108e93eaa35aebb1adb15341bd1f0744b5fb4";

const writeGoldenTree = (root: string): string => {
  const tree = join(root, "policy");
  mkdirSync(join(tree, "nested"), { recursive: true });
  writeFileSync(join(tree, "B.rego"), "package policies.b\n", "utf8");
  writeFileSync(join(tree, "a.rego"), "package policies.a\n", "utf8");
  writeFileSync(join(tree, "nested", "c.rego"), "package policies.c\n", "utf8");
  symlinkSync("/nonexistent/target.rego", join(tree, "link.rego"));
  return tree;
};

it("digests a known tree to its recorded value", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-golden-"));
  try {
    assert.strictEqual(hashPolicyTree(writeGoldenTree(root)), GOLDEN_TREE_DIGEST, "the digest scheme changed");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// Filesystems may return directory entries in any order.
// The ones this runs on return them sorted, leaving the sort unfalsifiable.
// Handing back reversed entries stands in for a filesystem that does not.
it("digests a tree the same when the filesystem returns entries out of order", (context: TestContext) => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-order-"));
  try {
    const tree = writeGoldenTree(root);
    const realReaddir = fs.readdirSync;
    context.mock.method(fs, "readdirSync", (path: string, options: object) => realReaddir(path, options).toReversed());

    assert.strictEqual(hashPolicyTree(tree), GOLDEN_TREE_DIGEST, "entry order must not change the digest");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
