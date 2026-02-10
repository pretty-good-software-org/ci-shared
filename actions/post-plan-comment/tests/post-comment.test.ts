const { describe, it } = require("node:test");
const assert = require("node:assert");

const postPlanComment = require("../post-plan-comment.ts");

const { BOT_COMMENT_IDENTIFIER, postComment } = postPlanComment;

const ISSUE_NUMBER = 7;
const COMMENT_ID_UNRELATED = 100;
const COMMENT_ID_BOT = 200;
const COMMENT_ID_FIRST = 10;
const COMMENT_ID_SECOND = 20;

const context = {
  issue: { number: ISSUE_NUMBER },
  repo: { owner: "org", repo: "repo" },
};

const mockBody = `${BOT_COMMENT_IDENTIFIER}\ntest`;

const passingEnv: Record<string, string> = {
  ACTOR: "testuser",
  FMT_OUTCOME: "success",
  HAS_VIOLATIONS: "false",
  INIT_OUTCOME: "success",
  PLAN: "No changes.",
  PLAN_OUTCOME: "success",
  VALIDATE_OUTCOME: "success",
};

const violationsEnv: Record<string, string> = {
  ACTOR: "deployer",
  FMT_OUTCOME: "success",
  HAS_VIOLATIONS: "true",
  INIT_OUTCOME: "success",
  PLAN: "resource change",
  PLAN_OUTCOME: "success",
  VALIDATE_OUTCOME: "success",
};

interface MockCalls {
  create: { body: string; issue_number: number; owner: string; repo: string }[];
  list: number;
  update: { body: string; comment_id: number; owner: string; repo: string }[];
}

// Builds a mock GitHub API object that records calls
const mockGitHub = (comments: { body: string; id: number }[] = []) => {
  const calls: MockCalls = { create: [], list: 0, update: [] };
  const github = {
    rest: {
      issues: {
        createComment: async (args: { body: string; issue_number: number; owner: string; repo: string }) =>
          calls.create.push(args),
        listComments: async () => {
          calls.list += 1;
          return { data: comments };
        },
        updateComment: async (args: { body: string; comment_id: number; owner: string; repo: string }) =>
          calls.update.push(args),
      },
    },
  };
  return { calls, github };
};

describe("postComment create", () => {
  it("creates comment with correct params when no bot comment exists", async () => {
    const { calls, github } = mockGitHub([]);
    await postComment({ body: mockBody, context, github });

    assert.strictEqual(calls.create.length, 1, "should call createComment once");
    assert.strictEqual(calls.update.length, 0, "should not call updateComment");
    assert.strictEqual(calls.create[0].owner, "org", "owner mismatch");
    assert.strictEqual(calls.create[0].repo, "repo", "repo mismatch");
    assert.strictEqual(calls.create[0].issue_number, ISSUE_NUMBER, "issue number mismatch");
    assert.strictEqual(calls.create[0].body, mockBody, "body mismatch");
  });

  it("ignores comments that do not match identifier", async () => {
    const comments = [
      { body: "looks good", id: 1 },
      { body: "## Different Header", id: 0 },
    ];
    const { calls, github } = mockGitHub(comments);
    await postComment({ body: mockBody, context, github });

    assert.strictEqual(calls.create.length, 1, "should create when no match found");
    assert.strictEqual(calls.update.length, 0, "should not update");
  });
});

describe("postComment update", () => {
  it("updates existing bot comment", async () => {
    const updatedBody = `${BOT_COMMENT_IDENTIFIER}\nnew plan`;
    const comments = [
      { body: "unrelated comment", id: COMMENT_ID_UNRELATED },
      { body: `${BOT_COMMENT_IDENTIFIER}\nold plan`, id: COMMENT_ID_BOT },
    ];
    const { calls, github } = mockGitHub(comments);
    await postComment({ body: updatedBody, context, github });

    assert.strictEqual(calls.update.length, 1, "should call updateComment once");
    assert.strictEqual(calls.create.length, 0, "should not call createComment");
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_BOT, "comment_id mismatch");
    assert.strictEqual(calls.update[0].body, updatedBody, "body mismatch");
  });

  it("matches first bot comment when multiple exist", async () => {
    const comments = [
      { body: `${BOT_COMMENT_IDENTIFIER}\nfirst`, id: COMMENT_ID_FIRST },
      { body: `${BOT_COMMENT_IDENTIFIER}\nsecond`, id: COMMENT_ID_SECOND },
    ];
    const { calls, github } = mockGitHub(comments);
    await postComment({ body: `${BOT_COMMENT_IDENTIFIER}\nupdated`, context, github });

    assert.strictEqual(calls.update.length, 1, "should update exactly once");
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_FIRST, "should match first bot comment");
  });
});

describe("module.exports entry point", () => {
  it("reads env vars and posts comment", async () => {
    const { calls, github } = mockGitHub([]);
    await postPlanComment({ context, env: passingEnv, github });

    assert.strictEqual(calls.create.length, 1, "should create one comment");
    const [created] = calls.create;
    assert.ok(created.body.startsWith(BOT_COMMENT_IDENTIFIER), "body should start with identifier");
    assert.match(created.body, /No changes\./, "body should contain the plan text");
    assert.match(created.body, /@testuser/, "body should contain the actor");
  });

  it("converts HAS_VIOLATIONS string to boolean", async () => {
    const { calls, github } = mockGitHub([]);
    await postPlanComment({ context, env: violationsEnv, github });

    const [created] = calls.create;
    assert.match(created.body, /FAILED/, "should show FAILED when violations exist");
    assert.match(created.body, /Policy Violations/, "should show policy violation message");
  });
});
