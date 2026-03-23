const { describe, it } = require("node:test");
const assert = require("node:assert");

const upsertComment = require("../action.ts");

const ISSUE_NUMBER = 7;
const IDENTIFIER = "### OpenTofu Plan Results";
const COMMENT_ID_MATCH = 42;

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

describe("main create", () => {
  it("reads env vars and creates comment", async () => {
    const { calls, github } = mockGitHub([]);
    const env = {
      INPUT_COMMENT_BODY: `${IDENTIFIER}\ntest plan`,
      INPUT_COMMENT_IDENTIFIER: IDENTIFIER,
    };
    await upsertComment({ context, env, github });

    assert.strictEqual(calls.create.length, 1, "should create one comment");
    assert.strictEqual(calls.create[0].body, `${IDENTIFIER}\ntest plan`, "body should match env var");
  });
});

describe("main validation", () => {
  it("throws when identifier is missing", async () => {
    const { github } = mockGitHub([]);
    await assert.rejects(
      () => upsertComment({ context, env: { INPUT_COMMENT_BODY: "body" }, github }),
      { message: "INPUT_COMMENT_IDENTIFIER is required" },
      "should throw on missing identifier",
    );
  });

  it("throws when body is missing", async () => {
    const { github } = mockGitHub([]);
    await assert.rejects(
      () => upsertComment({ context, env: { INPUT_COMMENT_IDENTIFIER: IDENTIFIER }, github }),
      { message: "INPUT_COMMENT_BODY is required" },
      "should throw on missing body",
    );
  });

  it("throws when both env vars are missing", async () => {
    const { github } = mockGitHub([]);
    await assert.rejects(
      () => upsertComment({ context, env: {}, github }),
      { message: "INPUT_COMMENT_IDENTIFIER is required" },
      "should throw on missing env vars",
    );
  });
});

describe("main update", () => {
  it("reads env vars and updates existing comment", async () => {
    const comments = [{ body: `${IDENTIFIER}\nold`, id: COMMENT_ID_MATCH }];
    const { calls, github } = mockGitHub(comments);
    const env = {
      INPUT_COMMENT_BODY: `${IDENTIFIER}\nnew`,
      INPUT_COMMENT_IDENTIFIER: IDENTIFIER,
    };
    await upsertComment({ context, env, github });

    assert.strictEqual(calls.update.length, 1, "should update one comment");
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_MATCH, "should update the matching comment");
    assert.strictEqual(calls.update[0].body, `${IDENTIFIER}\nnew`, "body should match env var");
  });
});
