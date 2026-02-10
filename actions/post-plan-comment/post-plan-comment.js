// Post OpenTofu plan results as a PR comment.
// Used by actions/github-script in plan.yml.
//
// Reads step outcomes and plan output from environment variables,
// Builds a markdown comment, and creates or updates the PR comment.

const BOT_COMMENT_IDENTIFIER = "### OpenTofu Plan Results";

const buildComment = ({ actor, fmtOutcome, hasViolations, initOutcome, plan, planOutcome, validateOutcome }) => {
  let policyStatus = "PASSED";
  if (hasViolations) {
    policyStatus = "FAILED";
  }
  let policyMessage = "All policies passed";
  if (hasViolations) {
    policyMessage = "**Policy Violations:** See Conftest step output for details";
  }
  return [
    "### OpenTofu Plan Results",
    `#### Format Check: \`${fmtOutcome}\``,
    `#### Init: \`${initOutcome}\``,
    `#### Validate: \`${validateOutcome}\``,
    `#### Plan: \`${planOutcome}\``,
    "<details><summary>Show Plan</summary>",
    "",
    "```terraform",
    plan,
    "```",
    "",
    "</details>",
    `#### Conftest Policy Check: \`${policyStatus}\``,
    policyMessage,
    `*Pushed by: @${actor}*`,
  ].join("\n");
};

const postComment = async ({ body, context, github }) => {
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

module.exports = async ({ context, env = process.env, github }) => {
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

module.exports.buildComment = buildComment;
module.exports.postComment = postComment;
module.exports.BOT_COMMENT_IDENTIFIER = BOT_COMMENT_IDENTIFIER;
