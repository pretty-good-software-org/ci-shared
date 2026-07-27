// The pinning flags are the enforcement; the digest is the proof.
// It compares the verified tree before and after conftest runs.
// A replacement is caught even if a future conftest reorders flag precedence.

const { it } = require("node:test");
const assert = require("node:assert");
const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { POLICY_COMMIT, pinnedExec, runPinnedAction } = require("./pinned-policy-helpers.ts");
const { hashPolicyTree } = require("../policy-tree.ts");

const FIRST_INVALID_UTF8 = "70c328";
const SECOND_INVALID_UTF8 = "70a0a1";
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

// Following a link would read host files into the digest.
// A dangling link would throw. Digesting the target text avoids both.
const digestWithLink = (target: string): string => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-"));
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    writeFileSync(join(tree, "a.rego"), "package policies.s3\n", "utf8");
    symlinkSync(target, join(tree, "link.rego"));
    return hashPolicyTree(tree);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

it("digests a symlink by its target text rather than following it", () => {
  const dangling = digestWithLink("/nonexistent/policy.rego");
  assert.match(dangling, /^[0-9a-f]{64}$/, "a dangling link must not break the digest");
  assert.notStrictEqual(
    dangling,
    digestWithLink("/nonexistent/other.rego"),
    "retargeting a link must change the digest",
  );
  assert.strictEqual(
    dangling,
    digestWithLink("/nonexistent/policy.rego"),
    "the same tree must digest the same under a different checkout path",
  );
});

// Bodies are digested as raw bytes.
// Two files differing only in invalid UTF-8 must not collide.
// A lossy decode would map both to the replacement character.
it("distinguishes files that differ only outside valid UTF-8", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-digest-bytes-"));
  try {
    const tree = join(root, "policy");
    mkdirSync(tree);
    const target = join(tree, "a.rego");
    writeFileSync(target, Buffer.from(FIRST_INVALID_UTF8, "hex"));
    const first = hashPolicyTree(tree);
    writeFileSync(target, Buffer.from(SECOND_INVALID_UTF8, "hex"));
    assert.notStrictEqual(first, hashPolicyTree(tree), "invalid byte sequences must not collide");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
