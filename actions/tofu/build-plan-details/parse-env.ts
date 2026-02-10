import type { PlanDetailsArgs } from "./action-types.ts";

const parseEnv = (env: NodeJS.ProcessEnv): PlanDetailsArgs => ({
  plan: env.INPUT_PLAN ?? "",
});

module.exports = { parseEnv };
