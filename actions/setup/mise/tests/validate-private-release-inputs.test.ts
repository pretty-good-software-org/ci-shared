const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const script = resolve("actions/setup/mise/validate-private-release-inputs.sh");
const secretMarker = "sekrit-do-not-print-1234567890";

interface InputEnv {
  INPUT_APP_ID?: string;
  INPUT_PRIVATE_KEY?: string;
  INPUT_PRIVATE_REPOSITORIES?: string;
}

const run = (inputs: InputEnv) =>
  spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      INPUT_APP_ID: "",
      INPUT_PRIVATE_KEY: "",
      INPUT_PRIVATE_REPOSITORIES: "",
      ...inputs,
    },
  });

const fullTuple: InputEnv = {
  INPUT_APP_ID: "123456",
  INPUT_PRIVATE_KEY: secretMarker,
  INPUT_PRIVATE_REPOSITORIES: "skillctl",
};

describe("setup/mise private release input validation — passing tuples", () => {
  it("passes when none of app-id, private-key, private-repositories are set", () => {
    const result = run({});
    assert.equal(result.status, 0, `expected success, got stderr: ${result.stderr}`);
  });

  it("passes when all three are set together", () => {
    const result = run(fullTuple);
    assert.equal(result.status, 0, `expected success, got stderr: ${result.stderr}`);
  });
});

describe("setup/mise private release input validation — only one input set", () => {
  it("fails when only app-id is set", () => {
    const result = run({ INPUT_APP_ID: "123456" });
    assert.notEqual(result.status, 0, "expected a non-zero exit for a partial tuple");
    assert.match(result.stdout, /::error::/, "must fail loudly via a workflow error annotation");
  });

  it("fails when only private-key is set", () => {
    const result = run({ INPUT_PRIVATE_KEY: secretMarker });
    assert.notEqual(result.status, 0, "expected a non-zero exit for a partial tuple");
  });

  it("fails when only private-repositories is set", () => {
    const result = run({ INPUT_PRIVATE_REPOSITORIES: "skillctl" });
    assert.notEqual(result.status, 0, "expected a non-zero exit for a partial tuple");
  });
});

describe("setup/mise private release input validation — two of three inputs set", () => {
  it("fails when private-repositories is missing", () => {
    const result = run({ INPUT_APP_ID: "123456", INPUT_PRIVATE_KEY: secretMarker });
    assert.notEqual(result.status, 0, "app-id and private-key without private-repositories must fail");
  });

  it("fails when private-key is missing", () => {
    const result = run({ INPUT_APP_ID: "123456", INPUT_PRIVATE_REPOSITORIES: "skillctl" });
    assert.notEqual(result.status, 0, "app-id and private-repositories without private-key must fail");
  });

  it("fails when app-id is missing", () => {
    const result = run({ INPUT_PRIVATE_KEY: secretMarker, INPUT_PRIVATE_REPOSITORIES: "skillctl" });
    assert.notEqual(result.status, 0, "private-key and private-repositories without app-id must fail");
  });
});

describe("setup/mise private release input validation — non-exposure", () => {
  it("never prints the private key value, on success or failure", () => {
    const passing = run(fullTuple);
    const failing = run({ INPUT_PRIVATE_KEY: secretMarker });
    assert.doesNotMatch(
      passing.stdout + passing.stderr,
      new RegExp(secretMarker),
      "success path must not echo the key",
    );
    assert.doesNotMatch(
      failing.stdout + failing.stderr,
      new RegExp(secretMarker),
      "failure path must not echo the key",
    );
  });
});
