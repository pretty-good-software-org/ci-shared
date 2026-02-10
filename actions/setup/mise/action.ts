// Checkout + mise install.
// Used as the first step in most CI workflows.
//
// Runs mise install, optionally setting MISE_ENV first.

const { execStreamWithEnv } = require("../../../lib/exec.ts");

interface RunArgs {
  miseEnv: string;
}

type ExecFn = typeof execStreamWithEnv;

const run = ({ miseEnv }: RunArgs, exec: ExecFn = execStreamWithEnv): void => {
  if (miseEnv) {
    exec("mise", ["install"], { ...process.env, MISE_ENV: miseEnv });
  } else {
    exec("mise", ["install"], undefined);
  }
};

const main = ({
  env = process.env,
  exec = execStreamWithEnv,
}: { env?: NodeJS.ProcessEnv; exec?: ExecFn } = {}): void => {
  const miseEnv = env.INPUT_MISE_ENV || "";
  run({ miseEnv }, exec);
};

module.exports = Object.assign(main, { run });
