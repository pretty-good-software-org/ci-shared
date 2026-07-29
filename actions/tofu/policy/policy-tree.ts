// Digests the verified policy tree so evaluation can be proven to have used it.
// The pinning flags are the enforcement; this digest is the proof.
// Symlinks are digested by their target text and never followed.
// Following one would let a planted link pull host files into the digest.
// Paths are digested relative to the tree root and file bodies as raw bytes.
// The digest therefore describes the tree itself, not where it was checked out.
//
// Names are enumerated as raw bytes and decoded strictly. A lenient decode maps
// Every invalid byte onto U+FFFD, so two distinct filenames collapse onto one
// Path part and the tree they describe stops being unambiguous. Policy sources
// Are Git paths that people maintain, so a name outside UTF-8 is refused rather
// Than digested: the run stops instead of trusting a name it cannot represent.

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
  name: Buffer;
}

interface Digest {
  update: (value: string | Buffer) => void;
}

interface DigestContext {
  digest: Digest;
  root: string;
}

// Fatal decoding, so an invalid byte throws instead of becoming U+FFFD.
const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });

const decodeName = (raw: Buffer): string => {
  try {
    return STRICT_UTF8.decode(raw);
  } catch {
    throw new Error(
      `Policy integrity check failed: policy tree contains a filename that is not valid UTF-8: ${raw.toString("hex")}`,
    );
  }
};

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
  const path = join(directory, decodeName(entry.name));
  digestPart(context.digest, "path", relative(context.root, path));
  if (entry.isDirectory() && !entry.isSymbolicLink()) {
    digestPart(context.digest, "directory", "");
    digestDirectory(context, path);
    return;
  }
  digestContent(context, path, entry);
};

// Raw-byte order, which is the same on every machine. Ordering the decoded text
// Instead would sort by UTF-16 code unit, where an astral name sorts before a
// Three-byte one although its bytes are larger.
const byName = (left: DirectoryEntry, right: DirectoryEntry): number => Buffer.compare(left.name, right.name);

// One walk order for every reader of the tree: raw-byte sort, strict decode.
const sortedEntries = (directory: string): { entry: DirectoryEntry; name: string }[] => {
  const options = { encoding: "buffer", withFileTypes: true };
  const entries = fs.readdirSync(directory, options).toSorted(byName);
  return entries.map((entry: DirectoryEntry) => ({ entry, name: decodeName(entry.name) }));
};

const digestDirectory = (context: DigestContext, directory: string): void => {
  sortedEntries(directory).forEach(({ entry }: { entry: DirectoryEntry }) => digestEntry(context, directory, entry));
};

// Returns a stable digest over every relative path, file body and link target.
const hashPolicyTree = (policyDirectory: string): string => {
  const digest = createHash("sha256");
  digestDirectory({ digest, root: policyDirectory }, policyDirectory);
  return digest.digest("hex");
};

module.exports = { digestPart, hashPolicyTree, sortedEntries };
