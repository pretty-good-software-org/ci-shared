export type ExecFn = (bin: string, args: string[]) => string;

export interface PolicyResult {
  floorExemptReason: string;
  hasViolations: boolean;
  policyViolations: string;
  policyIntegrityFailed: boolean;
}
