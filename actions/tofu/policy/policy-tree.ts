// Digests the verified policy tree so evaluation can be proven to have used it.
// The pinning flags are the enforcement; this digest is the proof.
// Symlinks are digested by their target text and never followed.
// Following one would let a planted link pull host files into the digest.
// Paths are digested relative to the tree root and file bodies as raw bytes.
// The digest therefore describes the tree itself, not where it was checked out.
//
// One asymmetry is knowingly left in place. ReaddirSync returns names decoded as
// Text, so two filenames differing only outside valid UTF-8 digest alike.
// Reading them as Buffers would need a Buffer comparator and join throughout.
// The failure it allows is a tripwire that fires when nothing changed, never one
// That stays silent when something did, so it fails closed.

const { createHash } = require("node:crypto");
// ReaddirSync is reached through the module object, so a test can hand back
// Entries out of order, the way a filesystem with unordered readdir does.
const fs = require("node:fs");
const { readFileSync, readlinkSync } = fs;
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
// The prefix counts bytes rather than characters.
// A string's .length is UTF-16 units, so an accented name declares six and
// Absorbs seven, leaving the framing to rest on UTF-8 being a prefix code
// Rather than on the count being right.
const digestPart = (digest: Digest, label: string, value: string | Buffer): void => {
  digest.update(`${label}:${Buffer.byteLength(value)}:`);
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

// Code-unit order rather than localeCompare, whose collation is locale-dependent.
// The digest must be the same value on every machine that computes it.
const byName = (left: DirectoryEntry, right: DirectoryEntry): number => {
  if (left.name === right.name) {
    return 0;
  }
  if (left.name < right.name) {
    return -1;
  }
  return 1;
};

const digestDirectory = (context: DigestContext, directory: string): void => {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).toSorted(byName);
  entries.forEach((entry: DirectoryEntry) => digestEntry(context, directory, entry));
};

// Returns a stable digest over every relative path, file body and link target.
const hashPolicyTree = (policyDirectory: string): string => {
  const digest = createHash("sha256");
  digestDirectory({ digest, root: policyDirectory }, policyDirectory);
  return digest.digest("hex");
};

module.exports = { hashPolicyTree };
