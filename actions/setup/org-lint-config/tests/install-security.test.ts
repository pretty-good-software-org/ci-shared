const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { runAction, temporaryDirectory } = require("./install-test-helpers.ts");
const { partialTarGzip, tarGzip, validReleaseArchive } = require("./tar-test-helpers.ts");

const SHA256_HEX_LENGTH = 64;
const ARCHIVE_ROOT = "org-lint-config-v1.0.0";
const rootEntry = { mode: 0o755, name: `${ARCHIVE_ROOT}/`, type: "5" };

describe("org-lint-config checksum failure safety", () => {
  it("preserves an existing output directory when checksum verification fails", async (context: TestContext) => {
    const outputDirectory = path.join(temporaryDirectory(context), "lint-config");
    mkdirSync(outputDirectory);
    writeFileSync(path.join(outputDirectory, "keep.txt"), "existing\n");

    await assert.rejects(
      runAction(outputDirectory, validReleaseArchive(), "0".repeat(SHA256_HEX_LENGTH)),
      /SHA-256 mismatch/,
      "checksum mismatch must fail before extraction or publication",
    );

    assert.deepStrictEqual(readdirSync(outputDirectory), ["keep.txt"], "failed install must preserve existing files");
    assert.strictEqual(
      readFileSync(path.join(outputDirectory, "keep.txt"), "utf8"),
      "existing\n",
      "failed install must preserve existing file contents",
    );
  });
});

describe("org-lint-config archive failure safety", () => {
  it("rejects traversal entries without writing outside staging", async (context: TestContext) => {
    const root = temporaryDirectory(context);
    const outputDirectory = path.join(root, "lint-config");
    const archive = tarGzip([rootEntry, { data: "escape", name: `${ARCHIVE_ROOT}/../escaped`, type: "0" }]);

    await assert.rejects(runAction(outputDirectory, archive), /unsafe entry path/, "traversal entry must fail closed");

    assert.strictEqual(existsSync(outputDirectory), false, "traversal failure must not publish partial output");
    assert.strictEqual(existsSync(path.join(root, "escaped")), false, "traversal entry must not escape staging");
  });

  it("rejects symbolic-link entries", async (context: TestContext) => {
    const outputDirectory = path.join(temporaryDirectory(context), "lint-config");
    const archive = tarGzip([rootEntry, { name: `${ARCHIVE_ROOT}/link`, type: "2" }]);

    await assert.rejects(runAction(outputDirectory, archive), /unsupported tar entry type/, "symlink must fail closed");

    assert.strictEqual(existsSync(outputDirectory), false, "symlink failure must not publish partial output");
  });

  it("rejects an archive with a partial tar trailer", async (context: TestContext) => {
    const outputDirectory = path.join(temporaryDirectory(context), "lint-config");
    const archive = partialTarGzip([rootEntry, { data: "partial", name: `${ARCHIVE_ROOT}/file`, type: "0" }]);

    await assert.rejects(runAction(outputDirectory, archive), /tar trailer is missing/, "partial tar must fail closed");

    assert.strictEqual(existsSync(outputDirectory), false, "partial archive must not publish extracted files");
  });
});
