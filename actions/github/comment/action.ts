// Create or update a PR comment identified by a marker string.

import type { GitHubClient, GitHubContext } from "./action-types.ts";

const { findComment } = require("./find.ts");
const { createComment } = require("./create.ts");
const { updateComment } = require("./update.ts");

interface RunArgs {
  body: string;
  context: GitHubContext;
  github: GitHubClient;
  identifier: string;
}

interface MainArgs {
  context: GitHubContext;
  env?: NodeJS.ProcessEnv;
  github: GitHubClient;
}

const run = async ({ body, context, github, identifier }: RunArgs): Promise<void> => {
  const existing = await findComment({ context, github, identifier });
  if (existing) {
    await updateComment({ body, commentId: existing.id, context, github });
    return;
  }
  await createComment({ body, context, github });
};

const parseMainArgs = (env: NodeJS.ProcessEnv): { body: string; identifier: string } => {
  const identifier = (env.INPUT_COMMENT_IDENTIFIER || "").trim();
  const body = env.INPUT_COMMENT_BODY || "";
  if (!identifier) {
    throw new Error("INPUT_COMMENT_IDENTIFIER is required");
  }
  if (!body) {
    throw new Error("INPUT_COMMENT_BODY is required");
  }
  return { body, identifier };
};

const main = async ({ context, env = process.env, github }: MainArgs): Promise<void> => {
  const { body, identifier } = parseMainArgs(env);
  await run({ body, context, github, identifier });
};

module.exports = Object.assign(main, { createComment, findComment, run, updateComment });
