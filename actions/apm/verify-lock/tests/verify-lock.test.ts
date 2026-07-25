const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, writeFileSync } = require("node:fs");
const { cleanTemporaryDirectories, createFixture } = require("./fixture.ts");
const { normalizedCommandLog, verifyFixture, verifyFixtureWithoutToken } = require("./harness.ts");

afterEach(cleanTemporaryDirectories);

describe("complete APM verification sequence", () => {
  it("accepts a lock and consumer that match the trusted expectations", () => {
    const fixture = createFixture();
    const result = verifyFixture(fixture);
    assert.deepStrictEqual(result, {
      status: 0,
      stderr: "",
      stdout: "APM lock matches clean audited resolutions and doc-update-project resolves its specialists\n",
    });
    const expectedCommands = [
      "marketplace add <marketplace> --name pretty-good-skills",
      "install",
      "install --frozen",
      "audit --ci",
      "marketplace add <marketplace> --name pretty-good-skills",
      "install",
      "marketplace add <marketplace> --name pretty-good-skills",
      "install doc-update-project@pretty-good-skills",
      "",
    ].join("\n");
    assert.equal(
      normalizedCommandLog(fixture.log),
      expectedCommands,
      "lock and isolated consumer APM commands must run in order",
    );
  });
});

describe("candidate execution boundary", () => {
  it("disables every candidate APM lifecycle script", () => {
    const fixture = createFixture();
    const result = verifyFixture(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(fixture.sentinel), false, "candidate lifecycle scripts must remain suppressed");
  });

  it("fails closed when the private contents token is absent", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithoutToken(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GITHUB_TOKEN must be set/);
  });
});

describe("lock reproducibility", () => {
  it("rejects a stale committed lock with a local repair command", () => {
    const fixture = createFixture("lock: stale\n");
    const result = verifyFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /-lock: stale\n\+lock: stable/);
    assert.match(result.stderr, /run 'mise run lock:refresh' locally and commit the result/);
  });

  it("rejects nondeterministic clean resolutions", () => {
    const fixture = createFixture();
    writeFileSync(fixture.secondLock, "lock: changed-on-second-resolution\n");
    const result = verifyFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /two clean APM resolutions produced different lockfiles/);
  });
});
