import type { PolicySummaryArgs } from "./action-types.ts";

const parseEnv = (env: NodeJS.ProcessEnv): PolicySummaryArgs => ({
  actor: env.INPUT_ACTOR,
  hasViolations: env.INPUT_HAS_VIOLATIONS === "true",
});

module.exports = { parseEnv };
