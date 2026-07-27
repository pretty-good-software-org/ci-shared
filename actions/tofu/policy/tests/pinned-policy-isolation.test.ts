// Live regressions: consumer configuration keys must not steer the evaluation.
// These keys have no flag of their own in the action.
// The isolated configuration file is the only thing between them and a clean report.
//
// Each guarded case is paired with a control that removes only the isolated config.
// The controls assert current conftest behaviour.
// If a conftest bump breaks one, the premise of this pin has changed.

import type { LiveFixture } from "./live-policy-types";

const { it } = require("node:test");
const assert = require("node:assert");
const { CHECKED_IN_MARKER, PINNED_DENIAL, withLiveFixture } = require("./live-policy-fixture.ts");
const { checkedInPolicyText, runLivePolicy, withoutConfigIsolation } = require("./live-policy-exec.ts");

const REDIRECT_CONFIG = 'namespace = ["policies.s3"]\npolicy = ["checked-in-policy"]\n';
const PARSER_CONFIG = 'namespace = ["policies.s3"]\nparser = "ini"\n';
const NO_FAIL_CONFIG = 'namespace = ["policies.s3"]\n"no-fail" = true\n';

const assertVerifiedDenial = (outputs: Record<string, string>, rejection: string): void => {
  assert.strictEqual(rejection, "", "a pinned run must not fail on integrity");
  assert.strictEqual(outputs["has_violations"], "true", "the verified policy must still reject the plan");
  assert.match(outputs["policy_violations"], new RegExp(PINNED_DENIAL), "the verified denial must be reported");
};

// A silenced run is the failure this pin exists to prevent.
// Conftest reports a clean plan, the action reports no violations, nothing looks wrong.
const assertPlanSilenced = (outputs: Record<string, string>, rejection: string): void => {
  assert.strictEqual(rejection, "", "the control must complete without an integrity failure");
  assert.strictEqual(outputs["has_violations"], "false", "the control must report no violations");
  assert.strictEqual(outputs["policy_violations"], "", "the control must report no violation detail");
};

// A `policy` key is already outranked by the explicit --policy flag.
// This case therefore has no failing control: it guards the flag, not the config.
it("evaluates the verified tree when the checkout redirects the policy path", async () => {
  await withLiveFixture(REDIRECT_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedDenial(outputs, rejection);
    assert.match(checkedInPolicyText(fixture), new RegExp(CHECKED_IN_MARKER), "the checkout must be left untouched");
  });
});

it("control: without the isolated config a `parser` key reduces the plan to nothing", async () => {
  await withLiveFixture(PARSER_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture, { transform: withoutConfigIsolation });
    assertPlanSilenced(outputs, rejection);
  });
});

it("parses the plan as itself when the checkout declares another parser", async () => {
  await withLiveFixture(PARSER_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedDenial(outputs, rejection);
  });
});

it("control: without the isolated config a `no-fail` key hides violations behind exit zero", async () => {
  await withLiveFixture(NO_FAIL_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture, { transform: withoutConfigIsolation });
    assert.strictEqual(rejection, "", "the control must complete without an integrity failure");
    assert.strictEqual(outputs["has_violations"], "false", "the control must report no violations");
  });
});

it("reports violations when the checkout declares no-fail", async () => {
  await withLiveFixture(NO_FAIL_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture);
    assertVerifiedDenial(outputs, rejection);
  });
});
