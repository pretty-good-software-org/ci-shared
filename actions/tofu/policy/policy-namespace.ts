const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const NAMESPACE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const PACKAGE_PATTERN = /^\s*package\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*(?:#.*)?$/gm;

interface DirectoryEntry {
  isDirectory: () => boolean;
  isFile: () => boolean;
  name: string;
}

const parseRequiredNamespaces = (input: string): string[] => [
  ...new Set(
    input
      .split(/\r?\n/)
      .map((namespace) => namespace.trim())
      .filter(Boolean),
  ),
];

const validateNamespaceNames = (requiredNamespaces: string[]): void => {
  const invalidNamespace = requiredNamespaces.find((namespace) => !NAMESPACE_PATTERN.test(namespace));
  if (invalidNamespace) {
    throw new Error("Policy integrity check failed: required-namespaces contains an invalid Rego package name");
  }
};

const findPolicyFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry: DirectoryEntry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findPolicyFiles(entryPath);
    }
    if (!entry.isFile() || !entry.name.endsWith(".rego") || entry.name.endsWith("_test.rego")) {
      return [];
    }
    return [entryPath];
  });

const packageNames = (policyDirectory: string): Set<string> => {
  const packages = new Set<string>();
  for (const policyFile of findPolicyFiles(policyDirectory)) {
    const source = readFileSync(policyFile, "utf8");
    for (const match of source.matchAll(PACKAGE_PATTERN)) {
      packages.add(match[1]);
    }
  }
  return packages;
};

const validateRequiredNamespaces = (policyDirectory: string, requiredNamespaces: string[]): void => {
  const availableNamespaces = packageNames(policyDirectory);
  const missingNamespaces = requiredNamespaces.filter((namespace) => !availableNamespaces.has(namespace));
  if (missingNamespaces.length > 0) {
    throw new Error(
      `Policy integrity check failed: fetched policy commit is missing required namespaces: ${missingNamespaces.join(", ")}`,
    );
  }
};

module.exports = { parseRequiredNamespaces, validateNamespaceNames, validateRequiredNamespaces };
