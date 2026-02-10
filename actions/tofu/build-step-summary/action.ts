// Build OpenTofu step summary as a markdown fragment.
//
// Pure markdown builder — no GitHub API calls.
// Reads step outcomes from INPUT_* environment variables.
// Builds a markdown heading + step outcome lines and sets the step-summary output.

const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { buildStepSummary } = require("./build-step-summary.ts");
const { parseEnv } = require("./parse-env.ts");

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const env = args.env || process.env;
  const summaryArgs = parseEnv(env);
  const body = buildStepSummary(summaryArgs);

  const setOutput = resolveOutputWriter(args);
  setOutput("step-summary", body);
};

module.exports = Object.assign(main, { buildStepSummary, parseEnv });
