// Digests the verified policy tree so evaluation can be proven to have used it.
// The pinning flags are the enforcement; this digest is the proof.
// Symlinks are digested by their target text and never followed.
// Following one would let a planted link pull host files into the digest.
// Paths are digested relative to the tree root and file bodies as raw bytes.
// The digest therefore describes the tree itself, not where it was checked out.

const { createHash } = require("node:crypto");
const { readFileSync, readdirSync, readlinkSync } = require("node:fs");
const { join, relative } = require("node:path");

interface DirectoryEntry {
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
  name: string;
}

interface Digest {
  update: (value: string | Buffer) => void;
}

interface DigestContext {
  digest: Digest;
  root: string;
}

// Each part is length-prefixed so no file body can imitate the next entry's header.
const digestPart = (digest: Digest, label: string, value: string | Buffer): void => {
  digest.update(`${label}:${value.length}:`);
  digest.update(value);
};

const digestContent = (context: DigestContext, path: string, entry: DirectoryEntry): void => {
  if (entry.isSymbolicLink()) {
    // A link target is an arbitrary byte string, so it is read as bytes.
    // Decoding it as text would collapse distinct targets onto one digest.
    digestPart(context.digest, "symlink", readlinkSync(path, "buffer"));
    return;
  }
  if (entry.isFile()) {
    digestPart(context.digest, "file", readFileSync(path));
    return;
  }
  digestPart(context.digest, "other", "");
};

const digestEntry = (context: DigestContext, directory: string, entry: DirectoryEntry): void => {
  const path = join(directory, entry.name);
  digestPart(context.digest, "path", relative(context.root, path));
  if (entry.isDirectory() && !entry.isSymbolicLink()) {
    digestPart(context.digest, "directory", "");
    digestDirectory(context, path);
    return;
  }
  digestContent(context, path, entry);
};

const byName = (left: DirectoryEntry, right: DirectoryEntry): number => left.name.localeCompare(right.name);

const digestDirectory = (context: DigestContext, directory: string): void => {
  const entries = readdirSync(directory, { withFileTypes: true }).toSorted(byName);
  entries.forEach((entry: DirectoryEntry) => digestEntry(context, directory, entry));
};

// Returns a stable digest over every relative path, file body and link target.
const hashPolicyTree = (policyDirectory: string): string => {
  const digest = createHash("sha256");
  digestDirectory({ digest, root: policyDirectory }, policyDirectory);
  return digest.digest("hex");
};

module.exports = { hashPolicyTree };
