const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { parseInputs } = require("../parse-inputs.ts");

const SHA256_HEX_LENGTH = 64;
const SHORT_DIGEST_LENGTH = SHA256_HEX_LENGTH - 1;
const LONG_DIGEST_LENGTH = SHA256_HEX_LENGTH + 1;
const TEST_NAME_DIGEST_LENGTH = 40;

const validEnvironment = (): NodeJS.ProcessEnv => ({
  INPUT_OUTPUT_DIRECTORY: "./.lint-config",
  INPUT_SHA256: "a".repeat(SHA256_HEX_LENGTH),
  INPUT_TOKEN: "installation-token",
  INPUT_VERSION: "v1.0.0",
});

const invalidDigests = [
  "",
  "a".repeat(SHORT_DIGEST_LENGTH),
  "a".repeat(LONG_DIGEST_LENGTH),
  "A".repeat(SHA256_HEX_LENGTH),
  `sha256:${"a".repeat(SHA256_HEX_LENGTH)}`,
];

describe("org-lint-config version input", () => {
  for (const version of ["", "1.0.0", "v1.0", "v1.0.0-beta", "v1.0.0 "]) {
    it(`rejects invalid version ${JSON.stringify(version)}`, () => {
      const env = { ...validEnvironment(), INPUT_VERSION: version };
      assert.throws(
        () => parseInputs(env),
        /INPUT_VERSION (?:is required|must be an exact release tag)/,
        "version must be a literal stable v1.0.0-style tag",
      );
    });
  }
});

describe("org-lint-config digest input", () => {
  for (const digest of invalidDigests) {
    it(`rejects invalid digest ${JSON.stringify(digest).slice(0, TEST_NAME_DIGEST_LENGTH)}`, () => {
      const env = { ...validEnvironment(), INPUT_SHA256: digest };
      assert.throws(
        () => parseInputs(env),
        /INPUT_SHA256 (?:is required|must be exactly 64 lowercase hexadecimal characters)/,
        "digest must be a literal lowercase 64-character SHA-256",
      );
    });
  }
});

describe("org-lint-config required inputs", () => {
  for (const name of ["INPUT_TOKEN", "INPUT_OUTPUT_DIRECTORY"]) {
    it(`rejects missing ${name}`, () => {
      const env = validEnvironment();
      delete env[name];
      assert.throws(() => parseInputs(env), new RegExp(`${name} is required`), `${name} must be required`);
    });
  }
});
