import type { BuildCommentArgs } from "./action-types.ts";

const fallback = (value: string | undefined): string => value || "unknown";

const buildComment = (args: BuildCommentArgs): string => {
  const { hasViolations, plan } = args;
  let policyStatus = "PASSED";
  let policyMessage = "All policies passed";
  if (hasViolations) {
    policyStatus = "FAILED";
    policyMessage = "**Policy Violations:** See Conftest step output for details";
  }
  return [
    "### OpenTofu Plan Results",
    `#### Format Check: \`${fallback(args.fmtOutcome)}\``,
    `#### Init: \`${fallback(args.initOutcome)}\``,
    `#### Validate: \`${fallback(args.validateOutcome)}\``,
    `#### Plan: \`${fallback(args.planOutcome)}\``,
    "<details><summary>Show Plan</summary>",
    "",
    "```terraform",
    (plan ?? "").replace(/```/g, "` ` `"),
    "```",
    "",
    "</details>",
    `#### Conftest Policy Check: \`${policyStatus}\``,
    policyMessage,
    `*Pushed by: @${fallback(args.actor)}*`,
  ].join("\n");
};

module.exports = { buildComment, fallback };
