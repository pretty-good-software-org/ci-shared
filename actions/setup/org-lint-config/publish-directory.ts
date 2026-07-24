const { createHash } = require("node:crypto");
const { lstatSync, readFileSync, readdirSync, renameSync, rmSync } = require("node:fs");
const path = require("node:path");

const EXECUTABLE_MASK = 0o111;

interface TreeEntry {
  digest?: string;
  executable?: boolean;
  path: string;
  type: "directory" | "file";
}

const missingPath = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

const pathExists = (target: string): boolean => {
  try {
    lstatSync(target);
    return true;
  } catch (error: unknown) {
    if (missingPath(error)) {
      return false;
    }
    throw new Error(`inspect output path ${target}`, { cause: error });
  }
};

const fileEntry = (root: string, relativePath: string): TreeEntry => {
  const target = path.join(root, relativePath);
  const stat = lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`publish verified release: unsupported output entry ${relativePath}`);
  }
  const digest = createHash("sha256").update(readFileSync(target)).digest("hex");
  return { digest, executable: Boolean(stat.mode & EXECUTABLE_MASK), path: relativePath, type: "file" };
};

const describeEntry = (root: string, relativePath: string): TreeEntry[] => {
  const target = path.join(root, relativePath);
  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) {
    throw new Error("publish verified release: output trees must not contain symbolic links");
  }
  if (!stat.isDirectory()) {
    return [fileEntry(root, relativePath)];
  }
  const directory: TreeEntry = { path: relativePath, type: "directory" };
  return [directory, ...describeDirectory(root, relativePath)];
};

const describeDirectory = (root: string, relativePath = ""): TreeEntry[] => {
  const directory = path.join(root, relativePath);
  return readdirSync(directory)
    .toSorted()
    .flatMap((name: string) => describeEntry(root, path.join(relativePath, name)));
};

const directoriesEqual = (left: string, right: string): boolean =>
  JSON.stringify(describeDirectory(left)) === JSON.stringify(describeDirectory(right));

const publishNewDirectory = (stagingDirectory: string, outputDirectory: string): void => {
  try {
    renameSync(stagingDirectory, outputDirectory);
  } catch (error: unknown) {
    throw new Error(`atomically publish verified release to ${outputDirectory}`, { cause: error });
  }
};

const validateExistingDirectory = (stagingDirectory: string, outputDirectory: string): void => {
  const outputStat = lstatSync(outputDirectory);
  if (outputStat.isSymbolicLink() || !outputStat.isDirectory()) {
    throw new Error(`publish verified release: output path is not a real directory: ${outputDirectory}`);
  }
  if (!directoriesEqual(stagingDirectory, outputDirectory)) {
    throw new Error(`publish verified release: output directory already has different contents: ${outputDirectory}`);
  }
};

const removeIdenticalStaging = (stagingDirectory: string): void => {
  try {
    rmSync(stagingDirectory, { recursive: true });
  } catch (error: unknown) {
    throw new Error(`remove identical staging directory ${stagingDirectory}`, { cause: error });
  }
};

const publishDirectory = (stagingDirectory: string, outputDirectory: string): void => {
  if (!pathExists(outputDirectory)) {
    publishNewDirectory(stagingDirectory, outputDirectory);
    return;
  }
  validateExistingDirectory(stagingDirectory, outputDirectory);
  removeIdenticalStaging(stagingDirectory);
};

module.exports = { publishDirectory };
