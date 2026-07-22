const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { regenerate } = require("../regenerate.ts");
const { atomicWrite } = require("../publish.ts");
const { temporaryProjectRoot, writePin } = require("./fixture-helpers.ts");
const { tarGzip } = require("../../actions/setup/org-lint-config/tests/tar-test-helpers.ts");

const sha256 = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

const SHA256_HEX_LENGTH = 64;
const VERSION = "v1.0.0";
const YAML_CONTENTS = "extends: default\n";

const buildArchive = (): Buffer => {
  const root = `org-lint-config-${VERSION}`;
  return tarGzip([
    { mode: 0o755, name: `${root}/`, type: "5" },
    { mode: 0o755, name: `${root}/configs/`, type: "5" },
    { data: YAML_CONTENTS, name: `${root}/configs/yamllint.yml`, type: "0" },
  ]);
};

const pinFor = (archive: Buffer) => ({
  archiveSha256: sha256(archive),
  vendoredFiles: {
    ".lint/configs/yamllint.yml": { sha256: sha256(Buffer.from(YAML_CONTENTS)), sourcePath: "configs/yamllint.yml" },
  },
  version: VERSION,
});

// Fakes only the network boundary (`gh release download`) by writing the prepared fixture
// Archive to the requested --dir; `tar` runs for real so extraction is genuinely exercised.
const fakeGhAndRealTar =
  (archive: Buffer) =>
  (bin: string, args: string[]): void => {
    if (bin === "gh") {
      const dir = args[args.indexOf("--dir") + 1];
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `org-lint-config-${VERSION}.tar.gz`), archive);
      return;
    }
    execFileSync(bin, args, { stdio: "ignore" });
  };

describe("org-lint-config regenerate: success", () => {
  it("writes the vendored file when the archive and file hashes match their pins", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const archive = buildArchive();
    writePin(projectRoot, pinFor(archive));

    const written = regenerate(projectRoot, fakeGhAndRealTar(archive), atomicWrite);

    assert.deepStrictEqual(written, [".lint/configs/yamllint.yml"]);
    assert.strictEqual(
      readFileSync(path.join(projectRoot, ".lint/configs/yamllint.yml"), "utf8"),
      YAML_CONTENTS,
      "regenerate must write the exact extracted bytes",
    );
  });
});

describe("org-lint-config regenerate: archive verification failure", () => {
  it("refuses to write any file when the downloaded archive fails its SHA-256 pin", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const archive = buildArchive();
    const pin = pinFor(archive);
    pin.archiveSha256 = "0".repeat(SHA256_HEX_LENGTH);
    writePin(projectRoot, pin);

    assert.throws(
      () => regenerate(projectRoot, fakeGhAndRealTar(archive), atomicWrite),
      /archive/,
      "an archive hash mismatch must abort before any vendored file is written",
    );
    assert.strictEqual(
      existsSync(path.join(projectRoot, ".lint/configs/yamllint.yml")),
      false,
      "no vendored file may be written when the archive fails verification",
    );
  });
});

describe("org-lint-config regenerate: per-file verification failure", () => {
  it("refuses to write a file whose extracted content diverges from its per-file pin", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const archive = buildArchive();
    const pin = pinFor(archive);
    pin.vendoredFiles[".lint/configs/yamllint.yml"].sha256 = "1".repeat(SHA256_HEX_LENGTH);
    writePin(projectRoot, pin);

    assert.throws(
      () => regenerate(projectRoot, fakeGhAndRealTar(archive), atomicWrite),
      /SHA-256 mismatch/,
      "a per-file hash mismatch must abort even though the archive itself matched",
    );
    assert.strictEqual(existsSync(path.join(projectRoot, ".lint/configs/yamllint.yml")), false);
  });
});
