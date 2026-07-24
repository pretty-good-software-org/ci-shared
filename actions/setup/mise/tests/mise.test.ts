const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const action = readFileSync(resolve("actions/setup/mise/action.yml"), "utf8");
const checkoutStart = action.indexOf("    - uses: actions/checkout@");
const miseStart = action.indexOf("    - uses: jdx/mise-action@");
const checkoutStep = action.slice(checkoutStart, miseStart);
const checkoutSha = "93cb6efe18208431cddfb8368fd83d5badbf9bfd";
const miseActionSha = "f10502fc09dadecfefb962fff68ce77213930204";
const dependencyLines = action.split("\n").filter((line: string) => /^\s+(?:-\s+)?uses:/.test(line));
const immutableActionReference = /^\s+(?:-\s+)?uses:\s+[^@\s]+@[0-9a-f]{40}(?:\s+#\s+.+)?$/;

if (checkoutStart === -1 || miseStart === -1) {
  throw new Error("setup/mise must define checkout before mise-action");
}

describe("setup/mise version pin", () => {
  it("uses the URL-less-lock-compatible release", () => {
    assert.match(action, /^        version: 2026\.7\.7$/m, "mise must use the URL-less-lock-compatible release");
    assert.match(action, /resolves Python separately/, "the pin must document the locked Python workaround");
    assert.match(action, /URL-less npm\/pipx lock entries/, "the pin must document URL-less backend compatibility");
  });
});

describe("setup/mise dependency pins", () => {
  it("pins every action dependency to a full commit SHA", () => {
    assert.ok(dependencyLines.length > 0, "setup/mise must declare at least one action dependency");

    for (const dependencyLine of dependencyLines) {
      assert.match(
        dependencyLine,
        immutableActionReference,
        `action dependency must use a full 40-character lowercase commit SHA: ${dependencyLine.trim()}`,
      );
    }
  });

  it("uses the exact verified mise-action v4.2.2 SHA", () => {
    assert.match(
      action,
      new RegExp(`^    - uses: jdx/mise-action@${miseActionSha} # v4\\.2\\.2$`, "m"),
      "mise-action must use the exact verified v4.2.2 commit SHA",
    );
  });
});

describe("setup/mise checkout pin", () => {
  it("uses the exact v5 compatibility SHA", () => {
    assert.match(
      action,
      new RegExp(`^    - uses: actions/checkout@${checkoutSha} # v5$`, "m"),
      "checkout must use the exact v5 compatibility SHA",
    );
  });

  it("documents the dated runner-path reason and baseline deviation", () => {
    assert.match(action, /Compatibility pin \(2026-07-19\)/, "the pin must be dated");
    assert.match(action, /documented-baseline deviation from/, "the pin reason must identify the baseline deviation");
    assert.match(action, /runner 2\.335\.1/, "the pin reason must identify the affected runner");
    assert.match(action, /logical GITHUB_WORKSPACE/, "the pin reason must identify the logical workspace");
    assert.match(action, /physical gitdir/, "the pin reason must identify the physical gitdir");
    assert.match(
      action,
      /Prefer that upstream behavior over bespoke credential handling/,
      "the pin must avoid bespoke auth",
    );
  });
});

describe("setup/mise checkout pin exit path", () => {
  it("documents when checkout v7 can be restored", () => {
    assert.match(
      action,
      /Exit path: return to v7 when logical and physical workspace paths are/,
      "the compatibility comment must define when to remove the pin",
    );
    assert.match(action, /identical or upstream supports symlinked gitdirs/, "the exit conditions must be explicit");
  });
});

describe("setup/mise checkout wiring", () => {
  it("forwards fetch-depth without manually handling the checkout token", () => {
    assert.match(
      checkoutStep,
      /with:\n        fetch-depth: \$\{\{ inputs\.fetch-depth \}\}/,
      "checkout must forward the composite fetch-depth input",
    );
    assert.doesNotMatch(checkoutStep, /^\s+token\s*:/m, "the composite must not manually pass a checkout token");
    assert.doesNotMatch(
      checkoutStep,
      /git config|credential|extraheader|echo.*token|set-output/i,
      "the composite must not manually persist or log checkout credentials",
    );
  });
});

describe("setup/mise installer wiring", () => {
  it("runs the tested installer from the composite action", () => {
    assert.match(
      action,
      /- run: '"\$\{\{ github\.action_path \}\}\/install\.sh"'/,
      "the composite action must invoke the canonical-workspace installer",
    );
  });
});
