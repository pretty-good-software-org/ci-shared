const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const workflowPath = resolve(".github/workflows/template-guard.yml");

const readWorkflow = (): string => readFileSync(workflowPath, "utf8");

describe("template guard reusable workflow runner policy", () => {
  it("defaults callers to the GitHub-hosted ARM runner", () => {
    const workflow = readWorkflow();

    assert.match(
      workflow,
      /runner:\n\s+description:.*\n\s+required: false\n\s+type: string\n\s+default: '\["ubuntu-24\.04-arm"\]'/,
      "the reusable workflow must keep public callers on the hosted ARM default",
    );
  });

  it("resolves an explicit caller-provided runner label array", () => {
    const workflow = readWorkflow();

    assert.match(
      workflow,
      /runs-on: \$\{\{ fromJSON\(inputs\.runner\) \}\}/,
      "the guard job must route from the caller's JSON runner labels",
    );
  });
});
