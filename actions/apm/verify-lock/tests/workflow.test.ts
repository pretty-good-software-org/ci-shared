const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const expectedCheckoutSteps = 2;

const assertWorkflowSequence = (workflow: string, expected: string[]): void => {
  let previous = -1;
  for (const value of expected) {
    const current = workflow.indexOf(value);
    assert.ok(current > previous, `${value} must appear in workflow order`);
    previous = current;
  }
};

describe("pinned APM installer", () => {
  it("pins the Linux ARM64 release by URL and reviewed digest", () => {
    const installer = readFileSync("actions/apm/install-apm.sh", "utf8");
    assert.match(installer, /releases\/download\/v\$\{apm_version\}\/apm-linux-arm64\.tar\.gz/);
    assert.match(installer, /c4d6b5ab6d9bdca3c3c324db7ce8d1c4faf7b317f45a55a50ae2571eaa506d25/);
    assert.doesNotMatch(installer, /\/latest\/|curl[^\n]*GITHUB_TOKEN/);
    assert.match(installer, /--connect-timeout[\s\S]*--max-time[\s\S]*--retry-all-errors/);
  });
});

describe("required workflow trust boundary", () => {
  it("uses protected verifier code before minting a read-only package token", () => {
    const workflow = readFileSync(".github/workflows/required-agent-skills-apm-lock.yml", "utf8");
    const workflowSha = ["ref: $", "{{ github.workflow_sha }}"].join("");
    assertWorkflowSequence(workflow, [
      "Check out trusted verifier",
      workflowSha,
      "Check out pull request candidate",
      "Mint private package read token",
      "permission-contents: read",
      "uses: ./trusted-ci/actions/apm/verify-lock",
      "uses: ./trusted-ci/actions/apm/verify-consumer",
    ]);
    assert.doesNotMatch(workflow, /^\s+run:.*mise run|candidate\/.*\.sh|permission-contents: write/m);
    assert.match(workflow, /permissions:\n  contents: read/);
    assert.match(workflow, /concurrency:\n  group: required-agent-skills-apm-lock-/);
    assert.match(workflow, /cancel-in-progress: true/);
    assert.equal(
      workflow.match(/actions\/checkout@[0-9a-f]{40} # v5\.0\.1/g)?.length,
      expectedCheckoutSteps,
      "both checkout steps must identify the exact pinned release",
    );
  });
});
