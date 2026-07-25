const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { addMarketplaceSymlink, cleanTemporaryDirectories, createFixture } = require("./fixture.ts");
const {
  verifyFixture,
  verifyFixtureWithForbiddenPath,
  verifyFixtureWithMissingEntry,
  verifyFixtureWithSymlinkEntry,
  verifyFixtureWithUnsafeMarketplacePath,
  verifyFixtureWithoutToken,
} = require("./harness.ts");

afterEach(cleanTemporaryDirectories);

describe("generic isolated APM consumer", () => {
  it("accepts the exact expected projection without running lifecycle scripts", () => {
    const fixture = createFixture();
    const result = verifyFixture(fixture);
    assert.deepStrictEqual(result, {
      status: 0,
      stderr: "",
      stdout: "APM consumer example-bundle@example-marketplace installed the expected .agents/skills projection\n",
    });
    assert.equal(existsSync(fixture.sentinel), false, "candidate lifecycle scripts must remain suppressed");
    const commands = readFileSync(fixture.log, "utf8").replace(
      /marketplace add .* --name/,
      "marketplace add <path> --name",
    );
    assert.equal(
      commands,
      "marketplace add <path> --name example-marketplace\ninstall example-bundle@example-marketplace\n",
      "consumer must register one isolated marketplace and install one qualified package",
    );
  });
});

describe("consumer projection contract", () => {
  it("rejects a missing expected entry", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithMissingEntry(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /-skill-b/);
    assert.match(result.stderr, /projection entries differ from EXPECTED_ENTRIES/);
  });

  it("rejects a forbidden consumer path", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithForbiddenPath(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden consumer path exists: \.pi\/skills/);
  });

  it("rejects a symbolic-link projection entry", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithSymlinkEntry(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /projection entry skill-b must be a regular directory/);
  });
});

describe("consumer trust boundary", () => {
  it("rejects a marketplace path containing a symbolic link", () => {
    const fixture = createFixture();
    addMarketplaceSymlink(fixture);
    const result = verifyFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /marketplace path contains a symbolic link/);
  });

  it("rejects marketplace path traversal before invoking APM", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithUnsafeMarketplacePath(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MARKETPLACE_PATH contains an unsafe path component/);
    assert.equal(existsSync(fixture.log), false, "APM must not run for an unsafe marketplace path");
  });

  it("fails closed when the private contents token is absent", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithoutToken(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GITHUB_TOKEN must be set/);
  });
});

describe("shared action ownership", () => {
  it("keeps shared APM action code free of product and organization identities", () => {
    const sources = [
      "actions/apm/path-validation.sh",
      "actions/apm/verify-consumer/action.yml",
      "actions/apm/verify-consumer/verify-consumer.sh",
      "actions/apm/verify-lock/action.yml",
      "actions/apm/verify-lock/verify-lock.sh",
    ];
    const sharedCode = sources.map((path) => readFileSync(path, "utf8")).join("\n");
    assert.doesNotMatch(sharedCode, /doc-update|pretty-good|platform-|agent-skills-development/i);
  });
});
