// Raw-byte reads matter because a lossy text decode maps distinct bytes onto one
// Digest, letting two policy files, or two link targets, differ yet digest alike.

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
