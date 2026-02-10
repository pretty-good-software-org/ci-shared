const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildStepSummary, fallback } = require("../build-step-summary.ts");

const defaults = {
  fmtOutcome: "success" as string | undefined,
  initOutcome: "success" as string | undefined,
  planOutcome: "success" as string | undefined,
  validateOutcome: "success" as string | undefined,
};

describe("buildStepSummary heading and sections", () => {
  it("starts with the literal heading", () => {
    assert.match(buildStepSummary(defaults), /^### OpenTofu Plan Results\n/);
  });
  it("renders all four step outcome headings", () => {
    const body = buildStepSummary({
      fmtOutcome: "success",
      initOutcome: "failure",
      planOutcome: "skipped",
      validateOutcome: "cancelled",
    });
    assert.match(body, /#### Format Check: `success`/);
    assert.match(body, /#### Init: `failure`/);
    assert.match(body, /#### Validate: `cancelled`/);
    assert.match(body, /#### Plan: `skipped`/);
  });
  it("renders headings in correct order", () => {
    const body = buildStepSummary(defaults);
    const heading = body.indexOf("### OpenTofu Plan Results");
    const fmt = body.indexOf("#### Format Check:");
    const init = body.indexOf("#### Init:");
    const validate = body.indexOf("#### Validate:");
    const plan = body.indexOf("#### Plan:");
    assert.ok(heading < fmt, "heading must come before Format Check");
    assert.ok(fmt < init, "Format Check must come before Init");
    assert.ok(init < validate, "Init must come before Validate");
    assert.ok(validate < plan, "Validate must come before Plan");
  });
});

describe("buildStepSummary step outcomes all fields", () => {
  const fields = [
    { field: "fmtOutcome", label: "Format Check" },
    { field: "initOutcome", label: "Init" },
    { field: "validateOutcome", label: "Validate" },
    { field: "planOutcome", label: "Plan" },
  ] as const;
  for (const { field, label } of fields) {
    for (const outcome of ["success", "failure", "cancelled", "skipped"]) {
      it(`renders ${field}=${outcome}`, () => {
        assert.match(
          buildStepSummary({ ...defaults, [field]: outcome }),
          new RegExp(`${label}: \`${outcome}\``),
          `${field}=${outcome} should render correctly`,
        );
      });
    }
  }
});

describe("buildStepSummary undefined outcomes", () => {
  it("falls back to 'unknown' for all undefined outcomes", () => {
    const body = buildStepSummary({
      fmtOutcome: undefined,
      initOutcome: undefined,
      planOutcome: undefined,
      validateOutcome: undefined,
    });
    assert.match(body, /Format Check: `unknown`/, "fmtOutcome should fall back to 'unknown'");
    assert.match(body, /Init: `unknown`/, "initOutcome should fall back to 'unknown'");
    assert.match(body, /Validate: `unknown`/, "validateOutcome should fall back to 'unknown'");
    assert.match(body, /Plan: `unknown`/, "planOutcome should fall back to 'unknown'");
  });
});

describe("fallback", () => {
  it("returns the value when defined", () => {
    assert.strictEqual(fallback("hello"), "hello");
  });
  it("returns 'unknown' for undefined", () => {
    assert.strictEqual(fallback(undefined), "unknown");
  });
  it("returns 'unknown' for empty string", () => {
    assert.strictEqual(fallback(""), "unknown");
  });
});
