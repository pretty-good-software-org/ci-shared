const { describe, it } = require("node:test");
const assert = require("node:assert");
const { postComment } = require("../post-plan-comment");

const ISSUE_NUMBER = 7;
const COMMENT_ID_UNRELATED = 100;
const COMMENT_ID_BOT = 200;
const COMMENT_ID_FIRST = 10;
const COMMENT_ID_SECOND = 20;
const CUSTOM_ISSUE_NUMBER = 42;

const mockGitHub = ({ comments = [] } = {}) => {
  const calls = { create: [], list: 0, update: [] };
  const github = {
    rest: {
      issues: {
        createComment: async (args) => calls.create.push(args),
        listComments: async () => {
          calls.list++;
          return { data: comments };
        },
        updateComment: async (args) => calls.update.push(args),
      },
    },
  };
  return { calls, github };
};

const context = { issue: { number: ISSUE_NUMBER }, repo: { owner: "org", repo: "repo" } };

describe("postComment create", () => {
  it("creates comment when none exists", async () => {
    const { calls, github } = mockGitHub({ comments: [] });
    await postComment({ body: "### OpenTofu Plan Results\ntest", context, github });
    assert.strictEqual(calls.create.length, 1);
    assert.strictEqual(calls.update.length, 0);
    assert.strictEqual(calls.create[0].owner, "org");
    assert.strictEqual(calls.create[0].repo, "repo");
    assert.strictEqual(calls.create[0].issue_number, ISSUE_NUMBER);
    assert.ok(calls.create[0].body.includes("test"));
  });

  it("ignores comments that do not match identifier", async () => {
    const comments = [
      { body: "looks good", id: 1 },
      { body: "## Different Header", id: 2 },
    ];
    const { calls, github } = mockGitHub({ comments });
    await postComment({ body: "### OpenTofu Plan Results\nplan", context, github });
    assert.strictEqual(calls.create.length, 1);
    assert.strictEqual(calls.update.length, 0);
  });

  it("passes correct owner and repo", async () => {
    const customContext = { issue: { number: CUSTOM_ISSUE_NUMBER }, repo: { owner: "acme", repo: "infra" } };
    const { calls, github } = mockGitHub();
    await postComment({ body: "### OpenTofu Plan Results\ntest", context: customContext, github });
    assert.strictEqual(calls.create[0].owner, "acme");
    assert.strictEqual(calls.create[0].repo, "infra");
    assert.strictEqual(calls.create[0].issue_number, CUSTOM_ISSUE_NUMBER);
  });
});

describe("postComment update", () => {
  it("updates existing bot comment", async () => {
    const comments = [
      { body: "unrelated comment", id: COMMENT_ID_UNRELATED },
      { body: "### OpenTofu Plan Results\nold plan", id: COMMENT_ID_BOT },
    ];
    const { calls, github } = mockGitHub({ comments });
    await postComment({ body: "### OpenTofu Plan Results\nnew plan", context, github });
    assert.strictEqual(calls.update.length, 1);
    assert.strictEqual(calls.create.length, 0);
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_BOT);
    assert.ok(calls.update[0].body.includes("new plan"));
  });

  it("matches first bot comment when multiple exist", async () => {
    const comments = [
      { body: "### OpenTofu Plan Results\nfirst", id: COMMENT_ID_FIRST },
      { body: "### OpenTofu Plan Results\nsecond", id: COMMENT_ID_SECOND },
    ];
    const { calls, github } = mockGitHub({ comments });
    await postComment({ body: "### OpenTofu Plan Results\nupdated", context, github });
    assert.strictEqual(calls.update.length, 1);
    assert.strictEqual(calls.update[0].comment_id, COMMENT_ID_FIRST);
  });
});
