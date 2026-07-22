const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { createCompliantRepository, execute, temporaryDirectories } = require("./fixture.ts");
const { contractScenarios } = require("./contract-scenarios.ts");

const currentChecker = resolve("actions/guard/guard.sh");

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("markdown lint contract boundary", () => {
  for (const scenario of contractScenarios) {
    it(scenario.name, () => {
      const root = createCompliantRepository();
      scenario.configure(root);
      const result = execute(currentChecker, root);
      assert.strictEqual(
        result.status,
        scenario.expectedStatus,
        `${scenario.name} must return ${scenario.expectedStatus}; stdout=${result.stdout}; stderr=${result.stderr}`,
      );
      if (scenario.expectedStatus === 0) {
        assert.match(result.stdout, /template guard passed/, `${scenario.name} must report a passing guard`);
        return;
      }
      assert.match(
        result.stdout,
        /FAIL d - lint default depends on actionlint/,
        `${scenario.name} must fail the lint contract check`,
      );
      if (scenario.expectedError) {
        assert.ok(
          result.stderr.includes(scenario.expectedError),
          `${scenario.name} must report ${scenario.expectedError}; stderr=${result.stderr}`,
        );
      }
    });
  }
});
