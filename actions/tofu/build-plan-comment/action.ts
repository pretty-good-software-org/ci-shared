// Build OpenTofu plan results as a markdown comment body.
//
// Pure markdown builder — no GitHub API calls.
// Reads step outcomes and plan output from INPUT_* environment variables.
// Builds a markdown comment and sets the comment-body output.

const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { buildComment } = require("./build-comment.ts");
const { parseEnv } = require("./parse-env.ts");

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const env = args.env || process.env;
  const commentArgs = parseEnv(env);
  const body = buildComment(commentArgs);

  const setOutput = resolveOutputWriter(args);
  setOutput("comment-body", body);
};

module.exports = Object.assign(main, { buildComment, parseEnv });
