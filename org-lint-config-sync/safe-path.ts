const { existsSync, realpathSync } = require("node:fs");
const path = require("node:path");

const isUnsafeComponent = (component: string): boolean => component === "" || component === "." || component === "..";

const assertSafeRelativePath = (label: string, relativePath: string): void => {
  if (!relativePath) {
    throw new Error(`${label}: must be a non-empty relative path`);
  }
  if (path.isAbsolute(relativePath) || relativePath.includes("\\")) {
    throw new Error(`${label}: must be a relative path, got ${JSON.stringify(relativePath)}`);
  }
  if (relativePath.split("/").some(isUnsafeComponent)) {
    throw new Error(`${label}: must not contain empty, "." or ".." segments, got ${JSON.stringify(relativePath)}`);
  }
};

const findExistingAncestor = (candidate: string): string => {
  let current = candidate;
  let parent = path.dirname(current);
  while (!existsSync(current) && parent !== current) {
    current = parent;
    parent = path.dirname(current);
  }
  return current;
};

const escapesRoot = (realRoot: string, realAncestor: string): boolean => {
  const relative = path.relative(realRoot, realAncestor);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
};

// Resolves relativePath against root and confirms — following any symlinks along the way —
// That the result cannot land outside root, even when an existing intermediate path
// Component is a symlink pointing elsewhere. Safe for paths that do not yet exist: the
// Nearest existing ancestor is what gets symlink-checked, since a not-yet-created segment
// Cannot itself be a redirecting symlink.
const resolveWithinRoot = (label: string, root: string, relativePath: string): string => {
  assertSafeRelativePath(label, relativePath);
  const resolved = path.resolve(root, relativePath);
  const realRoot = realpathSync(root);
  const realAncestor = realpathSync(findExistingAncestor(resolved));
  if (escapesRoot(realRoot, realAncestor)) {
    throw new Error(`${label}: ${JSON.stringify(relativePath)} escapes ${root} via a symlink`);
  }
  return resolved;
};

module.exports = { assertSafeRelativePath, resolveWithinRoot };
