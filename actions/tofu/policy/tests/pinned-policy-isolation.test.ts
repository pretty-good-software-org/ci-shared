// Live regressions: consumer configuration keys must not steer the evaluation.
// Keys the action states as flags are covered by the environment regressions.
// This file covers a key with no flag of its own.
// There the isolated configuration file is the only thing between it and a clean report.
//
// Each guarded case is paired with a control that removes only the isolated config.
// The controls assert current conftest behaviour.
// If a conftest bump breaks one, the premise of this pin has changed.

import type { LiveFixture } from "./live-policy-types";

const { it } = require("node:test");
const assert = require("node:assert");
const { CHECKED_IN_MARKER, PINNED_DENIAL, withLiveFixture } = require("./live-policy-fixture.ts");
const { checkedInPolicyText, runLivePolicy, withoutConfigIsolation } = require("./live-policy-exec.ts");

// Combining changes the shape of the document the policy is evaluated against.
// A rule written for a plan stops matching, so nothing is denied.
const COMBINE_CONFIG = 'namespace = ["policies.s3"]\ncombine = true\n';
const REDIRECT_CONFIG = 'namespace = ["policies.s3"]\npolicy = ["checked-in-policy"]\n';

const assertVerifiedDenial = (outputs: Record<string, string>, rejection: string): void => {
  assert.strictEqual(rejection, "", "a pinned run must not fail on integrity");
  assert.strictEqual(outputs["has_violations"], "true", "the verified policy must still reject the plan");
  assert.match(outputs["policy_violations"], new RegExp(PINNED_DENIAL), "the verified denial must be reported");
};

it("control: without the isolated config a `combine` key silences the verified policy", async () => {
  await withLiveFixture(COMBINE_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture, { transform: withoutConfigIsolation });
    assert.strictEqual(rejection, "", "the control must complete without an integrity failure");
    assert.strictEqual(outputs["has_violations"], "false", "the control must report no violations");
    assert.strictEqual(outputs["policy_violations"], "", "the control must report no violation detail");
  });
});

it("evaluates the plan as itself when the checkout asks conftest to combine", async () => {
  await withLiveFixture(COMBINE_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedDenial(outputs, rejection);
  });
});

// A `policy` key is already outranked by the explicit --policy flag.
// This case therefore has no failing control: it guards the flag, not the config.
it("evaluates the verified tree when the checkout redirects the policy path", async () => {
  await withLiveFixture(REDIRECT_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedDenial(outputs, rejection);
    assert.match(checkedInPolicyText(fixture), new RegExp(CHECKED_IN_MARKER), "the checkout must be left untouched");
  });
});
