const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { loadPin } = require("../pin.ts");
const { temporaryProjectRoot } = require("./fixture-helpers.ts");

const SHA256_HEX_LENGTH = 64;
const VALID_ARCHIVE_SHA256 = "a".repeat(SHA256_HEX_LENGTH);
const VALID_FILE_SHA256 = "b".repeat(SHA256_HEX_LENGTH);

const validPin = () => ({
  archiveSha256: VALID_ARCHIVE_SHA256,
  vendoredFiles: {
    ".lint/configs/yamllint.yml": { sha256: VALID_FILE_SHA256, sourcePath: "configs/yamllint.yml" },
  },
  version: "v1.0.0",
});

const writeRawPin = (projectRoot: string, value: unknown): void => {
  writeFileSync(path.join(projectRoot, ".org-lint-config.json"), JSON.stringify(value));
};

describe("loadPin: valid pin", () => {
  it("loads a well-formed pin unchanged", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const pin = validPin();
    writeRawPin(projectRoot, pin);

    assert.deepStrictEqual(loadPin(projectRoot), pin);
  });
});

describe("loadPin: missing or unknown top-level fields", () => {
  it("rejects a pin missing a required field", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    const { version: _version, ...withoutVersion } = validPin();
    writeRawPin(projectRoot, withoutVersion);

    assert.throws(() => loadPin(projectRoot), /missing field/);
  });

  it("rejects a pin with an unknown extra field", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, { ...validPin(), extra: "nope" });

    assert.throws(() => loadPin(projectRoot), /unknown field/);
  });
});

describe("loadPin: malformed digests and version", () => {
  it("rejects an archiveSha256 that is not 64 lowercase hex characters", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, { ...validPin(), archiveSha256: "not-hex" });

    assert.throws(() => loadPin(projectRoot), /SHA-256/);
  });

  it("rejects an uppercase-hex archiveSha256", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, { ...validPin(), archiveSha256: "A".repeat(SHA256_HEX_LENGTH) });

    assert.throws(() => loadPin(projectRoot), /SHA-256/);
  });

  it("rejects a version that is not v-prefixed semver", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, { ...validPin(), version: "1.0.0" });

    assert.throws(() => loadPin(projectRoot), /version/);
  });
});

describe("loadPin: empty or malformed vendoredFiles", () => {
  it("rejects an empty vendoredFiles map", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, { ...validPin(), vendoredFiles: {} });

    assert.throws(() => loadPin(projectRoot), /must not be empty/);
  });

  it("rejects a vendoredFiles entry with an unknown field", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, {
      ...validPin(),
      vendoredFiles: { "a.yml": { extra: true, sha256: VALID_FILE_SHA256, sourcePath: "a.yml" } },
    });

    assert.throws(() => loadPin(projectRoot), /unknown field/);
  });
});

describe("loadPin: unsafe vendoredPath", () => {
  it("rejects a vendoredPath key that traverses out of the project root", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, {
      ...validPin(),
      vendoredFiles: { "../escape.yml": { sha256: VALID_FILE_SHA256, sourcePath: "a.yml" } },
    });

    assert.throws(() => loadPin(projectRoot), /\.\./);
  });

  it("rejects a vendoredPath key that is absolute", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, {
      ...validPin(),
      vendoredFiles: { "/etc/passwd": { sha256: VALID_FILE_SHA256, sourcePath: "a.yml" } },
    });

    assert.throws(() => loadPin(projectRoot), /relative path/);
  });
});

describe("loadPin: unsafe sourcePath", () => {
  it("rejects a sourcePath that traverses out of the extracted archive root", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, {
      ...validPin(),
      vendoredFiles: { "a.yml": { sha256: VALID_FILE_SHA256, sourcePath: "../../etc/passwd" } },
    });

    assert.throws(() => loadPin(projectRoot), /\.\./);
  });

  it("rejects a sourcePath that is absolute", (context: TestContext) => {
    const projectRoot = temporaryProjectRoot(context);
    writeRawPin(projectRoot, {
      ...validPin(),
      vendoredFiles: { "a.yml": { sha256: VALID_FILE_SHA256, sourcePath: "/etc/passwd" } },
    });

    assert.throws(() => loadPin(projectRoot), /relative path/);
  });
});
