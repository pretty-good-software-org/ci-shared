const { readFileSync } = require("node:fs");

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const isMissingFileError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";

// Reads a file that may legitimately not exist yet. Only ENOENT is treated as absence —
// Permission errors, a path that is actually a directory, I/O errors, and anything else are
// Real failures and must never be silently mistaken for "the file doesn't exist".
const readIfExists = (filePath: string): Buffer | undefined => {
  try {
    return readFileSync(filePath);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw new Error(`read ${filePath}: ${errorMessage(error)}`, { cause: error });
  }
};

module.exports = { readIfExists };
