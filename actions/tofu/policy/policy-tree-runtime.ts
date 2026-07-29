// A second fingerprint of the verified tree, over evidence a writer cannot reset.
//
// The content digest establishes what the policy is, and it is the right thing to
// Compare against a source of truth. It cannot see a tree that was changed and put
// Back: rewrite a policy, let conftest evaluate it, restore the original bytes, and
// The content digest before and after are equal because the content is equal.
//
// Metadata closes that window. A same-user write, rename, add, remove or chmod all
// Move ctime, and ctime cannot be set back: utimes moves atime and mtime only, and
// Changing it is itself a metadata change. Evaluating policy only reads, so a run
// That leaves this fingerprint intact did not modify the tree.
//
// Atime is excluded on purpose. Reading the tree is exactly what conftest does, so
// Including it would fail every run on a filesystem that records reads eagerly.
//
// Ctime is the field that detects; dev, ino and size are cross-checks, and none of
// Them is separately covered by a test because none can be. Every operation that
// Changes an inode or a size also moves ctime, so no filesystem operation isolates
// Them. The atime exclusion is likewise undemonstrable where atime updates lazily,
// As it does under relatime: a second read inside the window leaves it untouched.
// They are kept because the cost is a few bytes and the alternative is resting the
// Whole check on one field of one stat.

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const { join, relative } = require("node:path");
const { digestPart, hashPolicyTree, sortedEntries } = require("./policy-tree.ts");

interface DirectoryEntry {
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
}

interface Digest {
  update: (value: string | Buffer) => void;
}

// Identity, permissions, size and the moment metadata last changed. Device and
// Inode catch a path swapped for a different file that happens to match.
const statParts = (path: string): string => {
  const stat = fs.lstatSync(path, { bigint: true });
  return [stat.dev, stat.ino, stat.ctimeNs, stat.mode, stat.size].join(",");
};

interface FingerprintContext {
  digest: Digest;
  root: string;
}

const fingerprintEntry = (context: FingerprintContext, directory: string, named: NamedEntry): void => {
  const path = join(directory, named.name);
  digestPart(context.digest, "path", relative(context.root, path));
  digestPart(context.digest, "stat", statParts(path));
  if (named.entry.isDirectory() && !named.entry.isSymbolicLink()) {
    digestPart(context.digest, "directory", "");
    fingerprintDirectory(context, path);
  }
};

interface NamedEntry {
  entry: DirectoryEntry;
  name: string;
}

const fingerprintDirectory = (context: FingerprintContext, directory: string): void => {
  sortedEntries(directory).forEach((named: NamedEntry) => fingerprintEntry(context, directory, named));
};

// Returns a digest of the tree's metadata, taken before evaluation and again after.
const fingerprintPolicyTree = (policyDirectory: string): string => {
  const digest = createHash("sha256");
  digestPart(digest, "root", statParts(policyDirectory));
  fingerprintDirectory({ digest, root: policyDirectory }, policyDirectory);
  return digest.digest("hex");
};

interface TreeState {
  fetchedDigest: string;
  fetchedFingerprint: string;
}

const verifyContentUnchanged = (policyDirectory: string, fetchedDigest: string): void => {
  if (hashPolicyTree(policyDirectory) === fetchedDigest) {
    return;
  }
  throw new Error("Policy integrity check failed: the verified policy tree changed during evaluation");
};

const verifyRuntimeUnchanged = (policyDirectory: string, fetchedFingerprint: string): void => {
  if (fingerprintPolicyTree(policyDirectory) === fetchedFingerprint) {
    return;
  }
  throw new Error("Policy integrity check failed: the verified policy tree was modified during evaluation");
};

// Content first, so a tree whose bytes changed keeps reporting that. The
// Fingerprint then covers what content equality cannot see: a change put back.
const verifyTreeUntouched = (policyDirectory: string, state: TreeState): void => {
  verifyContentUnchanged(policyDirectory, state.fetchedDigest);
  verifyRuntimeUnchanged(policyDirectory, state.fetchedFingerprint);
};

module.exports = { fingerprintPolicyTree, verifyTreeUntouched };
