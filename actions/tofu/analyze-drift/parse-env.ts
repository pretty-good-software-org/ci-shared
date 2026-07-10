const { readFileSync } = require("node:fs");
import type { DriftAnalysisArgs } from "./action-types.ts";

// Resolve the plan JSON for analysis.
// Prefer INPUT_PLAN_JSON_FILE (a path) and read the plan from disk.
// INPUT_PLAN_JSON is a DEPRECATED inline fallback for small plans only.
// Inline plans above the execve argument-size limit fail to spawn node.
const readPlanJson = (env: NodeJS.ProcessEnv): string | undefined => {
  const path = env.INPUT_PLAN_JSON_FILE?.trim();
  if (!path) {
    return env.INPUT_PLAN_JSON;
  }
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    // A missing plan file is the expected "no artifact" case.
    // The plan job may have failed while download-artifact is continue-on-error.
    // Report it as not-provided so analyzeDrift emits an incomplete summary.
    // Any other read error is a real fault and must surface.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw new Error(`Failed to read plan JSON file at ${path}`, { cause: error });
  }
};

const parseEnv = (env: NodeJS.ProcessEnv): DriftAnalysisArgs => ({
  planJson: readPlanJson(env),
});

module.exports = { parseEnv };
