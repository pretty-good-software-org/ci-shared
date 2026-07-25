const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { createFixture, temporaryDirectories } = require("./fixture.ts");

const verifier = resolve("actions/apm/verify-lock/verify-lock.sh");

interface Fixture {
  fakeApm: string;
  firstLock: string;
  log: string;
  repository: string;
  secondLock: string;
  sentinel: string;
  state: string;
}

const verify = (fixture: Fixture, token = "read-only-test-token") => {
  const result = spawnSync(verifier, [fixture.repository, fixture.fakeApm], {
    cwd: fixture.repository,
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_APM_FIRST_LOCK: fixture.firstLock,
      FAKE_APM_LOG: fixture.log,
      FAKE_APM_SECOND_LOCK: fixture.secondLock,
      FAKE_APM_SENTINEL: fixture.sentinel,
      FAKE_APM_STATE: fixture.state,
      GITHUB_TOKEN: token,
      MARKETPLACE_NAME: "example-marketplace",
      MARKETPLACE_PATH: ".claude-plugin",
      REPAIR_COMMAND: "task lock:refresh",
      RUNNER_TEMP: resolve(fixture.repository, ".."),
    },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const normalizedCommandLog = (path: string): string =>
  readFileSync(path, "utf8").replace(/marketplace add .*\/marketplace --name/g, "marketplace add <marketplace> --name");

const cleanTemporaryDirectories = (): void => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
};

afterEach(cleanTemporaryDirectories);

describe("successful APM lock verification", () => {
  it("accepts a committed lock that matches two clean audited resolutions", () => {
    const fixture = createFixture();
    const result = verify(fixture);
    assert.deepStrictEqual(result, {
      status: 0,
      stderr: "",
      stdout: "APM lock matches a clean, audited resolution\n",
    });
    const expectedCommands = [
      "marketplace add <marketplace> --name example-marketplace",
      "install",
      "install --frozen",
      "audit --ci",
      "marketplace add <marketplace> --name example-marketplace",
      "install",
      "",
    ].join("\n");
    assert.equal(normalizedCommandLog(fixture.log), expectedCommands, "complete APM sequence must run in order");
  });

  it("disables every candidate APM lifecycle script", () => {
    const fixture = createFixture();
    const result = verify(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(fixture.sentinel), false, "candidate lifecycle scripts must remain suppressed");
  });
});

describe("failed APM lock verification", () => {
  it("rejects a stale committed lock with a local repair command", () => {
    const fixture = createFixture("lock: stale\n");
    const result = verify(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /-lock: stale\n\+lock: stable/);
    assert.match(result.stderr, /run 'task lock:refresh' locally and commit the result/);
  });

  it("rejects nondeterministic clean resolutions", () => {
    const fixture = createFixture();
    writeFileSync(fixture.secondLock, "lock: changed-on-second-resolution\n");
    const result = verify(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /two clean APM resolutions produced different lockfiles/);
  });

  it("fails closed when the private contents token is absent", () => {
    const fixture = createFixture();
    const result = verify(fixture, "");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GITHUB_TOKEN must be set/);
  });
});
