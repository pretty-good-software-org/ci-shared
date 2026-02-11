import type { DriftAnalysisArgs } from "./action-types.ts";

interface DriftResult {
  hasDrift: boolean;
  summary: string;
}

interface ResourceChange {
  address: string;
  change: { actions: string[] };
}

interface PlanJson {
  resource_changes?: ResourceChange[];
}

const incomplete = (reason: string): DriftResult => ({
  hasDrift: false,
  summary: ["### Drift Detection Incomplete", "", reason].join("\n"),
});

const noDrift = (): DriftResult => ({
  hasDrift: false,
  summary: ["### No Drift Detected", "", "All resources match their expected state."].join("\n"),
});

const driftFound = (addresses: string[]): DriftResult => ({
  hasDrift: true,
  summary: [
    "### Drift Detected",
    "",
    "The following resources have drifted from their expected state:",
    "",
    "```",
    ...addresses,
    "```",
    "",
    "**Action Required**: Review and reconcile drift",
  ].join("\n"),
});

const parsePlanJson = (raw: string): PlanJson | undefined => {
  try {
    return JSON.parse(raw) as PlanJson;
  } catch {
    return undefined;
  }
};

const isNoOp = (rc: ResourceChange): boolean => rc.change.actions.every((action) => action === "no-op");

const findDriftedAddresses = (raw: string): string[] | undefined => {
  const plan = parsePlanJson(raw);
  if (!plan) {
    return undefined;
  }
  return (plan.resource_changes ?? []).filter((rc) => !isNoOp(rc)).map((rc) => rc.address);
};

const analyzeDrift = (args: DriftAnalysisArgs): DriftResult => {
  const raw = (args.planJson ?? "").trim();
  if (!raw) {
    return incomplete("Plan JSON was not provided.");
  }

  const drifted = findDriftedAddresses(raw);
  if (!drifted) {
    return incomplete("Plan JSON could not be parsed.");
  }
  if (drifted.length === 0) {
    return noDrift();
  }
  return driftFound(drifted);
};

module.exports = { analyzeDrift };
