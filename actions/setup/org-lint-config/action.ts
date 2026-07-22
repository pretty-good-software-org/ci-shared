const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { install } = require("./install.ts");
const { parseInputs } = require("./parse-inputs.ts");

import type { FetchFn, OutputWriter } from "./action-types.ts";

interface MainArgs {
  env?: NodeJS.ProcessEnv;
  fetchFn?: FetchFn;
  writeOutput?: OutputWriter;
}

const main = async (args: MainArgs = {}): Promise<void> => {
  const inputs = parseInputs(args.env || process.env);
  const installedPath = await install(inputs, { fetchFn: args.fetchFn });
  const writeOutput = resolveOutputWriter({ writeOutput: args.writeOutput });
  writeOutput("path", installedPath);
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}

module.exports = Object.assign(main, { install, parseInputs });
