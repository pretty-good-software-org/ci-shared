import type { TestContext } from "node:test";

const fs = require("node:fs");
const { it } = require("node:test");
const assert = require("node:assert");
const { join } = require("node:path");
const { withPinnedPolicy } = require("../pinned-policy.ts");
const { OTHER_COMMIT, POLICY_COMMIT, pinnedExec, runPinnedAction } = require("./pinned-policy-helpers.ts");

const simulateCleanupFailure = (context: TestContext, getCheckoutRoot: () => string): string[] => {
  const originalRemove = fs.rmSync;
  const cleanupErrors: string[] = [];
  context.mock.method(fs, "rmSync", () => {
    throw new Error("permission denied");
  });
  context.mock.method(console, "error", (message: string) => {
    cleanupErrors.push(message);
  });
  context.after(() => {
    const checkoutRoot = getCheckoutRoot();
    if (checkoutRoot) {
      const cleanupOptions = { force: true, recursive: true };
      originalRemove(checkoutRoot, cleanupOptions);
    }
  });
  return cleanupErrors;
};

it("fails closed when the fetched commit does not match the requested commit", async () => {
  const { exec } = pinnedExec({ fetchedCommit: OTHER_COMMIT });
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: fetched policy commit does not match policy-ref" },
    "an unverified checkout should not reach policy evaluation",
  );
});

it("fetches and evaluates the exact verified commit without credentials in the repository URL", async () => {
  const policyPackages = ["policies.s3", "policies.kms"];
  const { commands, exec, getCheckoutRoot } = pinnedExec({ packages: policyPackages });
  const { action, outputs } = runPinnedAction(POLICY_COMMIT, "policies.s3\npolicies.kms", exec);
  await action;

  const checkoutRoot = getCheckoutRoot();
  assert.deepStrictEqual(
    commands,
    [
      `git init --quiet ${checkoutRoot}`,
      `git -C ${checkoutRoot} remote add origin ssh://git@github.com/pretty-good-software-org/opa-policies.git`,
      `git -C ${checkoutRoot} fetch --quiet --depth=1 origin ${POLICY_COMMIT}`,
      `git -C ${checkoutRoot} checkout --quiet --detach FETCH_HEAD`,
      `git -C ${checkoutRoot} rev-parse --verify HEAD`,
      `conftest test --policy ${join(checkoutRoot, "policy")} --namespace policies.s3 --namespace policies.kms --quiet=false tofu/plan.json`,
    ],
    "pinned mode should fetch only the requested commit, verify it, then evaluate every required namespace",
  );
  assert.strictEqual(outputs["has_violations"], "false", "a verified policy result should pass");
  assert.strictEqual(outputs["policy_violations"], "", "a verified policy result should have no violations");
});

it("preserves a successful policy result when checkout cleanup fails", (context: TestContext) => {
  const { exec, getCheckoutRoot } = pinnedExec();
  const cleanupErrors = simulateCleanupFailure(context, getCheckoutRoot);
  const expectedResult = { passed: true };
  const args = {
    evaluatePolicy: () => expectedResult,
    exec,
    policyRef: POLICY_COMMIT,
    requiredNamespaces: ["policies.s3"],
  };

  const actualResult = withPinnedPolicy(args);

  assert.strictEqual(actualResult, expectedResult, "cleanup failure should not replace a successful policy result");
  assert.deepStrictEqual(
    cleanupErrors,
    ["Policy checkout cleanup failed: permission denied"],
    "success-path cleanup failure should be logged with checkout context",
  );
});

it("rethrows the original execution failure when checkout cleanup also fails", (context: TestContext) => {
  const { exec, getCheckoutRoot } = pinnedExec();
  const cleanupErrors = simulateCleanupFailure(context, getCheckoutRoot);
  const executionFailure = new Error("policy evaluation failed");
  const args = {
    evaluatePolicy: () => {
      throw executionFailure;
    },
    exec,
    policyRef: POLICY_COMMIT,
    requiredNamespaces: ["policies.s3"],
  };

  assert.throws(
    () => withPinnedPolicy(args),
    (error: unknown) => {
      assert.strictEqual(error, executionFailure, "cleanup failure should not replace the original execution failure");
      return true;
    },
    "policy execution failure should still be thrown",
  );
  assert.deepStrictEqual(
    cleanupErrors,
    ["Policy checkout cleanup failed: permission denied"],
    "failure-path cleanup failure should be logged with checkout context",
  );
});

it("fails closed when a required namespace is absent from the fetched policy source", async () => {
  const { exec } = pinnedExec({ packages: ["policies.iam"] });
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: fetched policy commit is missing required namespaces: policies.s3" },
    "a missing required policy package should reject the fetched policy commit",
  );
});

it("requires every namespace in a multiline contract", async () => {
  const { exec } = pinnedExec({ packages: ["policies.s3"] });
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3\npolicies.kms", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: fetched policy commit is missing required namespaces: policies.kms" },
    "a partial namespace match should not satisfy the caller contract",
  );
});
