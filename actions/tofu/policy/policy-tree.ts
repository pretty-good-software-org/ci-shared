// Digests the verified policy tree so evaluation can be proven to have used it.
// The pinning flags are the enforcement; this digest is the proof.
// Symlinks are digested by their target text and never followed.
// Following one would let a planted link pull host files into the digest.

const { createHash } = require("node:crypto");
const { readFileSync, readdirSync, readlinkSync } = require("node:fs");
const { join } = require("node:path");

interface DirectoryEntry {
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
  name: string;
}

interface Digest {
  update: (value: string) => void;
}

const entryContent = (entry: DirectoryEntry, path: string): string => {
  if (entry.isSymbolicLink()) {
    return `symlink:${readlinkSync(path)}`;
  }
  if (entry.isFile()) {
    return `file:${readFileSync(path, "utf8")}`;
  }
  return "other:";
};

const digestEntry = (digest: Digest, directory: string, entry: DirectoryEntry): void => {
  const path = join(directory, entry.name);
  digest.update(` ${path} `);
  if (entry.isDirectory() && !entry.isSymbolicLink()) {
    digest.update("directory:");
    digestDirectory(digest, path);
    return;
  }
  digest.update(entryContent(entry, path));
};

const byName = (left: DirectoryEntry, right: DirectoryEntry): number => left.name.localeCompare(right.name);

const digestDirectory = (digest: Digest, directory: string): void => {
  const entries = readdirSync(directory, { withFileTypes: true }).toSorted(byName);
  entries.forEach((entry: DirectoryEntry) => digestEntry(digest, directory, entry));
};

// Returns a stable digest over every path, file body and link target in the tree.
const hashPolicyTree = (policyDirectory: string): string => {
  const digest = createHash("sha256");
  digestDirectory(digest, policyDirectory);
  return digest.digest("hex");
};

module.exports = { hashPolicyTree };
