import type { GitHubClient, GitHubContext } from "./action-types.ts";

interface CreateCommentArgs {
  body: string;
  context: GitHubContext;
  github: GitHubClient;
}

const createComment = async ({ body, context, github }: CreateCommentArgs): Promise<void> => {
  const { owner, repo } = context.repo;
  await github.rest.issues.createComment({
    body,
    issue_number: context.issue.number,
    owner,
    repo,
  });
};

module.exports = { createComment };
export type { CreateCommentArgs };
