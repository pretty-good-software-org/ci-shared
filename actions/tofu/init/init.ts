// Initialize OpenTofu configuration.
//
// Runs tofu init, optionally disabling backend initialization.

const { execStream } = require("../../../lib/exec.ts");

interface RunArgs {
  backend: boolean;
  workingDirectory: string;
}

type ExecFn = typeof execStream;

const run = ({ backend, workingDirectory }: RunArgs, exec: ExecFn = execStream): void => {
  exec("tofu", [`-chdir=${workingDirectory}`, "init", `-backend=${backend}`]);
};

const main = ({ env = process.env, exec = execStream }: { env?: NodeJS.ProcessEnv; exec?: ExecFn } = {}): void => {
  const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
  const backend = env.INPUT_BACKEND !== "false";
  run({ backend, workingDirectory }, exec);
};

module.exports = Object.assign(main, { run });
