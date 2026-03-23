import type { StepSummaryArgs } from "./action-types.ts";

const parseEnv = (env: NodeJS.ProcessEnv): StepSummaryArgs => ({
  fmtOutcome: env.INPUT_FMT_OUTCOME,
  initOutcome: env.INPUT_INIT_OUTCOME,
  planOutcome: env.INPUT_PLAN_OUTCOME,
  validateOutcome: env.INPUT_VALIDATE_OUTCOME,
});

module.exports = { parseEnv };
