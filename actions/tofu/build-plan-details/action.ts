// Build OpenTofu plan details as a collapsible markdown fragment.
//
// Pure markdown builder — no GitHub API calls.
// Reads plan text from INPUT_PLAN environment variable.
// Builds a collapsible details block and sets the plan-details output.

const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { buildPlanDetails } = require("./build-plan-details.ts");
const { parseEnv } = require("./parse-env.ts");

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const env = args.env || process.env;
  const detailsArgs = parseEnv(env);
  const body = buildPlanDetails(detailsArgs);

  const setOutput = resolveOutputWriter(args);
  setOutput("plan-details", body);
};

module.exports = Object.assign(main, { buildPlanDetails, parseEnv });
