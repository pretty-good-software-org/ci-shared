// Execute tofu plan and capture outputs.
//
// 1. Runs tofu plan -no-color -out=plan.tfplan [-var-file=...]
// 2. Captures text output via tofu show, truncated to 60k chars
// 3. Exports JSON plan to plan.json

import type { ExecFn, WriteFn } from "./action-types.ts";

const { writeFileSync } = require("node:fs");
const { execCapture } = require("../../../lib/exec.ts");

const MAX_PLAN_LENGTH = 60_000;

interface RunArgs {
  workingDirectory: string;
  varFile?: string;
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

const rejectPathTraversal = (label: string, value: string): void => {
  if (value.includes("..")) {
    throw new Error(`${label} must not contain path traversal: ${value}`);
  }
};

const buildPlanArgs = ({ workingDirectory, varFile }: RunArgs): string[] => {
  const planArgs = [`-chdir=${workingDirectory}`, "plan", "-no-color", "-out=plan.tfplan"];
  if (varFile) {
    planArgs.push(`-var-file=${varFile}`);
  }
  return planArgs;
};

const run = (
  { workingDirectory, varFile }: RunArgs,
  exec: ExecFn = execCapture,
  write: WriteFn = writeFileSync,
): PlanResult => {
  rejectPathTraversal("working directory", workingDirectory);
  if (varFile) {
    rejectPathTraversal("var-file", varFile);
  }

  exec("tofu", buildPlanArgs({ varFile, workingDirectory }));
  const planText = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-no-color", "plan.tfplan"]);
  const planJsonPath = `${workingDirectory}/plan.json`;
  write(planJsonPath, exec("tofu", [`-chdir=${workingDirectory}`, "show", "-json", "plan.tfplan"]));

  return {
    plan: truncatePlan(planText),
    planFile: `${workingDirectory}/plan.tfplan`,
    planJson: planJsonPath,
  };
};

module.exports = { MAX_PLAN_LENGTH, run };
export type { PlanResult, RunArgs };
