// Shared execution helpers wrapping child_process.execFileSync.
//
// All functions use execFileSync (no shell) to prevent command injection.
// Three variants covering every action's needs:
// - execCapture: returns stdout (pipe mode)
// - execStream: streams to console (inherit mode)
// - execStreamWithEnv: streams to console with optional env override

const { execFileSync } = require("node:child_process");

type ExecCapture = (bin: string, args: string[]) => string;
type ExecStream = (bin: string, args: string[]) => void;
type ExecStreamWithEnv = (bin: string, args: string[], env?: NodeJS.ProcessEnv) => void;

const logStderr = (error: unknown): void => {
  const stderr = String((error as { stderr?: unknown }).stderr || "").trim();
  if (stderr) {
    console.error(stderr);
  }
};

const execCapture: ExecCapture = (bin, args) => {
  console.log(`+ ${bin} ${args.join(" ")}`);
  try {
    const output = execFileSync(bin, args, { encoding: "utf8", stdio: "pipe" });
    if (output) {
      console.log(output);
    }
    return output;
  } catch (error: unknown) {
    logStderr(error);
    throw error;
  }
};

const execStream: ExecStream = (bin, args) => {
  console.log(`+ ${bin} ${args.join(" ")}`);
  execFileSync(bin, args, { stdio: "inherit" });
};

const execStreamWithEnv: ExecStreamWithEnv = (bin, args, env) => {
  console.log(`+ ${bin} ${args.join(" ")}`);
  execFileSync(bin, args, { env, stdio: "inherit" });
};

module.exports = { execCapture, execStream, execStreamWithEnv };
