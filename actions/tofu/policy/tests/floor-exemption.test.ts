const { describe, it } = require("node:test");
const assert = require("node:assert");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const policy = require("../action.ts");
const { run } = policy;

const withTempConftest = (content: string, assertion: (root: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-policy-exemption-"));
  try {
    writeFileSync(join(root, "conftest.toml"), content);
    assertion(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

const insufficientPolicyExec = (_bin: string, _args: string[]) => "4 tests, 4 passed, 0 warnings, 0 failures";
const policyViolationExec = (_bin: string, args: string[]) => {
  if (args[0] === "pull") {
    return "";
  }
  throw new Error("FAIL - policies.common.deny: public resource");
};

describe("documented policy floor exemption", () => {
  it("waives the floor and satisfies configuration integrity without a namespace", () => {
    withTempConftest('floor_exempt_reason = "no applicable org policies yet"\n', (root) => {
      const result = run({ cwd: root, planJson: "plan.json" }, insufficientPolicyExec);
      assert.deepStrictEqual(
        result,
        {
          floorExemptReason: "no applicable org policies yet",
          hasViolations: false,
          policyIntegrityFailed: false,
          policyViolations: "",
        },
        "a documented exemption should satisfy config integrity and waive only the policy-count floor",
      );
    });
  });
});

describe("invalid policy floor exemption", () => {
  it("does not waive the floor for an empty reason", () => {
    const config = 'namespace = ["policies.providers"]\nfloor_exempt_reason = "   "\n';
    withTempConftest(config, (root) => {
      const result = run({ cwd: root, planJson: "plan.json" }, insufficientPolicyExec);
      assert.deepStrictEqual(
        result,
        {
          floorExemptReason: "",
          hasViolations: true,
          policyIntegrityFailed: true,
          policyViolations: "Policy integrity check failed: conftest loaded 4 tests; require at least 5",
        },
        "an empty exemption reason should leave the policy-count floor enforced",
      );
    });
  });
});

describe("policy enforcement with a floor exemption", () => {
  it("still reports violations from policies that load", () => {
    withTempConftest('floor_exempt_reason = "no applicable provider policies yet"\n', (root) => {
      const result = run({ cwd: root, planJson: "plan.json" }, policyViolationExec);
      assert.deepStrictEqual(
        result,
        {
          floorExemptReason: "no applicable provider policies yet",
          hasViolations: true,
          policyIntegrityFailed: false,
          policyViolations: "FAIL - policies.common.deny: public resource",
        },
        "an exemption must not suppress violations from policies that do load",
      );
    });
  });
});

describe("policy floor exemption audit log", () => {
  it("logs the active exemption and its reason", async () => {
    const root = mkdtempSync(join(tmpdir(), "ci-shared-policy-exemption-"));
    const warnings: string[] = [];
    try {
      writeFileSync(join(root, "conftest.toml"), 'floor_exempt_reason = "no applicable org policies yet"\n');
      await policy({
        cwd: root,
        exec: insufficientPolicyExec,
        logWarning: (message: string) => warnings.push(message),
        writeOutput: () => {},
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
    assert.deepStrictEqual(
      warnings,
      ["POLICY FLOOR EXEMPTION ACTIVE: no applicable org policies yet"],
      "the action log should make an active exemption and its reason conspicuous",
    );
  });
});
