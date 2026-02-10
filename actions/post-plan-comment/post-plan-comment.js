// Post OpenTofu plan results as a PR comment.
// Used by actions/github-script in plan.yml.
//
// Reads step outcomes and plan output from environment variables,
// builds a markdown comment, and creates or updates the PR comment.

const BOT_COMMENT_IDENTIFIER = '### OpenTofu Plan Results';

function buildComment({ plan, fmtOutcome, initOutcome, validateOutcome, planOutcome, hasViolations, actor }) {
  const policyStatus = hasViolations ? 'FAILED' : 'PASSED';
  const policyMessage = hasViolations
    ? '**Policy Violations:** See Conftest step output for details'
    : 'All policies passed';

  return [
    '### OpenTofu Plan Results',
    `#### Format Check: \`${fmtOutcome}\``,
    `#### Init: \`${initOutcome}\``,
    `#### Validate: \`${validateOutcome}\``,
    `#### Plan: \`${planOutcome}\``,
    '<details><summary>Show Plan</summary>',
    '',
    '```terraform',
    plan,
    '```',
    '',
    '</details>',
    `#### Conftest Policy Check: \`${policyStatus}\``,
    policyMessage,
    `*Pushed by: @${actor}*`,
  ].join('\n');
}

async function postComment({ github, context, body }) {
  const { owner, repo } = context.repo;
  const issueNumber = context.issue.number;

  const { data: comments } = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const existing = comments.find((c) => c.body?.startsWith(BOT_COMMENT_IDENTIFIER));

  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

module.exports = async ({ github, context, env = process.env }) => {
  const body = buildComment({
    plan: env.PLAN || '',
    fmtOutcome: env.FMT_OUTCOME,
    initOutcome: env.INIT_OUTCOME,
    validateOutcome: env.VALIDATE_OUTCOME,
    planOutcome: env.PLAN_OUTCOME,
    hasViolations: env.HAS_VIOLATIONS === 'true',
    actor: env.ACTOR,
  });

  await postComment({ github, context, body });
};

module.exports.buildComment = buildComment;
module.exports.postComment = postComment;
module.exports.BOT_COMMENT_IDENTIFIER = BOT_COMMENT_IDENTIFIER;
