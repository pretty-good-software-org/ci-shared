const { it } = require("node:test");
const assert = require("node:assert");
const { mockExec } = require("../../../../lib/test-helpers.ts");
const { POLICY_COMMIT, runPinnedAction } = require("./pinned-policy-helpers.ts");

it("fails closed when required namespaces are declared without a policy ref", async () => {
  const { exec } = mockExec();
  const { action } = runPinnedAction("", "policies.s3", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: policy-ref is required when required-namespaces is set" },
    "a namespace contract without a policy identity should be rejected",
  );
});

it("fails closed when a policy ref has no required namespace contract", async () => {
  const { exec } = mockExec();
  const { action } = runPinnedAction(POLICY_COMMIT, "", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: required-namespaces is required when policy-ref is set" },
    "a pinned policy without a namespace contract should be rejected",
  );
});

it("rejects a malformed policy ref before executing a command", async () => {
  const { commands, exec } = mockExec();
  const { action } = runPinnedAction("1111111-not-a-commit", "policies.s3", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: policy-ref must be a lowercase 40-character commit SHA" },
    "malformed policy refs should be rejected",
  );
  assert.deepStrictEqual(commands, [], "invalid external input should be rejected before command execution");
});

it("rejects a moving branch ref before executing a command", async () => {
  const { commands, exec } = mockExec();
  const { action } = runPinnedAction("refs/heads/main", "policies.s3", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: policy-ref must be a lowercase 40-character commit SHA" },
    "moving refs should not satisfy the immutable policy identity contract",
  );
  assert.deepStrictEqual(commands, [], "a moving ref should never reach git");
});

it("rejects a malformed required namespace before executing a command", async () => {
  const { commands, exec } = mockExec();
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3,policies.kms", exec);
  await assert.rejects(
    action,
    { message: "Policy integrity check failed: required-namespaces contains an invalid Rego package name" },
    "namespace inputs should use one valid Rego package name per line",
  );
  assert.deepStrictEqual(commands, [], "a malformed namespace should never reach git");
});
