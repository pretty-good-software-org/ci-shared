// Create OpenTofu plan and capture outputs.
//
// Orchestration entry point — delegates plan execution to run.ts,
// Writes GitHub Actions outputs.

import type { ExecFn, WriteFn } from "./action-types.ts";

const { writeFileSync } = require("node:fs");
const { execCapture } = require("../../../lib/exec.ts");
const { resolveOutputWriter } = require("../../../lib/github-output.ts");
const { MAX_PLAN_LENGTH, run } = require("./run.ts");

interface MainArgs {
  core?: { setOutput: (name: string, value: string) => void };
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  write?: WriteFn;
  writeOutput?: (name: string, value: string) => void;
}

const resolveMainArgs = (args: MainArgs) => ({
  env: args.env || process.env,
  exec: args.exec || execCapture,
  write: args.write || writeFileSync,
});

const main = async (args: MainArgs = {}): Promise<void> => {
  const { env, exec, write } = resolveMainArgs(args);
  const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
  const varFile = env.INPUT_VAR_FILE || "";
  const result = run({ workingDirectory, varFile }, exec, write);

  const setOutput = resolveOutputWriter(args);
  setOutput("plan", result.plan);
  setOutput("plan-file", result.planFile);
  setOutput("plan-json", result.planJson);
};

module.exports = Object.assign(main, { MAX_PLAN_LENGTH, run });
