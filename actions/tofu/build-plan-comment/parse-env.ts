import type { BuildCommentArgs } from "./action-types.ts";

const parseEnv = (env: NodeJS.ProcessEnv): BuildCommentArgs => ({
  actor: env.INPUT_ACTOR,
  fmtOutcome: env.INPUT_FMT_OUTCOME,
  hasViolations: env.INPUT_HAS_VIOLATIONS === "true",
  initOutcome: env.INPUT_INIT_OUTCOME,
  plan: env.INPUT_PLAN ?? "",
  planOutcome: env.INPUT_PLAN_OUTCOME,
  validateOutcome: env.INPUT_VALIDATE_OUTCOME,
});

module.exports = { parseEnv };
