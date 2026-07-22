const { readFileSync } = require("node:fs");
const path = require("node:path");

import type { OrgLintConfigPin } from "./pin-types.ts";

const PIN_FILENAME = ".org-lint-config.json";

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const readPinFile = (pinPath: string): string => {
  try {
    return readFileSync(pinPath, "utf8");
  } catch (error: unknown) {
    throw new Error(`read org-lint-config pin ${pinPath}: ${errorMessage(error)}`, { cause: error });
  }
};

const parsePinFile = (pinPath: string, raw: string): OrgLintConfigPin => {
  try {
    return JSON.parse(raw) as OrgLintConfigPin;
  } catch (error: unknown) {
    throw new Error(`parse org-lint-config pin ${pinPath}: invalid JSON`, { cause: error });
  }
};

const loadPin = (projectRoot: string): OrgLintConfigPin => {
  const pinPath = path.join(projectRoot, PIN_FILENAME);
  return parsePinFile(pinPath, readPinFile(pinPath));
};

module.exports = { PIN_FILENAME, loadPin };
