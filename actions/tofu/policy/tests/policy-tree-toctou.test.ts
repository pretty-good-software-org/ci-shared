// Content equality is checked before and after evaluation, which leaves a window:
// Change a policy, let conftest evaluate the changed tree, put the original bytes
// Back, and both content digests agree because the content agrees. These cases run
// That attack inside the evaluate callback, which is exactly when conftest holds
// The tree, and assert that the content digest alone does not notice.

const { it } = require("node:test");
const assert = require("node:assert");
const { chmodSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { withPinnedPolicy } = require("../pinned-policy.ts");
const { hashPolicyTree } = require("../policy-tree.ts");
const { fingerprintPolicyTree } = require("../policy-tree-runtime.ts");
const { POLICY_COMMIT, pinnedExec } = require("./pinned-policy-helpers.ts");

const RESTRICTED_MODE = 0o600;
const SUBSTITUTE = "package policies.s3\n\n# evaluated instead\n";

interface Sources {
  policyDirectory: string;
}

// Rewrites a policy file, then restores its exact bytes and mode, standing in for
// An attacker who swaps policy for the duration of the evaluation and puts it back.
const swapAndRestore = (policyDirectory: string): void => {
  const target = join(policyDirectory, "policy-0.rego");
  const original = readFileSync(target);
  const { mode } = statSync(target);
  writeFileSync(target, SUBSTITUTE, "utf8");
  writeFileSync(target, original);
  chmodSync(target, mode);
};

const runWithSwap = (evaluate: (sources: Sources) => unknown) => {
  const { exec } = pinnedExec();
  return withPinnedPolicy({
    evaluatePolicy: evaluate,
    exec,
    policyRef: POLICY_COMMIT,
    requiredNamespaces: ["policies.s3"],
  });
};

it("catches a policy swapped and restored while conftest held the tree", () => {
  assert.throws(
    () => runWithSwap((sources: Sources) => swapAndRestore(sources.policyDirectory)),
    { message: "Policy integrity check failed: the verified policy tree was modified during evaluation" },
    "restoring the bytes must not restore the tree's history",
  );
});

// The reason the fingerprint exists: prove the content digest does not see this.
it("shows the content digest alone surviving the same swap", () => {
  let contentMatched = false;
  assert.throws(() =>
    runWithSwap((sources: Sources) => {
      const before = hashPolicyTree(sources.policyDirectory);
      swapAndRestore(sources.policyDirectory);
      contentMatched = hashPolicyTree(sources.policyDirectory) === before;
      return undefined;
    }),
  );
  assert.ok(contentMatched, "the content digest is equal across the swap, which is why metadata is needed");
});

it("catches a file added and removed while conftest held the tree", () => {
  assert.throws(
    () =>
      runWithSwap((sources: Sources) => {
        const planted = join(sources.policyDirectory, "planted.rego");
        writeFileSync(planted, "package policies.s3\n", "utf8");
        require("node:fs").rmSync(planted);
      }),
    { message: "Policy integrity check failed: the verified policy tree was modified during evaluation" },
    "a file that came and went leaves the directory's metadata changed",
  );
});

it("catches a mode change that is put back", () => {
  assert.throws(
    () =>
      runWithSwap((sources: Sources) => {
        const target = join(sources.policyDirectory, "policy-0.rego");
        const { mode } = statSync(target);
        chmodSync(target, RESTRICTED_MODE);
        chmodSync(target, mode);
      }),
    { message: "Policy integrity check failed: the verified policy tree was modified during evaluation" },
    "chmod moves ctime and chmod back does not move it home",
  );
});

// Reading is what conftest does, so a read-only evaluation must not trip either check.
it("passes when evaluation only reads the tree", () => {
  const result = runWithSwap((sources: Sources) => {
    readFileSync(join(sources.policyDirectory, "policy-0.rego"));
    fingerprintPolicyTree(sources.policyDirectory);
    return "evaluated";
  });
  assert.strictEqual(result, "evaluated", "a read-only run must not be reported as a modification");
});
