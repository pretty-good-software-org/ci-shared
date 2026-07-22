const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { readIfExists } = require("../optional-read.ts");
const { temporaryProjectRoot } = require("./fixture-helpers.ts");

describe("readIfExists: genuine absence", () => {
  it("returns undefined when the file does not exist", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    assert.strictEqual(readIfExists(path.join(root, "missing.yml")), undefined);
  });
});

describe("readIfExists: real errors are not mistaken for absence", () => {
  it("throws, wrapped with the path, when the path is a directory rather than a file", (context: TestContext) => {
    const root = temporaryProjectRoot(context);
    const directoryPath = path.join(root, "a-directory");
    mkdirSync(directoryPath);

    assert.throws(
      () => readIfExists(directoryPath),
      /read .*a-directory/,
      "an EISDIR (or similar) failure must be reported, not silently treated as a missing file",
    );
  });
});
