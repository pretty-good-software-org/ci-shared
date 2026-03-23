import type { StepSummaryArgs } from "./action-types.ts";

const fallback = (value: string | undefined): string => value || "unknown";

const buildStepSummary = (args: StepSummaryArgs): string =>
  [
    "### OpenTofu Plan Results",
    `#### Format Check: \`${fallback(args.fmtOutcome)}\``,
    `#### Init: \`${fallback(args.initOutcome)}\``,
    `#### Validate: \`${fallback(args.validateOutcome)}\``,
    `#### Plan: \`${fallback(args.planOutcome)}\``,
  ].join("\n");

module.exports = { buildStepSummary, fallback };
