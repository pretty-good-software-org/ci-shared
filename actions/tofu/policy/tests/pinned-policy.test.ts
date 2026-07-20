const { it } = require("node:test");
const assert = require("node:assert");
const { join } = require("node:path");
const { OTHER_COMMIT, POLICY_COMMIT, pinnedExec, runPinnedAction } = require("./pinned-policy-helpers.ts");

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
