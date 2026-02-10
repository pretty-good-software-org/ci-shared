// Build OpenTofu policy summary as a markdown fragment.
//
// Pure markdown builder — no GitHub API calls.
// Reads policy violation status and actor from INPUT_* environment variables.
// Builds a policy status line + actor footer and sets the policy-summary output.

const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { buildPolicySummary } = require("./build-policy-summary.ts");
const { parseEnv } = require("./parse-env.ts");

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const env = args.env || process.env;
  const policyArgs = parseEnv(env);
  const body = buildPolicySummary(policyArgs);

  const setOutput = resolveOutputWriter(args);
  setOutput("policy-summary", body);
};

module.exports = Object.assign(main, { buildPolicySummary, parseEnv });
