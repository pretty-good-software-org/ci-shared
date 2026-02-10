const { describe, it } = require("node:test");
const assert = require("node:assert");

const { run } = require("../action.ts");

const ISSUE_NUMBER = 7;
const IDENTIFIER = "### OpenTofu Plan Results";
const COMMENT_ID_FIRST = 10;
const COMMENT_ID_SECOND = 20;
const COMMENT_ID_UNRELATED = 100;
const COMMENT_ID_BOT = 200;

const context = {
  issue: { number: ISSUE_NUMBER },
  repo: { owner: "org", repo: "repo" },
};

interface MockCalls {
  create: { body: string; issue_number: number; owner: string; repo: string }[];
  update: { body: string; comment_id: number; owner: string; repo: string }[];
}

const mockGitHub = (comments: { body: string; id: number }[] = []) => {
  const calls: MockCalls = { create: [], update: [] };
  const github = {
    rest: {
      issues: {
        createComment: async (args: { body: string; issue_number: number; owner: string; repo: string }) =>
          calls.create.push(args),
        listComments: async () => ({ data: comments }),
        updateComment: async (args: { body: string; comment_id: number; owner: string; repo: string }) =>
          calls.update.push(args),
      },
    },
  };
  return { calls, github };
};

describe("run create", () => {
  it("creates comment when no existing match found", async () => {
    const { calls, github } = mockGitHub([]);
    const body = `${IDENTIFIER}\nnew plan`;
    await run({ body, context, github, identifier: IDENTIFIER });

    assert.strictEqual(calls.create.length, 1, "should call createComment once");
    assert.strictEqual(calls.update.length, 0, "should not call updateComment");
    assert.strictEqual(calls.create[0].body, body, "body mismatch");
  });

  it("ignores non-matching comments and creates new", async () => {
    const comments = [
      { body: "looks good", id: 1 },
      { body: "## Different Header", id: 2 },
    ];
    const { calls, github } = mockGitHub(comments);
    const body = `${IDENTIFIER}\nnew plan`;
    await run({ body, context, github, identifier: IDENTIFIER });

    assert.strictEqual(calls.create.length, 1, "should create when no match found");
    assert.strictEqual(calls.update.length, 0, "should not update");
  });
});

describe("run update", () => {
  it("updates comment when existing match found", async () => {
    const comments = [
      { body: "unrelated", id: COMMENT_ID_UNRELATED },
      { body: `${IDENTIFIER}\nold plan`, id: COMMENT_ID_BOT },
    ];
    const { calls, github } = mockGitHub(comments);
    const body = `${IDENTIFIER}\nnew plan`;
    await run({ body, context, github, identifier: IDENTIFIER });

    assert.strictEqual(calls.update.length, 1, "should call updateComment once");
    assert.strictEqual(calls.create.length, 0, "should not call createComment");
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_BOT, "should update the matching comment");
    assert.strictEqual(calls.update[0].body, body, "body mismatch");
  });

  it("matches first comment when multiple exist", async () => {
    const comments = [
      { body: `${IDENTIFIER}\nfirst`, id: COMMENT_ID_FIRST },
      { body: `${IDENTIFIER}\nsecond`, id: COMMENT_ID_SECOND },
    ];
    const { calls, github } = mockGitHub(comments);
    await run({ body: `${IDENTIFIER}\nupdated`, context, github, identifier: IDENTIFIER });

    assert.strictEqual(calls.update.length, 1, "should update exactly once");
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_FIRST, "should match first bot comment");
  });
});
