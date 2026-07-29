// Each field of the runtime fingerprint, pinned one at a time.
//
// No filesystem operation isolates these: changing an inode or a size also moves
// Ctime, so a real mutation can never show that dev, ino or size is doing work.
// Lstat is reached through the fs module object, though, so a stub can present two
// Stats differing in exactly one field, which is the thing the filesystem cannot do.
//
// The atime case pins an absence rather than a presence. It is the field most
// Likely to be added back by someone who does not know why it is missing: reading
// Is what conftest does to the tree, so a fingerprint that included atime would
// Report every evaluation as a modification.

import type { TestContext } from "node:test";

const fs = require("node:fs");
const { it } = require("node:test");
const assert = require("node:assert");
const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { fingerprintPolicyTree } = require("../policy-tree-runtime.ts");

// Prototype-chaining rather than spreading: a BigIntStats carries its values on the
// Prototype, so a spread copy does not reproduce the real fingerprint.
const withStatOverride = (context: TestContext, override: object): void => {
  const realLstat = fs.lstatSync;
  context.mock.method(fs, "lstatSync", (path: string, options: object) =>
    Object.assign(Object.create(realLstat(path, options)), override),
  );
};

const buildTree = (root: string): string => {
  const tree = join(root, "policy");
  mkdirSync(join(tree, "nested"), { recursive: true });
  writeFileSync(join(tree, "a.rego"), "package policies.a\n", "utf8");
  writeFileSync(join(tree, "nested", "c.rego"), "package policies.c\n", "utf8");
  symlinkSync("/nonexistent/target.rego", join(tree, "link.rego"));
  return tree;
};

interface FieldCase {
  field: string;
  noticed: boolean;
  override: object;
}

const VERBS: Record<string, string> = { false: "ignores", true: "notices" };

const FIELDS: FieldCase[] = [
  { field: "ino", noticed: true, override: { ino: 42n } },
  { field: "dev", noticed: true, override: { dev: 7n } },
  { field: "size", noticed: true, override: { size: 4096n } },
  { field: "mode", noticed: true, override: { mode: 33_152n } },
  { field: "ctimeNs", noticed: true, override: { ctimeNs: 1n } },
  { field: "atime", noticed: false, override: { atimeNs: 1n } },
];

// Returns the fingerprint before and after the single-field override.
const fingerprintsAround = (context: TestContext, root: string, override: object) => {
  const tree = buildTree(root);
  const baseline = fingerprintPolicyTree(tree);
  withStatOverride(context, override);
  return { baseline, changed: fingerprintPolicyTree(tree) };
};

const assertField = (testCase: FieldCase, prints: { baseline: string; changed: string }): void => {
  if (testCase.noticed) {
    assert.notStrictEqual(prints.changed, prints.baseline, `${testCase.field} must reach the fingerprint`);
    return;
  }
  assert.strictEqual(prints.changed, prints.baseline, "reading the tree must not look like modifying it");
};

FIELDS.forEach((testCase: FieldCase) => {
  const verb = VERBS[String(testCase.noticed)];
  it(`${verb} a change confined to ${testCase.field}`, (context: TestContext) => {
    const root = mkdtempSync(join(tmpdir(), "ci-shared-fingerprint-"));
    try {
      assertField(testCase, fingerprintsAround(context, root, testCase.override));
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
