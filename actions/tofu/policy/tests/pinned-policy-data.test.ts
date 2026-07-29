const { mkdirSync, writeFileSync, symlinkSync } = require("node:fs");
const { it } = require("node:test");
const assert = require("node:assert");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { POLICY_COMMIT, pinnedExec, runPinnedAction } = require("./pinned-policy-helpers.ts");

const conftestCommand = (commands: string[]): string | undefined =>
  commands.find((command) => command.startsWith("conftest "));

it("loads the immutable data directory with --data when the pinned checkout ships one", async () => {
  const setupData = (checkoutRoot: string): void => {
    const dataDirectory = join(checkoutRoot, "policy", "data");
    mkdirSync(dataDirectory, { recursive: true });
    writeFileSync(
      join(dataDirectory, "registry.json"),
      JSON.stringify({ iam_boundary_registry: { bindings: [] } }),
      "utf8",
    );
  };
  const { commands, exec, getCheckoutRoot } = pinnedExec({ setupData });
  const { action, outputs } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await action;

  const checkoutRoot = getCheckoutRoot();
  assert.strictEqual(
    conftestCommand(commands),
    `conftest test --config-file ${join(checkoutRoot, "conftest-pinned.toml")} --policy ${join(checkoutRoot, "policy")} --update  --data ${join(checkoutRoot, "policy", "data")} --namespace policies.s3 --parser json --no-fail=false --combine=false --no-color --quiet=false tofu/plan.json`,
    "--data must load the checkout's own data directory, positioned after --policy",
  );
  assert.strictEqual(outputs["has_violations"], "false", "a verified policy result should pass");
});

it("omits --data when the pinned checkout has no data directory", async () => {
  const { commands, exec, getCheckoutRoot } = pinnedExec();
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await action;

  const checkoutRoot = getCheckoutRoot();
  assert.strictEqual(
    conftestCommand(commands),
    `conftest test --config-file ${join(checkoutRoot, "conftest-pinned.toml")} --policy ${join(checkoutRoot, "policy")} --update  --namespace policies.s3 --parser json --no-fail=false --combine=false --no-color --quiet=false tofu/plan.json`,
    "a checkout without a data directory must keep the exact legacy command with no --data",
  );
});

it("fails closed when the data directory resolves outside the checkout via a symlink", async () => {
  const setupData = (checkoutRoot: string): void => {
    // A compromised policy commit points policy/data at the host filesystem.
    // The target is outside the immutable checkout.
    symlinkSync(tmpdir(), join(checkoutRoot, "policy", "data"), "dir");
  };
  const { commands, exec } = pinnedExec({ setupData });
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);

  await assert.rejects(
    action,
    { message: "Policy integrity check failed: policy data directory resolves outside the policy checkout" },
    "an escaping data directory must fail before policy evaluation",
  );
  assert.strictEqual(conftestCommand(commands), undefined, "conftest must not run once the data guard fails");
});

it("fails closed when the policy data path is not a directory", async () => {
  const setupData = (checkoutRoot: string): void => {
    writeFileSync(join(checkoutRoot, "policy", "data"), "not a directory", "utf8");
  };
  const { commands, exec } = pinnedExec({ setupData });
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);

  await assert.rejects(
    action,
    { message: "Policy integrity check failed: policy data path is not a directory" },
    "a non-directory data path must fail before policy evaluation",
  );
  assert.strictEqual(conftestCommand(commands), undefined, "conftest must not run once the data guard fails");
});
