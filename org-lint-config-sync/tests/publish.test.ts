const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { atomicWrite, publishVendoredFiles } = require("../publish.ts");
const { temporaryProjectRoot } = require("./fixture-helpers.ts");

const SHA256_HEX_LENGTH = 64;
const FIRST_VENDORED_PATH = ".lint/configs/a.yml";
const SECOND_VENDORED_PATH = ".lint/configs/b.yml";

const buildPin = () => ({
  archiveSha256: "a".repeat(SHA256_HEX_LENGTH),
  vendoredFiles: {
    [FIRST_VENDORED_PATH]: { sha256: "b".repeat(SHA256_HEX_LENGTH), sourcePath: "configs/a.yml" },
    [SECOND_VENDORED_PATH]: { sha256: "c".repeat(SHA256_HEX_LENGTH), sourcePath: "configs/b.yml" },
  },
  version: "v1.0.0",
});

const buildExtractedRoot = (context: TestContext, firstContents: string, secondContents: string): string => {
  const extractedRoot = temporaryProjectRoot(context);
  mkdirSync(path.join(extractedRoot, "configs"), { recursive: true });
  writeFileSync(path.join(extractedRoot, "configs/a.yml"), firstContents);
  writeFileSync(path.join(extractedRoot, "configs/b.yml"), secondContents);
  return extractedRoot;
};

// Succeeds through realWrite for every call before failOnCallIndex, then throws before ever
// Touching that call's target — simulating a publish that fails partway through a batch.
const writeThatFailsOnCall = (failOnCallIndex: number) => {
  let callIndex = -1;
  return (targetPath: string, contents: Buffer): void => {
    callIndex += 1;
    if (callIndex === failOnCallIndex) {
      throw new Error("injected publish failure");
    }
    atomicWrite(targetPath, contents);
  };
};

const noTempFilesRemain = (root: string): boolean =>
  readdirSync(path.join(root, ".lint/configs")).every((name: string) => !name.endsWith(".org-lint-config-sync.tmp"));

describe("publishVendoredFiles: fresh targets", () => {
  it("rolls back a first successful publish when the second file fails, leaving neither target on disk", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const extractedRoot = buildExtractedRoot(context, "new-a\n", "new-b\n");
    const pin = buildPin();

    assert.throws(
      () => publishVendoredFiles(projectRoot, { extractedRoot, pin, write: writeThatFailsOnCall(1) }),
      /injected publish failure/,
    );

    assert.strictEqual(existsSync(path.join(projectRoot, FIRST_VENDORED_PATH)), false, "first target must be rolled back");
    assert.strictEqual(existsSync(path.join(projectRoot, SECOND_VENDORED_PATH)), false, "second target was never written");
    assert.ok(noTempFilesRemain(projectRoot), "no staging temp files may remain after a failed publish");
  });
});

describe("publishVendoredFiles: pre-existing targets", () => {
  it("restores the first file's original bytes when the second file fails, byte-identical to before", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const extractedRoot = buildExtractedRoot(context, "new-a\n", "new-b\n");
    mkdirSync(path.join(projectRoot, ".lint/configs"), { recursive: true });
    writeFileSync(path.join(projectRoot, FIRST_VENDORED_PATH), "original-a\n");
    writeFileSync(path.join(projectRoot, SECOND_VENDORED_PATH), "original-b\n");
    const pin = buildPin();

    assert.throws(() => publishVendoredFiles(projectRoot, { extractedRoot, pin, write: writeThatFailsOnCall(1) }));

    assert.strictEqual(
      readFileSync(path.join(projectRoot, FIRST_VENDORED_PATH), "utf8"),
      "original-a\n",
      "a rolled-back file must be byte-identical to its pre-publish content, not new or empty",
    );
    assert.strictEqual(readFileSync(path.join(projectRoot, SECOND_VENDORED_PATH), "utf8"), "original-b\n");
    assert.ok(noTempFilesRemain(projectRoot), "no staging temp files may remain after a failed publish");
  });

  it("publishes both files when every write succeeds", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const extractedRoot = buildExtractedRoot(context, "new-a\n", "new-b\n");
    const pin = buildPin();

    const written = publishVendoredFiles(projectRoot, { extractedRoot, pin, write: atomicWrite });

    assert.deepStrictEqual(written.toSorted(), [FIRST_VENDORED_PATH, SECOND_VENDORED_PATH].toSorted());
    assert.strictEqual(readFileSync(path.join(projectRoot, FIRST_VENDORED_PATH), "utf8"), "new-a\n");
    assert.strictEqual(readFileSync(path.join(projectRoot, SECOND_VENDORED_PATH), "utf8"), "new-b\n");
    assert.ok(noTempFilesRemain(projectRoot), "no staging temp files may remain after a successful publish");
  });
});
