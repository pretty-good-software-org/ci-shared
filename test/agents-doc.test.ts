// AGENTS.md's directory tree is generated, and the generator writes the absolute
// Path of whatever directory it ran in as the tree root. Committing that verbatim
// Would put a local path into repository documentation and churn on every
// Regeneration, so the root is normalised to the repository name by hand.
//
// That is a step someone has to remember. This test is what remembers it: the next
// Regeneration that forgets fails here rather than shipping a stranger's path.
//
// Tree completeness is deliberately not asserted. The generator drops
// mise-tasks/build, which is tracked and not ignored, so an assertion that every
// Tracked task directory appears would fail on generator output this repository
// Cannot fix from here. The omission is recorded rather than papered over.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const repositoryRoot = resolve(".");
const REPOSITORY_NAME = "ci-shared";
const TREE_FENCE = "```text";

const documentedTree = (): string[] => {
  const lines = readFileSync(join(repositoryRoot, "AGENTS.md"), "utf8").split("\n");
  const start = lines.indexOf(TREE_FENCE);
  assert.notEqual(start, -1, "AGENTS.md must contain a generated tree block");
  const end = lines.indexOf("```", start + 1);
  return lines.slice(start + 1, end);
};

describe("generated repository tree", () => {
  it("is rooted at the repository name, not the path it was generated in", () => {
    assert.equal(documentedTree()[0], REPOSITORY_NAME, "the generator writes an absolute path here");
  });

  it("contains no absolute path from whoever regenerated it", () => {
    const leaked = documentedTree().filter((line: string) => line.includes("/Users/") || line.includes("/private/"));
    assert.deepEqual(leaked, [], "a local path reached the committed documentation");
  });

});
