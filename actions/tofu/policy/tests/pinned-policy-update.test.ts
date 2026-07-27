// Live regressions: a consumer `update` source must never reach the verified tree.
// Conftest downloads update sources into the first --policy directory.
// It does so before loading any policy.
// Go-getter clears that directory outright when the source names a subdirectory.
// Without this pin that directory is the verified checkout.
//
// Every guarded case is paired with a control that removes only the guard under test.
// The controls assert current conftest behaviour.
// If a conftest bump breaks one, the premise of this pin has changed.

import type { LiveFixture } from "./live-policy-types";

const { it } = require("node:test");
const assert = require("node:assert");
const { PINNED_DENIAL, SUBSTITUTE_MARKER, setConsumerConfig, withLiveFixture } = require("./live-policy-fixture.ts");
const { runLivePolicy, withoutPinning, withoutUpdatePin } = require("./live-policy-exec.ts");

const TREE_CHANGED = "Policy integrity check failed: the verified policy tree changed during evaluation";

const updateConfig = (source: string): string => `namespace = ["policies.s3"]\nupdate = ["${source}"]\n`;

const assertVerifiedPolicyEvaluated = (outputs: Record<string, string>, rejection: string): void => {
  assert.strictEqual(rejection, "", "a pinned run must not fail on integrity");
  assert.strictEqual(outputs["has_violations"], "true", "the verified policy must still reject the plan");
  assert.match(outputs["policy_violations"], new RegExp(PINNED_DENIAL), "the verified denial must be reported");
  assert.doesNotMatch(outputs["policy_violations"], new RegExp(SUBSTITUTE_MARKER), "no substitute may be evaluated");
};

it("control: with the pre-pin invocation a directory update source replaces the verified tree", async () => {
  await withLiveFixture("", async (fixture: LiveFixture) => {
    setConsumerConfig(fixture, updateConfig(`${fixture.directorySource}//policy`));
    const { rejection } = await runLivePolicy(fixture, { transform: withoutPinning });
    assert.strictEqual(rejection, TREE_CHANGED, "the update source must reach and replace the verified tree");
  });
});

it("keeps a directory update source out of the verified tree", async () => {
  await withLiveFixture("", async (fixture: LiveFixture) => {
    setConsumerConfig(fixture, updateConfig(`${fixture.directorySource}//policy`));
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedPolicyEvaluated(outputs, rejection);
  });
});

it("control: with the pre-pin invocation a floating git update source replaces the verified tree", async () => {
  await withLiveFixture("", async (fixture: LiveFixture) => {
    setConsumerConfig(fixture, updateConfig(`git::file://${fixture.gitSource}//policy`));
    const { rejection } = await runLivePolicy(fixture, { transform: withoutPinning });
    assert.strictEqual(rejection, TREE_CHANGED, "the git source must reach and replace the verified tree");
  });
});

it("does not fetch a floating git update source", async () => {
  await withLiveFixture("", async (fixture: LiveFixture) => {
    setConsumerConfig(fixture, updateConfig(`git::file://${fixture.gitSource}//policy`));
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedPolicyEvaluated(outputs, rejection);
  });
});

it("control: without the empty --update pin CONFTEST_UPDATE replaces the verified tree", async () => {
  await withLiveFixture('namespace = ["policies.s3"]\n', async (fixture: LiveFixture) => {
    const env = { ...process.env, CONFTEST_UPDATE: `${fixture.directorySource}//policy` };
    const { rejection } = await runLivePolicy(fixture, { env, transform: withoutUpdatePin });
    assert.strictEqual(rejection, TREE_CHANGED, "the environment source must reach and replace the verified tree");
  });
});

it("ignores an update source supplied through the environment", async () => {
  await withLiveFixture('namespace = ["policies.s3"]\n', async (fixture: LiveFixture) => {
    const env = { ...process.env, CONFTEST_UPDATE: `${fixture.directorySource}//policy` };
    const { outputs, rejection } = await runLivePolicy(fixture, { env });
    assertVerifiedPolicyEvaluated(outputs, rejection);
  });
});
