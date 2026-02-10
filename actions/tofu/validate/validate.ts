// Validate OpenTofu configuration.
//
// Runs tofu validate against the working directory.

const { execStream } = require("../../../lib/exec.ts");

interface RunArgs {
  workingDirectory: string;
}

type ExecFn = typeof execStream;

const run = ({ workingDirectory }: RunArgs, exec: ExecFn = execStream): void => {
  exec("tofu", [`-chdir=${workingDirectory}`, "validate"]);
};

const main = ({ env = process.env, exec = execStream }: { env?: NodeJS.ProcessEnv; exec?: ExecFn } = {}): void => {
  const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
  run({ workingDirectory }, exec);
};

module.exports = Object.assign(main, { run });
