import type { DriftAnalysisArgs } from "./action-types.ts";

const parseEnv = (env: NodeJS.ProcessEnv): DriftAnalysisArgs => ({
  planJson: env.INPUT_PLAN_JSON,
});

module.exports = { parseEnv };
