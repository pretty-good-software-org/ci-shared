const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const action = readFileSync(resolve("actions/setup/mise/action.yml"), "utf8");
const createAppActionSha = "bcd2ba49218906704ab6c1aa796996da409d3eb1";

const stepIndex = (marker: string): number => {
  const index = action.indexOf(marker);
  assert.notEqual(index, -1, `expected to find step marker: ${marker}`);
  return index;
};

describe("setup/mise default path", () => {
  it("keeps github-token defaulting to github.token, unaffected by the App inputs", () => {
    assert.match(
      action,
      /^  github-token:\n(?:.*\n)*?\s*default: \$\{\{ github\.token \}\}$/m,
      "github-token must still default to github.token",
    );
  });

  it("declares app-id, private-key, and private-repositories as optional with empty defaults", () => {
    for (const name of ["app-id", "private-key", "private-repositories"]) {
      assert.match(
        action,
        new RegExp(`^  ${name}:\\n(?:.*\\n)*?\\s*required: false\\n\\s*default: ''$`, "m"),
        `${name} must be optional and default to empty so the private-release path is opt-in`,
      );
    }
  });

  it("falls back to the plain github-token input when no App token was minted", () => {
    assert.match(
      action,
      /github_token: \$\{\{ steps\.private-release-token\.outputs\.token \|\| inputs\.github-token \}\}/,
      "mise-action must fall back to inputs.github-token when the mint step is skipped",
    );
  });
});

describe("setup/mise private release wiring and order", () => {
  it("runs validation, then minting, then checkout, then mise-action, in that order", () => {
    const validateIndex = stepIndex("Validate private release App inputs");
    const mintIndex = stepIndex("Mint private release installation token");
    const checkoutIndex = stepIndex("- uses: actions/checkout@");
    const miseActionIndex = stepIndex("- uses: jdx/mise-action@");

    assert.ok(validateIndex < mintIndex, "validation must run before minting");
    assert.ok(mintIndex < checkoutIndex, "minting must run before checkout");
    assert.ok(checkoutIndex < miseActionIndex, "checkout must run before mise-action consumes the token");
  });

  it("gates minting on app-id and delegates the run to the tested validation script", () => {
    assert.match(action, /if: inputs\.app-id != ''/, "minting must be conditional on app-id being set");
    assert.match(
      action,
      /run: '"\$\{\{ github\.action_path \}\}\/validate-private-release-inputs\.sh"'/,
      "validation must run the tested standalone script, not inline duplicated logic",
    );
  });
});

describe("setup/mise private release token scope", () => {
  it("scopes the minted token to exactly the requested owner, repositories, and permission", () => {
    const mintStart = stepIndex("Mint private release installation token");
    const checkoutStart = stepIndex("- uses: actions/checkout@");
    const mintStep = action.slice(mintStart, checkoutStart);

    assert.match(
      mintStep,
      /owner: \$\{\{ github\.repository_owner \}\}/,
      "owner must resolve dynamically, never hardcoded",
    );
    assert.match(
      mintStep,
      /repositories: \$\{\{ inputs\.private-repositories \}\}/,
      "repositories must forward exactly the caller-requested list, never defaulted",
    );
    assert.match(mintStep, /permission-contents: read/, "the token must be scoped to read-only contents access");
    assert.doesNotMatch(mintStep, /permission-[a-z-]+: write/, "the token must not request any write permission");
  });
});

describe("setup/mise private release action pins", () => {
  it("pins create-github-app-token to the exact immutable SHA", () => {
    assert.match(
      action,
      new RegExp(`uses: actions/create-github-app-token@${createAppActionSha} # v3\\.2\\.0`),
      "create-github-app-token must be pinned to the exact reviewed commit SHA",
    );
  });

  it("uses no floating tag for the newly added create-github-app-token dependency", () => {
    const mintStart = stepIndex("Mint private release installation token");
    const checkoutStart = stepIndex("- uses: actions/checkout@");
    const mintStep = action.slice(mintStart, checkoutStart);
    assert.doesNotMatch(
      mintStep,
      /uses:\s+actions\/create-github-app-token@(v\d+|main|master|latest)\b/,
      "the new dependency must use an immutable SHA, not a floating tag",
    );
  });
});

describe("setup/mise private release token non-exposure", () => {
  it("never echoes the app-id, private-key, or minted token, and never outputs the token", () => {
    assert.doesNotMatch(
      action,
      /echo.*(?:token|private-key|app-id)|set -x/i,
      "action steps must not print credentials or trace commands",
    );
    assert.doesNotMatch(action, /^outputs:/m, "the composite action must not re-export the minted token as an output");
  });
});
