import type { GitHubClient, GitHubContext, IssueComment } from "./action-types.ts";

interface FindCommentArgs {
  context: GitHubContext;
  github: GitHubClient;
  identifier: string;
}

const findComment = async ({ context, github, identifier }: FindCommentArgs): Promise<IssueComment | undefined> => {
  const { owner, repo } = context.repo;
  const { data: comments } = await github.rest.issues.listComments({
    issue_number: context.issue.number,
    owner,
    per_page: 100,
    repo,
  });
  return comments.find((comment) => comment.body?.startsWith(identifier));
};

module.exports = { findComment };
export type { FindCommentArgs };
