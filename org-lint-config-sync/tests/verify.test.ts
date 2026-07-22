const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { describeFailure, verify } = require("../verify.ts");
const { temporaryProjectRoot, writePin, writeVendoredFile } = require("./fixture-helpers.ts");

const sha256 = (contents: string): string => createHash("sha256").update(contents).digest("hex");

const SHA256_HEX_LENGTH = 64;
const VENDORED_PATH = ".lint/configs/yamllint.yml";
const CONTENTS = "extends: default\n";

const setupProject = (context: TestContext, contents = CONTENTS): string => {
  const projectRoot = temporaryProjectRoot(context);
  writePin(projectRoot, {
    archiveSha256: "a".repeat(SHA256_HEX_LENGTH),
    vendoredFiles: { [VENDORED_PATH]: { sha256: sha256(contents), sourcePath: "configs/yamllint.yml" } },
    version: "v1.0.0",
  });
  writeVendoredFile(projectRoot, VENDORED_PATH, contents);
  return projectRoot;
};

describe("org-lint-config verify: matching vendored files", () => {
  it("passes when the vendored file matches its pinned SHA-256", (context: TestContext) => {
    const projectRoot = setupProject(context);
    assert.deepStrictEqual(verify(projectRoot), [], "a byte-exact vendored file must produce no failures");
  });
});

describe("org-lint-config verify: a single drifted vendored file", () => {
  it("fails when the vendored file content drifts from its pin", (context: TestContext) => {
    const projectRoot = setupProject(context);
    writeVendoredFile(projectRoot, VENDORED_PATH, `${CONTENTS}rules:\n  extra: true\n`);

    const failures = verify(projectRoot);

    assert.strictEqual(failures.length, 1, "a single mutated vendored file must produce exactly one failure");
    assert.strictEqual(
      failures[0].reason,
      "mismatch",
      "drifted content must be reported as a mismatch, not silently accepted",
    );
    assert.strictEqual(failures[0].vendoredPath, VENDORED_PATH);
  });
});

describe("org-lint-config verify: multiple drifted vendored files", () => {
  it("reports every drifted file, not just the first", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const secondPath = ".lint/configs/other.yml";
    const expectedFailureCount = 2;
    writePin(projectRoot, {
      archiveSha256: "a".repeat(SHA256_HEX_LENGTH),
      vendoredFiles: {
        [VENDORED_PATH]: { sha256: sha256(CONTENTS), sourcePath: "configs/yamllint.yml" },
        [secondPath]: { sha256: sha256("other\n"), sourcePath: "configs/other.yml" },
      },
      version: "v1.0.0",
    });
    writeVendoredFile(projectRoot, VENDORED_PATH, "mutated\n");
    writeVendoredFile(projectRoot, secondPath, "also mutated\n");

    assert.strictEqual(
      verify(projectRoot).length,
      expectedFailureCount,
      "every mismatched vendored file must be reported independently",
    );
  });
});

describe("org-lint-config verify: missing vendored files", () => {
  it("fails when the pinned vendored file is missing from disk", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writePin(projectRoot, {
      archiveSha256: "a".repeat(SHA256_HEX_LENGTH),
      vendoredFiles: { [VENDORED_PATH]: { sha256: sha256(CONTENTS), sourcePath: "configs/yamllint.yml" } },
      version: "v1.0.0",
    });

    const failures = verify(projectRoot);

    assert.strictEqual(failures.length, 1, "a missing vendored file must be reported, not skipped");
    assert.strictEqual(failures[0].reason, "missing");
  });
});

describe("org-lint-config verify: non-missing read errors", () => {
  it("propagates a real read failure instead of reporting it as an ordinary missing file", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writePin(projectRoot, {
      archiveSha256: "a".repeat(SHA256_HEX_LENGTH),
      vendoredFiles: { [VENDORED_PATH]: { sha256: sha256(CONTENTS), sourcePath: "configs/yamllint.yml" } },
      version: "v1.0.0",
    });
    mkdirSync(path.join(projectRoot, VENDORED_PATH), { recursive: true });

    assert.throws(
      () => verify(projectRoot),
      /read/,
      "a directory where a file is expected must surface as an error, not as reason: 'missing'",
    );
  });
});

describe("org-lint-config verify: failure message formatting", () => {
  it("formats a missing failure and a mismatch failure with distinct, actionable messages", () => {
    const missing = describeFailure({ expectedSha256: "abc", reason: "missing", vendoredPath: ".lint/x.yml" });
    const mismatch = describeFailure({
      actualSha256: "def",
      expectedSha256: "abc",
      reason: "mismatch",
      vendoredPath: ".lint/x.yml",
    });

    assert.match(missing, /missing/);
    assert.match(mismatch, /mismatch/);
    assert.notStrictEqual(missing, mismatch, "missing and mismatch must be distinguishable in output");
  });
});
