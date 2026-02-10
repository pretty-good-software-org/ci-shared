import type { GitHubClient, GitHubContext } from "./action-types.ts";

interface UpdateCommentArgs {
  body: string;
  commentId: number;
  context: GitHubContext;
  github: GitHubClient;
}

const updateComment = async ({ body, commentId, context, github }: UpdateCommentArgs): Promise<void> => {
  const { owner, repo } = context.repo;
  await github.rest.issues.updateComment({
    body,
    comment_id: commentId,
    owner,
    repo,
  });
};

module.exports = { updateComment };
export type { UpdateCommentArgs };
