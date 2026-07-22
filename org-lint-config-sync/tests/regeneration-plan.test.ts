const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { describeRegenerationFailure, planRegeneration } = require("../regeneration-plan.ts");

const SHA256_HEX_LENGTH = 64;
const PIN = {
  archiveSha256: "a".repeat(SHA256_HEX_LENGTH),
  vendoredFiles: {
    ".lint/configs/yamllint.yml": { sha256: "b".repeat(SHA256_HEX_LENGTH), sourcePath: "configs/yamllint.yml" },
  },
  version: "v1.0.0",
};

describe("org-lint-config regeneration plan: clean state", () => {
  it("produces no failures when the archive and every file hash match their pins", () => {
    const failures = planRegeneration(PIN, PIN.archiveSha256, [
      { extractedSha256: "b".repeat(SHA256_HEX_LENGTH), vendoredPath: ".lint/configs/yamllint.yml" },
    ]);
    assert.deepStrictEqual(failures, [], "matching archive and file hashes must regenerate cleanly");
  });
});

describe("org-lint-config regeneration plan: archive verification", () => {
  it("fails on archive mismatch and never trusts per-file hashes from an unverified archive", () => {
    const failures = planRegeneration(PIN, "c".repeat(SHA256_HEX_LENGTH), [
      { extractedSha256: "would-otherwise-be-skipped", vendoredPath: ".lint/configs/yamllint.yml" },
    ]);

    assert.strictEqual(failures.length, 1, "an archive mismatch must short-circuit before any file is trusted");
    assert.strictEqual(failures[0].reason, "archive-mismatch");
  });
});

describe("org-lint-config regeneration plan: file verification", () => {
  it("fails when a single vendored file's extracted hash diverges from its pin, even with a matching archive", () => {
    const failures = planRegeneration(PIN, PIN.archiveSha256, [
      { extractedSha256: "c".repeat(SHA256_HEX_LENGTH), vendoredPath: ".lint/configs/yamllint.yml" },
    ]);

    assert.strictEqual(failures.length, 1);
    assert.strictEqual(failures[0].reason, "file-mismatch");
    assert.strictEqual(failures[0].vendoredPath, ".lint/configs/yamllint.yml");
  });

  it("fails on an extracted file with no pin entry instead of writing it unpinned", () => {
    const failures = planRegeneration(PIN, PIN.archiveSha256, [
      { extractedSha256: "d".repeat(SHA256_HEX_LENGTH), vendoredPath: ".lint/configs/unpinned.yml" },
    ]);

    assert.strictEqual(failures.length, 1);
    assert.strictEqual(failures[0].reason, "unpinned-file");
  });
});

describe("org-lint-config regeneration plan: failure message formatting", () => {
  it("formats archive-mismatch, file-mismatch, and unpinned-file failures distinctly", () => {
    const archive = describeRegenerationFailure({
      actualSha256: "c".repeat(SHA256_HEX_LENGTH),
      expectedSha256: "a".repeat(SHA256_HEX_LENGTH),
      reason: "archive-mismatch",
    });
    const file = describeRegenerationFailure({
      actualSha256: "c".repeat(SHA256_HEX_LENGTH),
      expectedSha256: "b".repeat(SHA256_HEX_LENGTH),
      reason: "file-mismatch",
      vendoredPath: ".lint/x.yml",
    });
    const unpinned = describeRegenerationFailure({
      actualSha256: "d".repeat(SHA256_HEX_LENGTH),
      expectedSha256: "(unpinned)",
      reason: "unpinned-file",
      vendoredPath: ".lint/y.yml",
    });

    assert.match(archive, /archive/);
    assert.match(file, /SHA-256 mismatch/);
    assert.match(unpinned, /no pin entry/);
  });
});
