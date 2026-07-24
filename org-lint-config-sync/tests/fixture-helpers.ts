const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

import type { TestContext } from "node:test";
import type { OrgLintConfigPin } from "../pin-types.ts";

const temporaryProjectRoot = (context: TestContext): string => {
  const root = mkdtempSync(path.join(tmpdir(), "org-lint-config-sync-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  return root;
};

const JSON_INDENT_SPACES = 2;

const writePin = (projectRoot: string, pin: OrgLintConfigPin): void => {
  writeFileSync(path.join(projectRoot, ".org-lint-config.json"), JSON.stringify(pin, undefined, JSON_INDENT_SPACES));
};

const writeVendoredFile = (projectRoot: string, vendoredPath: string, contents: string): void => {
  const filePath = path.join(projectRoot, vendoredPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
};

module.exports = { temporaryProjectRoot, writePin, writeVendoredFile };
