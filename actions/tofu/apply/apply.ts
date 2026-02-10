// Apply an OpenTofu plan.
//
// Runs tofu apply with -input=false -auto-approve against the plan file.

const { execStream } = require("../../../lib/exec.ts");

interface RunArgs {
  planFile: string;
  workingDirectory: string;
}

type ExecFn = typeof execStream;

const run = ({ planFile, workingDirectory }: RunArgs, exec: ExecFn = execStream): void => {
  exec("tofu", [`-chdir=${workingDirectory}`, "apply", "-input=false", "-auto-approve", planFile]);
};

interface MainArgs {
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
}

const resolveEnv = (args: MainArgs) => args.env || process.env;

const main = (args: MainArgs = {}): void => {
  const env = resolveEnv(args);
  const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
  const planFile = env.INPUT_PLAN_FILE || "plan.tfplan";
  run({ planFile, workingDirectory }, args.exec || execStream);
};

module.exports = Object.assign(main, { run });
