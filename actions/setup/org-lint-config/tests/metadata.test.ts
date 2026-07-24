const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const action = readFileSync(resolve("actions/setup/org-lint-config/action.yml"), "utf8");
const expectedAction = `name: 'Setup Org Lint Config'
description: 'Install a digest-pinned private org-lint-config release'
inputs:
  app-id:
    description: 'GitHub App ID with read access to org-lint-config'
    required: true
  private-key:
    description: 'GitHub App private key'
    required: true
  version:
    description: 'Exact org-lint-config release tag in v1.0.0 form'
    required: true
  sha256:
    description: 'Literal lowercase SHA-256 digest of the release archive'
    required: true
  output-directory:
    description: 'Directory where the verified release is published'
    required: true
outputs:
  path:
    description: 'Absolute path to the installed org-lint-config directory'
    value: \${{ steps.install.outputs.path }}
runs:
  using: 'composite'
  steps:
    - name: Mint repository-scoped installation token
      id: app-token
      uses: actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349 # v2.2.2
      with:
        app-id: \${{ inputs.app-id }}
        private-key: \${{ inputs.private-key }}
        owner: pretty-good-software-org
        repositories: org-lint-config
        permission-contents: read

    - name: Install verified org-lint-config release
      id: install
      shell: bash
      env:
        INPUT_TOKEN: \${{ steps.app-token.outputs.token }}
        INPUT_VERSION: \${{ inputs.version }}
        INPUT_SHA256: \${{ inputs.sha256 }}
        INPUT_OUTPUT_DIRECTORY: \${{ inputs.output-directory }}
      run: node "\${{ github.action_path }}/dist/index.js"
`;

describe("org-lint-config action metadata", () => {
  it("matches the complete least-privilege composite structure", () => {
    assert.strictEqual(
      action,
      expectedAction,
      "action metadata must keep required inputs, path output, immutable token action, and scoped permissions",
    );
  });

  it("contains no floating action references or credential-printing commands", () => {
    assert.doesNotMatch(
      action,
      /uses:\s+[^\s]+@(v\d+|main|master|latest)\b/,
      "every dependency must use an immutable SHA",
    );
    assert.doesNotMatch(action, /echo.*(?:token|private-key)|set -x/i, "action steps must not print credentials");
  });
});
