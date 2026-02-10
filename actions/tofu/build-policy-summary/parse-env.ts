import type { PolicySummaryArgs } from "./action-types.ts";

const parseEnv = (env: NodeJS.ProcessEnv): PolicySummaryArgs => ({
  hasViolations: env.INPUT_HAS_VIOLATIONS === "true",
  actor: env.INPUT_ACTOR,
});

module.exports = { parseEnv };
