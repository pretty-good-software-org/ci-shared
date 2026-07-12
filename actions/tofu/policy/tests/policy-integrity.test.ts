const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const policy = require("../action.ts");
const { run } = policy;

const withTempConftest = (content: string, assertion: (root: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-policy-"));
  try {
    writeFileSync(join(root, "conftest.toml"), content);
    assertion(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

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

describe("conftest namespace integrity", () => {
  it("fails closed when a conftest.toml has no namespace", () => {
    withTempConftest('update = ["git::example/policies"]\n', (root) => {
      const result = run({ cwd: root, planJson: "plan.json" }, insufficientPolicyExec);
      assert.deepStrictEqual(
        result,
        {
          hasViolations: true,
          policyIntegrityFailed: true,
          policyViolations:
            "Policy integrity check failed: every conftest.toml must declare at least one namespace; missing in conftest.toml",
        },
        "a conftest configuration without namespaces should be rejected before policy execution",
      );
    });
  });

  it("accepts a non-empty namespace declaration", () => {
    withTempConftest('namespace = ["policies.s3"]\n', (root) => {
      const result = run({ cwd: root, planJson: "plan.json" }, insufficientPolicyExec);
      assert.strictEqual(result.policyIntegrityFailed, true, "the policy-count floor should still be enforced");
      assert.match(
        result.policyViolations,
        /loaded 4 tests/,
        "namespace validation should not bypass the policy-count floor",
      );
    });
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
