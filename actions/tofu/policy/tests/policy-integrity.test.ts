const { describe, it } = require("node:test");
const assert = require("node:assert");

const policy = require("../action.ts");
const { run } = policy;

const insufficientPolicyExec = (_bin: string, _args: string[]) => "4 tests, 4 passed, 0 warnings, 0 failures";
const emptyPolicyExec = (_bin: string, _args: string[]) => "0 tests, 0 passed, 0 warnings, 0 failures";
const pullFailureExec = () => {
  throw new Error("repository unavailable");
};

describe("policy count integrity", () => {
  it("fails closed when conftest loads fewer than five tests", () => {
    const result = run({ planJson: "tofu/plan.json" }, insufficientPolicyExec);
    assert.deepStrictEqual(
      result,
      {
        hasViolations: true,
        policyIntegrityFailed: true,
        policyViolations: "Policy integrity check failed: conftest loaded 4 tests; require at least 5",
      },
      "a policy count below the floor should be an integrity failure",
    );
  });

  it("fails closed when conftest loads no policies", () => {
    const result = run({ planJson: "tofu/plan.json" }, emptyPolicyExec);
    assert.deepStrictEqual(
      result,
      {
        hasViolations: true,
        policyIntegrityFailed: true,
        policyViolations: "Policy integrity check failed: conftest loaded 0 tests; require at least 5",
      },
      "an empty policy set should be an integrity failure",
    );
  });
});

describe("policy pull integrity", () => {
  it("fails closed when the policy pull fails", () => {
    const result = run({ planJson: "tofu/plan.json" }, pullFailureExec);
    assert.deepStrictEqual(
      result,
      {
        hasViolations: true,
        policyIntegrityFailed: true,
        policyViolations: "Policy integrity check failed: conftest pull failed: repository unavailable",
      },
      "a failed policy pull should be an integrity failure",
    );
  });
});

describe("policy summary integrity", () => {
  it("fails closed when conftest omits its test-count summary", () => {
    const result = run({ planJson: "tofu/plan.json" }, () => "");
    assert.deepStrictEqual(
      result,
      {
        hasViolations: true,
        policyIntegrityFailed: true,
        policyViolations:
          "Policy integrity check failed: conftest did not report a loaded-test count; refusing to trust the policy result",
      },
      "a missing policy summary should be an integrity failure",
    );
  });
});

describe("policy integrity action gate", () => {
  it("fails the action on an empty policy set", async () => {
    await assert.rejects(
      policy({ env: {}, exec: emptyPolicyExec, writeOutput: () => {} }),
      {
        message: "Policy integrity check failed: conftest loaded 0 tests; require at least 5",
      },
      "the action should reject an empty policy set",
    );
  });
});
