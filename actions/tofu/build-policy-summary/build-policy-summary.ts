import type { PolicySummaryArgs } from "./action-types.ts";

const fallback = (value: string | undefined): string => value || "unknown";

const buildPolicySummary = (args: PolicySummaryArgs): string => {
  let policyStatus = "PASSED";
  let policyMessage = "All policies passed";
  if (args.hasViolations) {
    policyStatus = "FAILED";
    policyMessage = "**Policy Violations:** See Conftest step output for details";
  }
  return [
    `#### Conftest Policy Check: \`${policyStatus}\``,
    policyMessage,
    `*Pushed by: @${fallback(args.actor)}*`,
  ].join("\n");
};

module.exports = { buildPolicySummary, fallback };
