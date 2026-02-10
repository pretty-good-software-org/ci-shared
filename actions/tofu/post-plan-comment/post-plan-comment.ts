// Post OpenTofu plan results as a PR comment.
// Used by actions/github-script in plan.yml.
//
// Reads step outcomes and plan output from environment variables,
// Builds a markdown comment, and creates or updates the PR comment.

interface BuildCommentArgs {
  actor: string | undefined;
  fmtOutcome: string | undefined;
  hasViolations: boolean;
  initOutcome: string | undefined;
  plan: string | undefined;
  planOutcome: string | undefined;
  validateOutcome: string | undefined;
}

interface IssueComment {
  body?: string;
  id: number;
}

interface GitHubContext {
  issue: { number: number };
  repo: { owner: string; repo: string };
}

interface GitHubClient {
  rest: {
    issues: {
      createComment: (args: { body: string; issue_number: number; owner: string; repo: string }) => Promise<unknown>;
      listComments: (args: { issue_number: number; owner: string; repo: string }) => Promise<{ data: IssueComment[] }>;
      updateComment: (args: { body: string; comment_id: number; owner: string; repo: string }) => Promise<unknown>;
    };
  };
}

interface PostCommentArgs {
  body: string;
  context: GitHubContext;
  github: GitHubClient;
}

interface MainArgs {
  context: GitHubContext;
  env?: NodeJS.ProcessEnv;
  github: GitHubClient;
}

const BOT_COMMENT_IDENTIFIER = "### OpenTofu Plan Results";

const fallback = (value: string | undefined): string => value || "unknown";

const buildComment = (args: BuildCommentArgs): string => {
  const { hasViolations, plan } = args;
  let policyStatus = "PASSED";
  let policyMessage = "All policies passed";
  if (hasViolations) {
    policyStatus = "FAILED";
    policyMessage = "**Policy Violations:** See Conftest step output for details";
  }
  return [
    "### OpenTofu Plan Results",
    `#### Format Check: \`${fallback(args.fmtOutcome)}\``,
    `#### Init: \`${fallback(args.initOutcome)}\``,
    `#### Validate: \`${fallback(args.validateOutcome)}\``,
    `#### Plan: \`${fallback(args.planOutcome)}\``,
    "<details><summary>Show Plan</summary>",
    "",
    "```terraform",
    plan,
    "```",
    "",
    "</details>",
    `#### Conftest Policy Check: \`${policyStatus}\``,
    policyMessage,
    `*Pushed by: @${fallback(args.actor)}*`,
  ].join("\n");
};

const postComment = async ({ body, context, github }: PostCommentArgs): Promise<void> => {
  const { owner, repo } = context.repo;
  const issueNumber = context.issue.number;
  const { data: comments } = await github.rest.issues.listComments({
    issue_number: issueNumber,
    owner,
    repo,
  });
  const existing = comments.find((comment) => comment.body?.startsWith(BOT_COMMENT_IDENTIFIER));
  if (existing) {
    await github.rest.issues.updateComment({
      body,
      comment_id: existing.id,
      owner,
      repo,
    });
  } else {
    await github.rest.issues.createComment({
      body,
      issue_number: issueNumber,
      owner,
      repo,
    });
  }
};

const main = async ({ context, env = process.env, github }: MainArgs): Promise<void> => {
  const body = buildComment({
    actor: env.ACTOR,
    fmtOutcome: env.FMT_OUTCOME,
    hasViolations: env.HAS_VIOLATIONS === "true",
    initOutcome: env.INIT_OUTCOME,
    plan: env.PLAN || "",
    planOutcome: env.PLAN_OUTCOME,
    validateOutcome: env.VALIDATE_OUTCOME,
  });
  await postComment({ body, context, github });
};

module.exports = Object.assign(main, { BOT_COMMENT_IDENTIFIER, buildComment, postComment });
