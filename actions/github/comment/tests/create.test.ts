const { describe, it } = require("node:test");
const assert = require("node:assert");

const { createComment } = require("../create.ts");

const ISSUE_NUMBER = 7;
const IDENTIFIER = "### OpenTofu Plan Results";

const context = {
  issue: { number: ISSUE_NUMBER },
  repo: { owner: "org", repo: "repo" },
};

const mockGitHub = () => {
  const calls: { body: string; issue_number: number; owner: string; repo: string }[] = [];
  const github = {
    rest: {
      issues: {
        createComment: async (args: { body: string; issue_number: number; owner: string; repo: string }) =>
          calls.push(args),
      },
    },
  };
  return { calls, github };
};

describe("createComment", () => {
  it("calls createComment API with correct params", async () => {
    const { calls, github } = mockGitHub();
    const body = `${IDENTIFIER}\nnew plan`;
    await createComment({ body, context, github });

    assert.strictEqual(calls.length, 1, "should call createComment once");
    assert.strictEqual(calls[0].owner, "org", "owner mismatch");
    assert.strictEqual(calls[0].repo, "repo", "repo mismatch");
    assert.strictEqual(calls[0].issue_number, ISSUE_NUMBER, "issue number mismatch");
    assert.strictEqual(calls[0].body, body, "body mismatch");
  });
});
