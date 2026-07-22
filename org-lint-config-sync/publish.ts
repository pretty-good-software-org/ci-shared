const { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");

import type { OrgLintConfigPin } from "./pin-types.ts";

const { resolveWithinRoot } = require("./safe-path.ts");

const TEMP_SUFFIX = ".org-lint-config-sync.tmp";

export type AtomicWrite = (targetPath: string, contents: Buffer) => void;

interface PublishTarget {
  contents: Buffer;
  targetPath: string;
  vendoredPath: string;
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const removeIfExists = (targetPath: string): void => {
  try {
    rmSync(targetPath, { force: true });
  } catch (error: unknown) {
    console.error(`clean up ${targetPath}: ${errorMessage(error)}`);
  }
};

// Writes to a same-directory temp file, then renames into place — rename is atomic on the
// Same filesystem, so a crash mid-write can never leave the real target truncated.
const atomicWrite: AtomicWrite = (targetPath, contents) => {
  const tempPath = `${targetPath}${TEMP_SUFFIX}`;
  mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    writeFileSync(tempPath, contents);
    renameSync(tempPath, targetPath);
  } catch (error: unknown) {
    removeIfExists(tempPath);
    throw error;
  }
};

const readExistingContents = (targetPath: string): Buffer | undefined => {
  try {
    return readFileSync(targetPath);
  } catch {
    return undefined;
  }
};

const buildTargets = (projectRoot: string, extractedRoot: string, pin: OrgLintConfigPin): PublishTarget[] =>
  Object.entries(pin.vendoredFiles).map(([vendoredPath, entry]) => {
    const sourcePath = resolveWithinRoot("publish source", extractedRoot, entry.sourcePath);
    const targetPath = resolveWithinRoot("publish target", projectRoot, vendoredPath);
    return { contents: readFileSync(sourcePath), targetPath, vendoredPath };
  });

const restoreOriginal = (write: AtomicWrite, targetPath: string, original: Buffer | undefined): void => {
  try {
    if (original === undefined) {
      removeIfExists(targetPath);
      return;
    }
    write(targetPath, original);
  } catch (error: unknown) {
    console.error(`restore ${targetPath} after failed publish: ${errorMessage(error)}`);
  }
};

// All-or-nothing: every target is either published, or rolled back to exactly what it was
// Before this call. A failure partway through never leaves a mix of old and new content.
const publishTargets = (targets: PublishTarget[], write: AtomicWrite): void => {
  const originals = targets.map((target) => readExistingContents(target.targetPath));
  const published: number[] = [];
  try {
    targets.forEach((target, index) => {
      write(target.targetPath, target.contents);
      published.push(index);
    });
  } catch (error: unknown) {
    published.forEach((index) => restoreOriginal(write, targets[index].targetPath, originals[index]));
    throw new Error(`publish vendored org-lint-config files: ${errorMessage(error)}`, { cause: error });
  }
};

export interface PublishRequest {
  extractedRoot: string;
  pin: OrgLintConfigPin;
  write: AtomicWrite;
}

const publishVendoredFiles = (projectRoot: string, request: PublishRequest): string[] => {
  const { extractedRoot, pin, write } = request;
  const targets = buildTargets(projectRoot, extractedRoot, pin);
  publishTargets(targets, write);
  return targets.map((target) => target.vendoredPath);
};

module.exports = { atomicWrite, publishVendoredFiles };
