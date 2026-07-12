const { readFileSync, readdirSync } = require("node:fs");
const { join, relative } = require("node:path");

const CONFTEST_FILENAME = "conftest.toml";
const FLOOR_EXEMPT_REASON_PATTERN = /^\s*floor_exempt_reason\s*=\s*["']([^"']*)["']/m;
const IGNORED_DIRECTORIES = new Set([".git", ".terraform", "node_modules", ".claude"]);

interface DirectoryEntry {
  isDirectory: () => boolean;
  isFile: () => boolean;
  name: string;
}

const visitDirectory = (entry: DirectoryEntry, directory: string, root: string): string[] => {
  if (IGNORED_DIRECTORIES.has(entry.name)) {
    return [];
  }
  return findConftestFiles(join(directory, entry.name), root);
};

const isConftestFile = (entry: DirectoryEntry): boolean => entry.isFile() && entry.name === CONFTEST_FILENAME;

const visitEntry = (entry: DirectoryEntry, directory: string, root: string): string[] => {
  const entryPath = join(directory, entry.name);
  if (entry.isDirectory()) {
    return visitDirectory(entry, directory, root);
  }
  if (!isConftestFile(entry)) {
    return [];
  }
  return [relative(root, entryPath) || CONFTEST_FILENAME];
};

const findConftestFiles = (directory: string, root: string): string[] =>
  readdirSync(directory, { withFileTypes: true })
    .flatMap((entry: DirectoryEntry) => visitEntry(entry, directory, root))
    .toSorted();

const hasNamespace = (content: string): boolean => {
  const namespaceArray = content.match(/^\s*namespace\s*=\s*\[([\s\S]*?)\]/m)?.[1] || "";
  const namespaceString = content.match(/^\s*namespace\s*=\s*["'][^"']+["']/m);
  return /["'][^"']+["']/.test(namespaceArray) || namespaceString !== null;
};

const floorExemptReason = (content: string): string => content.match(FLOOR_EXEMPT_REASON_PATTERN)?.[1]?.trim() || "";

const findFloorExemptReason = (root: string): string => {
  for (const file of findConftestFiles(root, root)) {
    const reason = floorExemptReason(readFileSync(join(root, file), "utf8"));
    if (reason) {
      return reason;
    }
  }

  return "";
};

const hasPolicySelectionOrExemption = (content: string): boolean =>
  hasNamespace(content) || floorExemptReason(content) !== "";

const validateConftestIntegrity = (root: string): string => {
  const invalidFiles = findConftestFiles(root, root).filter(
    (file) => !hasPolicySelectionOrExemption(readFileSync(join(root, file), "utf8")),
  );
  if (invalidFiles.length === 0) {
    return "";
  }

  return `Policy integrity check failed: every conftest.toml must declare at least one namespace or a non-empty floor_exempt_reason; missing in ${invalidFiles.join(", ")}`;
};

module.exports = { findFloorExemptReason, validateConftestIntegrity };
