const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const verifier = resolve("actions/apm/verify-consumer/verify-consumer.sh");

interface Fixture {
  fakeApm: string;
  log: string;
  repository: string;
  sentinel: string;
}

interface Result {
  status: number | null;
  stderr: string;
  stdout: string;
}

const verifierEnvironment = (fixture: Fixture): NodeJS.ProcessEnv => ({
  ...process.env,
  EXPECTED_ENTRIES: "skill-a\nskill-b",
  FAKE_APM_LOG: fixture.log,
  FAKE_APM_SENTINEL: fixture.sentinel,
  FORBIDDEN_PATHS: ".pi/skills",
  GITHUB_TOKEN: "read-only-test-token",
  MARKETPLACE_NAME: "example-marketplace",
  MARKETPLACE_PATH: ".claude-plugin",
  PACKAGE: "example-bundle@example-marketplace",
  PROJECTION_PATH: ".agents/skills",
  RUNNER_TEMP: resolve(fixture.repository, ".."),
  TARGET: "agent-skills",
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

const verifyFixtureWithForbiddenPath = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.FAKE_APM_CREATE_FORBIDDEN = "1";
  return executeVerifier(fixture, env);
};

const verifyFixtureWithMissingEntry = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.FAKE_APM_OMIT_ENTRY = "skill-b";
  return executeVerifier(fixture, env);
};

const verifyFixtureWithSymlinkEntry = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.FAKE_APM_SYMLINK_ENTRY = "1";
  return executeVerifier(fixture, env);
};

const verifyFixtureWithUnsafeMarketplacePath = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.MARKETPLACE_PATH = "../outside";
  return executeVerifier(fixture, env);
};

const verifyFixtureWithoutToken = (fixture: Fixture): Result => {
  const env = verifierEnvironment(fixture);
  env.GITHUB_TOKEN = "";
  return executeVerifier(fixture, env);
};

module.exports = {
  verifyFixture,
  verifyFixtureWithForbiddenPath,
  verifyFixtureWithMissingEntry,
  verifyFixtureWithSymlinkEntry,
  verifyFixtureWithUnsafeMarketplacePath,
  verifyFixtureWithoutToken,
};
