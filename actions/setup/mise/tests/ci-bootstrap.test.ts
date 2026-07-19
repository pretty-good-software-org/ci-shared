const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const workflow = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
const checkoutSha = "93cb6efe18208431cddfb8368fd83d5badbf9bfd";
const checkoutStep = `uses: actions/checkout@${checkoutSha} # v5`;
const localSetupStep = "uses: ./actions/setup/mise";
const jobs = ["test", "lint", "build"];

const jobBlock = (job: string): string => {
  const header = `  ${job}:\n`;
  const start = workflow.indexOf(header);
  assert.notEqual(start, -1, `${job} job must exist in the CI workflow`);

  const bodyStart = start + header.length;
  const nextJob = workflow.slice(bodyStart).search(/\n  [a-z][a-z0-9-]*:\n/);
  if (nextJob === -1) {
    return workflow.slice(start);
  }
  return workflow.slice(start, bodyStart + nextJob + 1);
};

const assertJobBootstrap = (job: string): void => {
  const block = jobBlock(job);
  const checkoutIndex = block.indexOf(checkoutStep);
  const localSetupIndex = block.indexOf(localSetupStep);
  const miseEnvironmentIndex = block.indexOf("mise-env: ci");

  assert.notEqual(checkoutIndex, -1, `${job} job must use the exact pinned checkout SHA`);
  assert.notEqual(localSetupIndex, -1, `${job} job must use the PR-local setup/mise action`);
  assert.ok(localSetupIndex > checkoutIndex, `${job} job must run the local setup action after checkout`);
  assert.ok(miseEnvironmentIndex > localSetupIndex, `${job} job must configure setup/mise with mise-env ci`);
};

describe("CI self-test bootstrap", () => {
  it("checks out the PR before the local setup action in every CI job", () => {
    for (const job of jobs) {
      assertJobBootstrap(job);
    }

    assert.equal(
      workflow.split(checkoutStep).length - 1,
      jobs.length,
      "the exact pinned checkout must be present once in each CI job",
    );
    assert.equal(
      workflow.split(localSetupStep).length - 1,
      jobs.length,
      "the PR-local setup/mise action must be present once in each CI job",
    );
    assert.doesNotMatch(
      workflow,
      /uses: pretty-good-software-org\/ci-shared\/actions\/setup\/mise@v1/,
      "CI bootstrap must not use the published setup/mise v1 action",
    );
  });

  it("documents the two checkouts once for the three self-test jobs", () => {
    const explanation =
      "# Each job first checks out the PR so the PR-local composite is available; setup/mise\n" +
      "      # then checks out again to verify its checkout contract on symlinked runners.";

    assert.equal(workflow.split(explanation).length - 1, 1, "the self-test checkout explanation must appear once");
  });
});
