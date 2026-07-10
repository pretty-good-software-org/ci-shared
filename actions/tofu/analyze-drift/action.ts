// Analyze OpenTofu plan JSON for infrastructure drift.
//
// Pure JSON parser + markdown builder — no GitHub API calls.
// Reads plan JSON from the INPUT_PLAN_JSON_FILE path, with the deprecated inline
// INPUT_PLAN_JSON env var as a fallback; see parse-env.ts.
// Detects resource changes and builds a drift summary markdown fragment.

const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { analyzeDrift } = require("./analyze-drift.ts");
const { parseEnv } = require("./parse-env.ts");

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  writeOutput?: (name: string, value: string) => void;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const env = args.env || process.env;
  const driftArgs = parseEnv(env);
  const result = analyzeDrift(driftArgs);

  const setOutput = resolveOutputWriter(args);
  setOutput("has-drift", String(result.hasDrift));
  setOutput("drift-summary", result.summary);
};

module.exports = Object.assign(main, { analyzeDrift, parseEnv });
