const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const action = readFileSync(resolve("actions/setup/mise/action.yml"), "utf8");
const checkoutStart = action.indexOf("    - uses: actions/checkout@");
const miseStart = action.indexOf("    - uses: jdx/mise-action@");
const checkoutStep = action.slice(checkoutStart, miseStart);
const checkoutSha = "93cb6efe18208431cddfb8368fd83d5badbf9bfd";

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
