const { createHash } = require("node:crypto");
const { mkdirSync, mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path");

import type { FetchFn, InstallerInputs } from "./action-types.ts";

const { downloadReleaseArchive } = require("./download-release.ts");
const { extractArchive } = require("./extract-archive.ts");
const { publishDirectory } = require("./publish-directory.ts");

interface InstallDependencies {
  fetchFn?: FetchFn;
}

interface InstallLayout {
  outputDirectory: string;
  stagingDirectory: string;
  workspace: string;
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const verifyDigest = (archive: Buffer, expectedDigest: string): void => {
  const actualDigest = createHash("sha256").update(archive).digest("hex");
  if (actualDigest !== expectedDigest) {
    throw new Error(`verify release archive: SHA-256 mismatch; expected ${expectedDigest}, got ${actualDigest}`);
  }
};

const createOutputParent = (outputParent: string): void => {
  try {
    mkdirSync(outputParent, { recursive: true });
  } catch (error: unknown) {
    throw new Error(`create output parent ${outputParent}`, { cause: error });
  }
};

const createInstallLayout = (requestedOutput: string): InstallLayout => {
  const outputDirectory = path.resolve(requestedOutput);
  const outputName = path.basename(outputDirectory);
  if (!outputName) {
    throw new Error("resolve output directory: filesystem root is not a valid output directory");
  }
  const outputParent = path.dirname(outputDirectory);
  createOutputParent(outputParent);
  try {
    const workspace = mkdtempSync(path.join(outputParent, `.${outputName}.install-`));
    return { outputDirectory, stagingDirectory: path.join(workspace, "staged"), workspace };
  } catch (error: unknown) {
    throw new Error(`create installer workspace beside ${outputDirectory}`, { cause: error });
  }
};

const performInstall = async (
  inputs: InstallerInputs,
  layout: InstallLayout,
  dependencies: InstallDependencies,
): Promise<void> => {
  const archive = await downloadReleaseArchive(inputs.version, inputs.token, dependencies.fetchFn);
  verifyDigest(archive, inputs.sha256);
  extractArchive(archive, layout.stagingDirectory, `org-lint-config-${inputs.version}`);
  publishDirectory(layout.stagingDirectory, layout.outputDirectory);
};

const removeWorkspace = (workspace: string): void => {
  try {
    rmSync(workspace, { force: true, recursive: true });
  } catch (error: unknown) {
    throw new Error(`clean installer workspace ${workspace}`, { cause: error });
  }
};

const cleanupAfterFailure = (layout: InstallLayout, failure: unknown, version: string): never => {
  try {
    removeWorkspace(layout.workspace);
  } catch (cleanupError: unknown) {
    const message = `install org-lint-config ${version} and cleanup failed after ${errorMessage(failure)}`;
    throw new Error(message, { cause: cleanupError });
  }
  throw failure;
};

const install = async (inputs: InstallerInputs, dependencies: InstallDependencies = {}): Promise<string> => {
  const layout = createInstallLayout(inputs.outputDirectory);
  try {
    await performInstall(inputs, layout, dependencies);
  } catch (error: unknown) {
    const failure = new Error(`install org-lint-config ${inputs.version}: ${errorMessage(error)}`, { cause: error });
    cleanupAfterFailure(layout, failure, inputs.version);
  }
  removeWorkspace(layout.workspace);
  return layout.outputDirectory;
};

module.exports = { install, verifyDigest };
