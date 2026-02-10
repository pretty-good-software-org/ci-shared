const { describe, it } = require("node:test");
const assert = require("node:assert");

const { updateComment } = require("../update.ts");

const ISSUE_NUMBER = 7;
const IDENTIFIER = "### OpenTofu Plan Results";
const COMMENT_ID = 42;

const context = {
  issue: { number: ISSUE_NUMBER },
  repo: { owner: "org", repo: "repo" },
};

const mockGitHub = () => {
  const calls: { body: string; comment_id: number; owner: string; repo: string }[] = [];
  const github = {
    rest: {
      issues: {
        updateComment: async (args: { body: string; comment_id: number; owner: string; repo: string }) =>
          calls.push(args),
      },
    },
  };
  return { calls, github };
};

describe("updateComment", () => {
  it("calls updateComment API with correct params", async () => {
    const { calls, github } = mockGitHub();
    const body = `${IDENTIFIER}\nupdated plan`;
    await updateComment({ body, commentId: COMMENT_ID, context, github });

    assert.strictEqual(calls.length, 1, "should call updateComment once");
    assert.strictEqual(calls[0].owner, "org", "owner mismatch");
    assert.strictEqual(calls[0].repo, "repo", "repo mismatch");
    assert.strictEqual(calls[0].comment_id, COMMENT_ID, "comment_id mismatch");
    assert.strictEqual(calls[0].body, body, "body mismatch");
  });
});
