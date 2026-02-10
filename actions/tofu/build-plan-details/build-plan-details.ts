import type { PlanDetailsArgs } from "./action-types.ts";

const buildPlanDetails = (args: PlanDetailsArgs): string => {
  const plan = (args.plan ?? "").replace(/```/g, "` ` `");
  return [
    "<details><summary>Show Plan</summary>",
    "",
    "```terraform",
    plan,
    "```",
    "",
    "</details>",
  ].join("\n");
};

module.exports = { buildPlanDetails };
