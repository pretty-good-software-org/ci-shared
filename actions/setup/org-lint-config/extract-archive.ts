const { closeSync, mkdirSync, openSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { gunzipSync } = require("node:zlib");
const { DIRECTORY_TYPE, parseTar } = require("./tar-reader.ts");

import type { TarEntry } from "./tar-reader.ts";

const BYTES_PER_KIBIBYTE = 1024;
const MAX_EXTRACTED_MEBIBYTES = 100;
const MAX_EXTRACTED_BYTES = MAX_EXTRACTED_MEBIBYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const PERMISSION_MASK = 0o777;
const DEFAULT_DIRECTORY_MODE = 0o755;

interface PreparedEntry extends TarEntry {
  relativePath: string;
}

const unsafeComponent = (component: string): boolean => !component || component === "." || component === "..";
const unsafeEntryName = (entryName: string): boolean =>
  !entryName || entryName.startsWith("/") || entryName.includes("\\");

const safeRelativePath = (entryName: string, expectedRoot: string): string => {
  if (unsafeEntryName(entryName)) {
    throw new Error(`extract release archive: unsafe entry path ${JSON.stringify(entryName)}`);
  }
  const components = entryName.replace(/\/+$/, "").split("/");
  if (components.some(unsafeComponent)) {
    throw new Error(`extract release archive: unsafe entry path ${JSON.stringify(entryName)}`);
  }
  if (components[0] !== expectedRoot) {
    throw new Error(`extract release archive: entry is outside expected root ${expectedRoot}`);
  }
  return components.slice(1).join(path.sep);
};

const prepareEntries = (entries: TarEntry[], expectedRoot: string): PreparedEntry[] =>
  entries.map((entry) => ({ ...entry, relativePath: safeRelativePath(entry.name, expectedRoot) }));

const validateRoot = (entries: PreparedEntry[]): void => {
  const rootEntries = entries.filter((entry) => !entry.relativePath);
  if (rootEntries.length !== 1 || rootEntries[0].type !== DIRECTORY_TYPE) {
    throw new Error("extract release archive: expected one top-level directory");
  }
  if (!entries.some((entry) => entry.relativePath && entry.type !== DIRECTORY_TYPE)) {
    throw new Error("extract release archive: expected a non-empty top-level directory");
  }
};

const validateUniquePaths = (entries: PreparedEntry[]): void => {
  const paths = entries.map((entry) => entry.relativePath).filter(Boolean);
  if (new Set(paths).size !== paths.length) {
    throw new Error("extract release archive: duplicate entry path");
  }
};

const writeFileExclusively = (target: string, data: Buffer, mode: number): void => {
  const descriptor = openSync(target, "wx", mode & PERMISSION_MASK);
  try {
    writeFileSync(descriptor, data);
  } finally {
    closeSync(descriptor);
  }
};

const writeEntry = (entry: PreparedEntry, destination: string): void => {
  const target = path.join(destination, entry.relativePath);
  if (entry.type === DIRECTORY_TYPE) {
    mkdirSync(target, { mode: entry.mode & PERMISSION_MASK, recursive: true });
    return;
  }
  mkdirSync(path.dirname(target), { mode: DEFAULT_DIRECTORY_MODE, recursive: true });
  writeFileExclusively(target, entry.data, entry.mode);
};

const writeEntries = (entries: PreparedEntry[], destination: string): void => {
  mkdirSync(destination, { mode: DEFAULT_DIRECTORY_MODE });
  entries.filter((entry) => entry.relativePath).forEach((entry) => writeEntry(entry, destination));
};

const decompressArchive = (compressedArchive: Buffer): Buffer => {
  try {
    return gunzipSync(compressedArchive, { maxOutputLength: MAX_EXTRACTED_BYTES });
  } catch (error: unknown) {
    throw new Error("extract release archive: invalid or oversized gzip data", { cause: error });
  }
};

const extractArchive = (compressedArchive: Buffer, destination: string, expectedRoot: string): void => {
  const entries = prepareEntries(parseTar(decompressArchive(compressedArchive)), expectedRoot);
  validateRoot(entries);
  validateUniquePaths(entries);
  writeEntries(entries, destination);
};

module.exports = { extractArchive };
