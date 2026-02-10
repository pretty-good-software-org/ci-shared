// Execute tofu plan and capture outputs.
//
// 1. Runs tofu plan -no-color -out=plan.tfplan
// 2. Captures text output via tofu show, truncated to 60k chars
// 3. Exports JSON plan to plan.json

import type { ExecFn, WriteFn } from "./action-types.ts";

const { writeFileSync } = require("node:fs");
const { execCapture } = require("../../../lib/exec.ts");

const MAX_PLAN_LENGTH = 60_000;

interface RunArgs {
  workingDirectory: string;
}

interface PlanResult {
  plan: string;
  planFile: string;
  planJson: string;
}

const truncatePlan = (text: string): string => {
  if (text.length > MAX_PLAN_LENGTH) {
    return `${text.substring(0, MAX_PLAN_LENGTH)}\n... (truncated)`;
  }
  return text;
};

const run = ({ workingDirectory }: RunArgs, exec: ExecFn = execCapture, write: WriteFn = writeFileSync): PlanResult => {
  if (workingDirectory.includes("..")) {
    throw new Error(`working directory must not contain path traversal: ${workingDirectory}`);
  }
  exec("tofu", [`-chdir=${workingDirectory}`, "plan", "-no-color", "-out=plan.tfplan"]);

  const planText = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-no-color", "plan.tfplan"]);
  const planJsonOutput = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-json", "plan.tfplan"]);
  const planJsonPath = `${workingDirectory}/plan.json`;
  write(planJsonPath, planJsonOutput);

  return {
    plan: truncatePlan(planText),
    planFile: `${workingDirectory}/plan.tfplan`,
    planJson: planJsonPath,
  };
};

module.exports = { MAX_PLAN_LENGTH, run };
export type { PlanResult, RunArgs };
