const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildComment, postComment, BOT_COMMENT_IDENTIFIER } = require('./post-plan-comment');

describe('buildComment', () => {
  const defaults = {
    plan: 'No changes.',
    fmtOutcome: 'success',
    initOutcome: 'success',
    validateOutcome: 'success',
    planOutcome: 'success',
    hasViolations: false,
    actor: 'testuser',
  };

  it('starts with bot comment identifier', () => {
    const body = buildComment(defaults);
    assert.ok(body.startsWith(BOT_COMMENT_IDENTIFIER));
  });

  it('includes all step outcomes', () => {
    const body = buildComment(defaults);
    assert.ok(body.includes('Format Check: `success`'));
    assert.ok(body.includes('Init: `success`'));
    assert.ok(body.includes('Validate: `success`'));
    assert.ok(body.includes('Plan: `success`'));
  });

  it('includes plan output in terraform code block', () => {
    const body = buildComment({ ...defaults, plan: 'resource "aws_s3_bucket" "b" {}' });
    assert.ok(body.includes('```terraform'));
    assert.ok(body.includes('resource "aws_s3_bucket" "b" {}'));
  });

  it('includes actor', () => {
    const body = buildComment({ ...defaults, actor: 'octocat' });
    assert.ok(body.includes('@octocat'));
  });

  it('shows PASSED when no violations', () => {
    const body = buildComment({ ...defaults, hasViolations: false });
    assert.ok(body.includes('`PASSED`'));
    assert.ok(body.includes('All policies passed'));
    assert.ok(!body.includes('`FAILED`'));
  });

  it('shows FAILED when violations exist', () => {
    const body = buildComment({ ...defaults, hasViolations: true });
    assert.ok(body.includes('`FAILED`'));
    assert.ok(body.includes('Policy Violations'));
    assert.ok(!body.includes('All policies passed'));
  });

  it('wraps plan in collapsible details', () => {
    const body = buildComment(defaults);
    assert.ok(body.includes('<details><summary>Show Plan</summary>'));
    assert.ok(body.includes('</details>'));
  });

  it('handles empty plan', () => {
    const body = buildComment({ ...defaults, plan: '' });
    assert.ok(body.includes('```terraform\n\n```'));
  });

  it('handles failure outcomes', () => {
    const body = buildComment({ ...defaults, fmtOutcome: 'failure', initOutcome: 'failure' });
    assert.ok(body.includes('Format Check: `failure`'));
    assert.ok(body.includes('Init: `failure`'));
  });
});

describe('postComment', () => {
  function mockGitHub({ comments = [] } = {}) {
    const calls = { create: [], update: [], list: 0 };
    const github = {
      rest: {
        issues: {
          listComments: async () => {
            calls.list++;
            return { data: comments };
          },
          createComment: async (args) => calls.create.push(args),
          updateComment: async (args) => calls.update.push(args),
        },
      },
    };
    return { github, calls };
  }

  const context = { repo: { owner: 'org', repo: 'repo' }, issue: { number: 7 } };

  it('creates comment when none exists', async () => {
    const { github, calls } = mockGitHub({ comments: [] });
    await postComment({ github, context, body: '### OpenTofu Plan Results\ntest' });

    assert.strictEqual(calls.create.length, 1);
    assert.strictEqual(calls.update.length, 0);
    assert.strictEqual(calls.create[0].owner, 'org');
    assert.strictEqual(calls.create[0].repo, 'repo');
    assert.strictEqual(calls.create[0].issue_number, 7);
    assert.ok(calls.create[0].body.includes('test'));
  });

  it('updates existing bot comment', async () => {
    const comments = [
      { id: 100, body: 'unrelated comment' },
      { id: 200, body: '### OpenTofu Plan Results\nold plan' },
    ];
    const { github, calls } = mockGitHub({ comments });
    await postComment({ github, context, body: '### OpenTofu Plan Results\nnew plan' });

    assert.strictEqual(calls.update.length, 1);
    assert.strictEqual(calls.create.length, 0);
    assert.strictEqual(calls.update[0].comment_id, 200);
    assert.ok(calls.update[0].body.includes('new plan'));
  });

  it('ignores comments that do not match identifier', async () => {
    const comments = [
      { id: 1, body: 'looks good' },
      { id: 2, body: '## Different Header' },
    ];
    const { github, calls } = mockGitHub({ comments });
    await postComment({ github, context, body: '### OpenTofu Plan Results\nplan' });

    assert.strictEqual(calls.create.length, 1);
    assert.strictEqual(calls.update.length, 0);
  });

  it('matches first bot comment when multiple exist', async () => {
    const comments = [
      { id: 10, body: '### OpenTofu Plan Results\nfirst' },
      { id: 20, body: '### OpenTofu Plan Results\nsecond' },
    ];
    const { github, calls } = mockGitHub({ comments });
    await postComment({ github, context, body: '### OpenTofu Plan Results\nupdated' });

    assert.strictEqual(calls.update.length, 1);
    assert.strictEqual(calls.update[0].comment_id, 10);
  });

  it('passes correct owner and repo', async () => {
    const customContext = { repo: { owner: 'acme', repo: 'infra' }, issue: { number: 42 } };
    const { github, calls } = mockGitHub();
    await postComment({ github, context: customContext, body: '### OpenTofu Plan Results\ntest' });

    assert.strictEqual(calls.create[0].owner, 'acme');
    assert.strictEqual(calls.create[0].repo, 'infra');
    assert.strictEqual(calls.create[0].issue_number, 42);
  });
});
