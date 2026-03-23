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
      listComments: (args: {
        issue_number: number;
        owner: string;
        per_page?: number;
        repo: string;
      }) => Promise<{ data: IssueComment[] }>;
      updateComment: (args: { body: string; comment_id: number; owner: string; repo: string }) => Promise<unknown>;
    };
  };
}

module.exports = {};
export type { GitHubClient, GitHubContext, IssueComment };
