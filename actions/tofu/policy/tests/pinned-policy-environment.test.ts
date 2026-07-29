// Live regressions for conftest settings inherited from the environment.
// Viper reads CONFTEST_* variables ahead of any configuration file.
// The isolated configuration file cannot shadow them, so the action refuses to run.
//
// Each variable below is paired with a control that reaches conftest directly.
// The control shows what the variable does when nothing stops it.
// CONFTEST_PARSER, CONFTEST_NO_FAIL and CONFTEST_COMBINE each silence a denied plan.
// The refusal is generic, so settings this action never heard of are covered too.

import type { LiveFixture } from "./live-policy-types";

const { it } = require("node:test");
const assert = require("node:assert");
const { PINNED_DENIAL, withLiveFixture } = require("./live-policy-fixture.ts");
const { runLivePolicy, withoutCombinePin, withoutNoFailPin, withoutParserPin } = require("./live-policy-exec.ts");

const CLEAN_CONFIG = 'namespace = ["policies.s3"]\n';

// Each control also removes the flag that would otherwise outrank the variable.
// The control therefore shows the variable acting with nothing in its way.
const SILENCING_SETTINGS = [
  { name: "CONFTEST_PARSER", transform: withoutParserPin, value: "ini" },
  { name: "CONFTEST_NO_FAIL", transform: withoutNoFailPin, value: "true" },
  { name: "CONFTEST_COMBINE", transform: withoutCombinePin, value: "true" },
];

interface SilencingSetting {
  name: string;
  transform?: (args: string[]) => string[];
  value: string;
}

const refusalFor = (names: string[]): string =>
  `Policy integrity check failed: refusing to evaluate policy with conftest settings from the environment: ${names.join(", ")}`;

// The action reads its own environment; conftest inherits the process environment.
// Passing a variable to both is how it arrives on a runner.
const inheritedEnvironment = (name: string, value: string): Record<string, string> => ({ [name]: value });

SILENCING_SETTINGS.forEach((setting: SilencingSetting) => {
  it(`control: ${setting.name} silences the verified policy when it reaches conftest`, async () => {
    await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
      const childOnlyEnv = { ...process.env, [setting.name]: setting.value };
      const options = { childOnlyEnv, transform: setting.transform };
      const { outputs, rejection } = await runLivePolicy(fixture, options);
      assert.strictEqual(rejection, "", "the control must complete without an integrity failure");
      assert.strictEqual(outputs["has_violations"], "false", "the control must report no violations");
    });
  });

  it(`refuses to evaluate when ${setting.name} is inherited`, async () => {
    await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
      const env = inheritedEnvironment(setting.name, setting.value);
      const { outputs, rejection } = await runLivePolicy(fixture, { env });
      assert.strictEqual(rejection, refusalFor([setting.name]), "the run must stop at the action boundary");
      assert.strictEqual(outputs["has_violations"], "true", "a refused run must not report a clean plan");
      assert.doesNotMatch(outputs["policy_violations"], new RegExp(PINNED_DENIAL), "no policy should have run");
    });
  });
});

// Windows resolves environment names case-insensitively.
// Conftest reads a lowercase name there, so the refusal matches either case.
it("refuses to evaluate when a conftest setting is inherited in another case", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const env = inheritedEnvironment("conftest_combine", "true");
    const { rejection } = await runLivePolicy(fixture, { env });
    assert.strictEqual(
      rejection,
      refusalFor(["conftest_combine"]),
      "a lowercase conftest setting must stop the run too",
    );
  });
});

it("refuses to evaluate when an unknown conftest setting is inherited", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const env = inheritedEnvironment("CONFTEST_SOME_FUTURE_KNOB", "1");
    const { rejection } = await runLivePolicy(fixture, { env });
    assert.strictEqual(
      rejection,
      refusalFor(["CONFTEST_SOME_FUTURE_KNOB"]),
      "a setting this action has never heard of must still stop the run",
    );
  });
});

it("names every inherited conftest setting in the refusal", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const env = { CONFTEST_ALL_NAMESPACES: "true", CONFTEST_PARSER: "ini" };
    const { rejection } = await runLivePolicy(fixture, { env });
    assert.strictEqual(
      rejection,
      refusalFor(["CONFTEST_ALL_NAMESPACES", "CONFTEST_PARSER"]),
      "the refusal must list what has to be removed",
    );
  });
});

it("evaluates normally when no conftest setting is inherited", async () => {
  await withLiveFixture(CLEAN_CONFIG, async (fixture: LiveFixture) => {
    const { outputs, rejection } = await runLivePolicy(fixture);
    assert.strictEqual(rejection, "", "a clean environment must not be refused");
    assert.match(outputs["policy_violations"], new RegExp(PINNED_DENIAL), "the verified denial must be reported");
  });
});
