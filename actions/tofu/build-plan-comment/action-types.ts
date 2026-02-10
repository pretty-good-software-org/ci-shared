interface BuildCommentArgs {
  actor: string | undefined;
  fmtOutcome: string | undefined;
  hasViolations: boolean;
  initOutcome: string | undefined;
  plan: string | undefined;
  planOutcome: string | undefined;
  validateOutcome: string | undefined;
}

module.exports = {};
export type { BuildCommentArgs };
