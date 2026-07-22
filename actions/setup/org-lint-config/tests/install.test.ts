const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");

import type { TestContext } from "node:test";

const { validReleaseArchive } = require("./tar-test-helpers.ts");
const { ASSET_API_URL, RELEASE_API_URL, runAction, temporaryDirectory } = require("./install-test-helpers.ts");

const EXECUTABLE_MASK = 0o111;

const assertReleaseRequests = (requests: { headers: Headers; url: string }[]): void => {
  assert.deepStrictEqual(
    requests.map((request) => request.url),
    [RELEASE_API_URL, ASSET_API_URL],
    "installer must resolve the exact tag and download only the canonical archive asset",
  );
  assert.strictEqual(
    requests[0].headers.get("authorization"),
    "Bearer secret-installation-token",
    "release metadata request must use the short-lived installation token",
  );
  assert.strictEqual(
    requests[1].headers.get("authorization"),
    "Bearer secret-installation-token",
    "archive download request must use the short-lived installation token",
  );
};

const assertPublishedContents = (outputDirectory: string): void => {
  assert.strictEqual(
    readFileSync(path.join(outputDirectory, "lint-standards.toml"), "utf8"),
    "line-length = 120\n",
    "published directory must contain the archive contents without its top-level wrapper",
  );
  assert.strictEqual(
    readFileSync(path.join(outputDirectory, "bin/org-lint"), "utf8"),
    "#!/bin/sh\necho lint\n",
    "published executable must contain the literal release script",
  );
  assert.strictEqual(
    statSync(path.join(outputDirectory, "bin/org-lint")).mode & EXECUTABLE_MASK,
    EXECUTABLE_MASK,
    "published executable must retain all executable bits",
  );
};

describe("org-lint-config verified publication", () => {
  it("downloads the exact release asset and publishes its verified contents", async (context: TestContext) => {
    const outputDirectory = path.join(temporaryDirectory(context), "lint-config");

    const { outputs, requests } = await runAction(outputDirectory, validReleaseArchive());

    assertReleaseRequests(requests);
    assert.strictEqual(outputs.path, outputDirectory, "path output must identify the published directory");
    assertPublishedContents(outputDirectory);
  });
});

describe("org-lint-config idempotency", () => {
  it("accepts the same verified release when it is already installed", async (context: TestContext) => {
    const outputDirectory = path.join(temporaryDirectory(context), "lint-config");
    const archive = validReleaseArchive();
    await runAction(outputDirectory, archive);

    const { outputs } = await runAction(outputDirectory, archive);

    assert.strictEqual(outputs.path, outputDirectory, "an identical existing install must be accepted");
    assert.deepStrictEqual(
      readdirSync(outputDirectory).toSorted(),
      ["bin", "lint-standards.toml"],
      "idempotent install must leave the verified output unchanged",
    );
  });
});
