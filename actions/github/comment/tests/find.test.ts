const { describe, it } = require("node:test");
const assert = require("node:assert");

const { findComment } = require("../find.ts");

const ISSUE_NUMBER = 7;
const IDENTIFIER = "### OpenTofu Plan Results";
const COMMENT_ID_MATCH = 42;
const COMMENT_ID_FIRST = 10;
const COMMENT_ID_SECOND = 20;
const COMMENTS_PER_PAGE = 100;

const context = {
  issue: { number: ISSUE_NUMBER },
  repo: { owner: "org", repo: "repo" },
};

const mockGitHub = (comments: { body: string; id: number }[] = []) => ({
  rest: {
    issues: {
      listComments: async () => ({ data: comments }),
    },
  },
});

describe("findComment match", () => {
  it("returns matching comment when identifier matches", async () => {
    const comments = [
      { body: "unrelated", id: 1 },
      { body: `${IDENTIFIER}\nsome plan`, id: COMMENT_ID_MATCH },
    ];
    const github = mockGitHub(comments);
    const result = await findComment({ context, github, identifier: IDENTIFIER });

    assert.ok(result, "should find matching comment");
    assert.strictEqual(result.id, COMMENT_ID_MATCH, "should return the matching comment's id");
  });

  it("returns first match when multiple comments match", async () => {
    const comments = [
      { body: `${IDENTIFIER}\nfirst`, id: COMMENT_ID_FIRST },
      { body: `${IDENTIFIER}\nsecond`, id: COMMENT_ID_SECOND },
    ];
    const github = mockGitHub(comments);
    const result = await findComment({ context, github, identifier: IDENTIFIER });

    assert.ok(result, "should find a matching comment");
    assert.strictEqual(result.id, COMMENT_ID_FIRST, "should return the first matching comment");
  });
});

describe("findComment undefined body", () => {
  it("skips comments with undefined body", async () => {
    const comments: { body: string; id: number }[] = [
      { body: undefined as unknown as string, id: 5 },
      { body: `${IDENTIFIER}\nplan`, id: COMMENT_ID_MATCH },
    ];
    const github = mockGitHub(comments);
    const result = await findComment({ context, github, identifier: IDENTIFIER });

    assert.ok(result, "should find the comment with a body");
    assert.strictEqual(result.id, COMMENT_ID_MATCH, "should skip undefined-body comment");
  });
});

describe("findComment per_page", () => {
  it("requests 100 comments per page", async () => {
    let capturedArgs: Record<string, unknown> = {};
    const github = {
      rest: {
        issues: {
          listComments: async (args: Record<string, unknown>) => {
            capturedArgs = args;
            return { data: [] };
          },
        },
      },
    };
    await findComment({ context, github, identifier: IDENTIFIER });

    assert.strictEqual(capturedArgs.per_page, COMMENTS_PER_PAGE, "should pass per_page: 100");
    assert.strictEqual(capturedArgs.owner, "org", "should pass correct owner");
    assert.strictEqual(capturedArgs.repo, "repo", "should pass correct repo");
    assert.strictEqual(capturedArgs.issue_number, ISSUE_NUMBER, "should pass correct issue number");
  });
});

describe("findComment no match", () => {
  it("returns undefined when no comment matches", async () => {
    const comments = [
      { body: "looks good", id: 1 },
      { body: "## Different Header", id: 2 },
    ];
    const github = mockGitHub(comments);
    const result = await findComment({ context, github, identifier: IDENTIFIER });

    assert.strictEqual(result, undefined, "should return undefined when no match");
  });

  it("returns undefined for empty comment list", async () => {
    const github = mockGitHub([]);
    const result = await findComment({ context, github, identifier: IDENTIFIER });

    assert.strictEqual(result, undefined, "should return undefined for empty list");
  });
});
