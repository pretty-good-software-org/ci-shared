// The pinning flags are the enforcement; the digest is the proof.
// It compares the verified tree before and after conftest runs.
// A replacement is caught even if a future conftest reorders flag precedence.

import type { TestContext } from "node:test";

const fs = require("node:fs");
const { it } = require("node:test");
const assert = require("node:assert");
const { writeFileSync } = fs;
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

// The digest must be what touches the tree first, because the namespace scan reads
// Names as text: an undecodable one reaches it as a path that does not exist and it
// Dies on ENOENT, hiding the refusal that names the bytes. Since that scan captures
// ReaddirSync at import and the digest reaches it through the module object, a mock
// Reaches only the digest. Arming both failures at once makes the surfaced error
// Say which ran first: revert the order and the namespace error wins instead.
const undecodableEntry = () => ({
  isDirectory: () => false,
  isFile: () => true,
  isSymbolicLink: () => false,
  name: Buffer.from("70a0", "hex"),
});

it("refuses an undecodable name before the namespace scan reduces it to ENOENT", async (context: TestContext) => {
  const { exec, getCheckoutRoot } = pinnedExec({ packages: ["policies.other"] });
  const realReaddir = fs.readdirSync;
  // Scoped to the policy directory, so cleanup and everything else read the real tree.
  context.mock.method(fs, "readdirSync", (path: string, options: object) => {
    const checkoutRoot = getCheckoutRoot();
    if (checkoutRoot && String(path) === join(checkoutRoot, "policy")) {
      return [undecodableEntry()];
    }
    return realReaddir(path, options);
  });

  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await assert.rejects(action, /not valid UTF-8: 70a0/u, "the digest must be what touches the tree first");
});

// The case above only distinguishes the order while the namespace arm genuinely
// Fails. Asserting that here means a later tidy-up that satisfies the requirement
// Fails this test rather than quietly leaving the one above non-discriminating.
it("arms the namespace failure the order test depends on", async () => {
  const { exec } = pinnedExec({ packages: ["policies.other"] });
  const { action } = runPinnedAction(POLICY_COMMIT, "policies.s3", exec);
  await assert.rejects(action, /missing required namespaces: policies.s3/u, "the second arm must be unmet");
});
