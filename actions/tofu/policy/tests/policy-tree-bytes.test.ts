import type { TestContext } from "node:test";

// Raw-byte reads matter because a lossy text decode maps distinct bytes onto one
// Digest, letting two policy files, or two link targets, differ yet digest alike.

const fs = require("node:fs");
const { it } = require("node:test");
const assert = require("node:assert");
const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { hashPolicyTree } = require("../policy-tree.ts");

const FIRST_INVALID_UTF8 = "70a0";
const SECOND_INVALID_UTF8 = "70a1";

const retargetLink = (tree: string, target: string | Buffer): void => {
  const link = join(tree, "link.rego");
  rmSync(link, { force: true });
  symlinkSync(target, link);
};

// Link targets are byte strings too, and POSIX allows bytes that are not UTF-8.
// The two targets below decode to identical replacement text as well.
// Returns the digest before and after the link is retargeted to raw bytes.
const digestsAroundByteRetarget = (tree: string): { after: string; before: string } => {
  mkdirSync(tree);
  writeFileSync(join(tree, "a.rego"), "package policies.s3\n", "utf8");
  retargetLink(tree, Buffer.from(FIRST_INVALID_UTF8, "hex"));
  const before = hashPolicyTree(tree);
  retargetLink(tree, Buffer.from(SECOND_INVALID_UTF8, "hex"));
  return { after: hashPolicyTree(tree), before };
};

it("distinguishes symlink targets that differ only outside valid UTF-8", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-link-"));
  try {
    const { after, before } = digestsAroundByteRetarget(join(root, "policy"));
    assert.notStrictEqual(before, after, "invalid target bytes must not collide");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// Bodies are digested as raw bytes.
// The two byte strings below decode to identical replacement text.
// Only a raw-byte digest tells them apart.
it("distinguishes files that differ only outside valid UTF-8", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-bytes-"));
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    const target = join(tree, "a.rego");
    writeFileSync(target, Buffer.from(FIRST_INVALID_UTF8, "hex"));
    const first = hashPolicyTree(tree);
    writeFileSync(target, Buffer.from(SECOND_INVALID_UTF8, "hex"));
    assert.notStrictEqual(first, hashPolicyTree(tree), "invalid byte sequences must not collide");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// A filename outside UTF-8 cannot be represented as a path part without a lenient
// Decode mapping every invalid byte onto U+FFFD, which collapses distinct names
// Onto one. The filesystems here reject such names outright, so the entries are
// Handed back directly to cover what a byte-transparent filesystem would return.
const bufferDirent = (raw: Buffer) => ({
  isDirectory: () => false,
  isFile: () => true,
  isSymbolicLink: () => false,
  name: raw,
});

it("refuses a filename that is not valid UTF-8 instead of collapsing it", (context: TestContext) => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-invalid-"));
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    writeFileSync(join(tree, "a.rego"), "package policies.a\n", "utf8");
    context.mock.method(fs, "readdirSync", () => [bufferDirent(Buffer.from("70a0", "hex"))]);

    assert.throws(
      () => hashPolicyTree(tree),
      /policy tree contains a filename that is not valid UTF-8: 70a0/u,
      "an undecodable name must stop the run",
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// The two names below differ only outside valid UTF-8. A lenient decode gives both
// The same path part, so the tree would digest as though they were one file.
it("does not let two undecodable names collapse onto one digest", (context: TestContext) => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-collide-"));
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    const names = [Buffer.from("70a0", "hex"), Buffer.from("70a1", "hex")];
    context.mock.method(fs, "readdirSync", () => names.map(bufferDirent));

    assert.throws(() => hashPolicyTree(tree), /not valid UTF-8/u, "neither name may reach the digest");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
