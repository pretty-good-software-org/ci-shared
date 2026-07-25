const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

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

interface Result {
  status: number | null;
  stderr: string;
  stdout: string;
}

const verifierEnvironment = (fixture: Fixture): NodeJS.ProcessEnv => ({
  ...process.env,
  FAKE_APM_FIRST_LOCK: fixture.firstLock,
  FAKE_APM_LOG: fixture.log,
  FAKE_APM_SECOND_LOCK: fixture.secondLock,
  FAKE_APM_SENTINEL: fixture.sentinel,
  FAKE_APM_STATE: fixture.state,
  GITHUB_TOKEN: "read-only-test-token",
  RUNNER_TEMP: resolve(fixture.repository, ".."),
});

const executeVerifier = (fixture: Fixture, env: NodeJS.ProcessEnv): Result => {
  const result = spawnSync(verifier, [fixture.repository, fixture.fakeApm], {
    cwd: fixture.repository,
    encoding: "utf8",
    env,
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const verifyFixture = (fixture: Fixture): Result => executeVerifier(fixture, verifierEnvironment(fixture));

const verifyFixtureWithoutToken = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.GITHUB_TOKEN = "";
  return executeVerifier(fixture, env);
};

const verifyFixtureWithoutDocReadme = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.FAKE_APM_OMIT_CONSUMER_SKILL = "doc-readme";
  return executeVerifier(fixture, env);
};

const verifyFixtureWithPiProjection = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.FAKE_APM_CREATE_PI_PROJECTION = "1";
  return executeVerifier(fixture, env);
};

const normalizedCommandLog = (path: string): string =>
  readFileSync(path, "utf8").replace(/marketplace add .*\/marketplace --name/g, "marketplace add <marketplace> --name");

module.exports = {
  normalizedCommandLog,
  verifyFixture,
  verifyFixtureWithPiProjection,
  verifyFixtureWithoutDocReadme,
  verifyFixtureWithoutToken,
};
