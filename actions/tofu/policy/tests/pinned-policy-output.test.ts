// Live regression: the loaded-test count must stay readable in the real output.
// Conftest colours its summary even when stdout is a pipe or a file.
// The count is read back out of that summary.
// Colour codes land between the newline and the digits.
// An unpinned invocation therefore makes a clean run look like a missing summary.

import type { LiveFixture } from "./live-policy-types";

const { it } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const { withLiveFixture } = require("./live-policy-fixture.ts");
const { runLivePolicy, withoutColorPin } = require("./live-policy-exec.ts");

const CLEAN_CONFIG = 'namespace = ["policies.s3"]\n';
const MISSING_SUMMARY =
  "Policy integrity check failed: conftest did not report a loaded-test count; refusing to trust the policy result";
const ESCAPE = "\u001b";

// The pattern the action reads the loaded-test count with.
const POLICY_SUMMARY_PATTERN = /(?:^|\n)\s*(\d+) tests?,/;

const summaryOf = (checkout: string, extraArguments: string[]): string => {
  const args = ["test", "--policy", "policy", "--namespace", "policies.s3", ...extraArguments, "plan.json"];
  return execFileSync("conftest", args, { cwd: checkout, encoding: "utf8", stdio: "pipe" });
};

it("colours its summary even when stdout is a pipe", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const output = summaryOf(fixture.checkout, []);
    assert.ok(output.includes(ESCAPE), "conftest writes colour codes to a non-terminal stdout");
    assert.strictEqual(POLICY_SUMMARY_PATTERN.test(output), false, "colour codes hide the loaded-test count");
  });
});

it("writes a readable summary when colour is disabled", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const output = summaryOf(fixture.checkout, ["--no-color"]);
    assert.ok(!output.includes(ESCAPE), "--no-color must remove the colour codes");
    assert.strictEqual(POLICY_SUMMARY_PATTERN.test(output), true, "the count must be readable");
  });
});

it("reads the loaded-test count from a real clean run", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture, { silentPolicy: true });
    assert.strictEqual(rejection, "", "a clean pinned run must not fail on integrity");
    assert.strictEqual(outputs["has_violations"], "false", "a clean run must report no violations");
  });
});

it("control: without the no-color pin a real clean run reports no readable test count", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const { rejection } = await runLivePolicy(fixture, { silentPolicy: true, transform: withoutColorPin });
    assert.strictEqual(rejection, MISSING_SUMMARY, "coloured output must be what breaks the count");
  });
});
