const { readFileSync } = require("node:fs");
const path = require("node:path");

import type { OrgLintConfigPin, VendoredFilePin } from "./pin-types.ts";
import type { FieldSpec, Reporter } from "./pin-schema.ts";

const { assertSafeRelativePath } = require("./safe-path.ts");
const { assertExactKeys, assertNonEmptyString, assertSha256, errorMessage, isPlainObject, makeReporter } =
  require("./pin-schema.ts");

const PIN_FILENAME = ".org-lint-config.json";
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
const PIN_FIELDS: FieldSpec = { allowed: ["version", "archiveSha256", "vendoredFiles"], label: "pin" };
const VENDORED_FILE_ALLOWED_FIELDS = ["sourcePath", "sha256"];

const readPinFile = (pinPath: string): string => {
  try {
    return readFileSync(pinPath, "utf8");
  } catch (error: unknown) {
    throw new Error(`read org-lint-config pin ${pinPath}: ${errorMessage(error)}`, { cause: error });
  }
};

const parseJson = (pinPath: string, raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(`parse org-lint-config pin ${pinPath}: invalid JSON`, { cause: error });
  }
};

const assertVersion = (report: Reporter, value: unknown): string => {
  const stringValue = assertNonEmptyString(report, "version", value);
  if (!VERSION_PATTERN.test(stringValue)) {
    report(`version must match v<major>.<minor>.<patch>, got ${JSON.stringify(stringValue)}`);
  }
  return stringValue;
};

const assertSafePinComponent = (report: Reporter, label: string, relativePath: string): void => {
  try {
    assertSafeRelativePath(label, relativePath);
  } catch (error: unknown) {
    report(errorMessage(error));
  }
};

const validateVendoredFileEntry = (report: Reporter, vendoredPath: string, entry: unknown): VendoredFilePin => {
  const entryLabel = `vendoredFiles[${JSON.stringify(vendoredPath)}]`;
  assertSafePinComponent(report, `${entryLabel} key`, vendoredPath);
  if (!isPlainObject(entry)) {
    report(`${entryLabel} must be an object`);
  }
  assertExactKeys(report, { allowed: VENDORED_FILE_ALLOWED_FIELDS, label: entryLabel }, entry as Record<string, unknown>);
  const record = entry as Record<string, unknown>;
  const sourcePath = assertNonEmptyString(report, `${entryLabel}.sourcePath`, record.sourcePath);
  assertSafePinComponent(report, `${entryLabel}.sourcePath`, sourcePath);
  const sha256 = assertSha256(report, `${entryLabel}.sha256`, record.sha256);
  return { sha256, sourcePath };
};

const validateVendoredFiles = (report: Reporter, vendoredFiles: unknown): Record<string, VendoredFilePin> => {
  if (!isPlainObject(vendoredFiles)) {
    report("vendoredFiles must be an object");
  }
  const entries = Object.entries(vendoredFiles as Record<string, unknown>);
  if (entries.length === 0) {
    report("vendoredFiles must not be empty");
  }
  return Object.fromEntries(
    entries.map(([vendoredPath, entry]) => [vendoredPath, validateVendoredFileEntry(report, vendoredPath, entry)]),
  );
};

const validatePin = (report: Reporter, value: unknown): OrgLintConfigPin => {
  if (!isPlainObject(value)) {
    report("must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  assertExactKeys(report, PIN_FIELDS, record);
  return {
    archiveSha256: assertSha256(report, "archiveSha256", record.archiveSha256),
    vendoredFiles: validateVendoredFiles(report, record.vendoredFiles),
    version: assertVersion(report, record.version),
  };
};

const loadPin = (projectRoot: string): OrgLintConfigPin => {
  const pinPath = path.join(projectRoot, PIN_FILENAME);
  const report = makeReporter(pinPath);
  return validatePin(report, parseJson(pinPath, readPinFile(pinPath)));
};

module.exports = { PIN_FILENAME, loadPin };
