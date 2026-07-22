const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const workflowPath = resolve(".github/workflows/template-guard.yml");

const readWorkflow = (): string => readFileSync(workflowPath, "utf8");

const requireBlock = (block: string | undefined, message: string): string => {
  assert.ok(block, message);
  return block as string;
};

describe("template guard reusable workflow runner policy", () => {
  it("defaults callers to the GitHub-hosted ARM runner", () => {
    const workflow = readWorkflow();
    const workflowCall = requireBlock(
      workflow.match(/\n  workflow_call:\n([\s\S]*?)\nenv:/)?.[1],
      "the workflow must define workflow_call inputs before env",
    );
    const runnerInput = requireBlock(
      workflowCall.match(/\n      runner:\n([\s\S]*?)(?=\n      [a-z]|$)/)?.[0],
      "workflow_call.inputs must define the runner input",
    );

    assert.match(
      runnerInput,
      /description:.*\n\s+required: false\n\s+type: string\n\s+default: '\["ubuntu-24\.04-arm"\]'/,
      "the runner input must keep public callers on the hosted ARM default",
    );
  });

  it("resolves an explicit caller-provided runner label array", () => {
    const workflow = readWorkflow();
    const guardJob = requireBlock(workflow.match(/\n  guard:\n([\s\S]*)$/)?.[0], "jobs must define the guard job");

    assert.match(
      guardJob,
      /runs-on: \$\{\{ fromJSON\(inputs\.runner\) \}\}/,
      "jobs.guard.runs-on must route from the caller's JSON runner labels",
    );
  });
});

describe("template guard reusable workflow implementation", () => {
  it("invokes the merged rumdl-capable guard implementation", () => {
    const workflow = readWorkflow();

    assert.match(
      workflow,
      /^        uses: pretty-good-software-org\/ci-shared\/actions\/guard@852a39af805f72d56d07da43efb9c0a8a559958d$/m,
      "the reusable workflow must pin the merged guard implementation instead of a stale commit",
    );
  });
});
