// The pinning flags are the enforcement; the digest is the proof.
// It compares the verified tree before and after conftest runs.
// A replacement is caught even if a future conftest reorders flag precedence.

const { it } = require("node:test");
const assert = require("node:assert");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { POLICY_COMMIT, pinnedExec, runPinnedAction } = require("./pinned-policy-helpers.ts");

const TREE_CHANGED = "Policy integrity check failed: the verified policy tree changed during evaluation";

// Rewrites a policy file while conftest is notionally running.
const replacingExec = (replacement: string) => {
  const { exec, getCheckoutRoot } = pinnedExec();
  const replacingConftest = (bin: string, args: string[]): string => {
    const output = exec(bin, args);
    if (bin === "conftest") {
      writeFileSync(join(getCheckoutRoot(), "policy", "policy-0.rego"), replacement, "utf8");
    }
    return output;
  };
  return replacingConftest;
};

it("fails closed when the verified tree is replaced during evaluation", async () => {
  const exec = replacingExec("package policies.s3\n\n# replaced mid-run\n");
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await assert.rejects(action, { message: TREE_CHANGED }, "a replaced tree must not be trusted");
});

it("fails closed when a file is added to the verified tree during evaluation", async () => {
  const { exec, getCheckoutRoot } = pinnedExec();
  const addingConftest = (bin: string, args: string[]): string => {
    const output = exec(bin, args);
    if (bin === "conftest") {
      writeFileSync(join(getCheckoutRoot(), "policy", "extra.rego"), "package policies.s3\n", "utf8");
    }
    return output;
  };
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", addingConftest);
  await assert.rejects(action, { message: TREE_CHANGED }, "an added policy file must not be trusted");
});
