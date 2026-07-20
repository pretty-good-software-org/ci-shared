const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const executableMode = 0o755;
const installScript = resolve("actions/setup/mise/install.sh");
const fakeMiseScript =
  '#!/usr/bin/env bash\nprintf "%s\\n%s\\n%s\\n" "$PWD" "$MISE_CONFIG_ROOT" "$*" > "$CAPTURE_PATH"\n';

interface WorkspaceFixture {
  capturePath: string;
  fakeBin: string;
  logicalWorkspace: string;
  physicalWorkspace: string;
  root: string;
}

const createFakeMise = (fixture: WorkspaceFixture): void => {
  const fakeMise = join(fixture.fakeBin, "mise");
  writeFileSync(fakeMise, fakeMiseScript);
  chmodSync(fakeMise, executableMode);
};

const createWorkspaceFixture = (): WorkspaceFixture => {
  const root = mkdtempSync(join(tmpdir(), "mise-workspace-test-"));
  const fixture = {
    capturePath: join(root, "mise-call.txt"),
    fakeBin: join(root, "bin"),
    logicalWorkspace: join(root, ".github-runner", "repository"),
    physicalWorkspace: join(root, "actions-runner", "repository"),
    root,
  };
  mkdirSync(fixture.physicalWorkspace, { recursive: true });
  mkdirSync(fixture.fakeBin);
  symlinkSync(join(root, "actions-runner"), join(root, ".github-runner"));
  createFakeMise(fixture);
  return fixture;
};

const runInstaller = (fixture: WorkspaceFixture) => {
  const environment = {
    ...process.env,
    CAPTURE_PATH: fixture.capturePath,
    GITHUB_WORKSPACE: fixture.logicalWorkspace,
    PATH: `${fixture.fakeBin}:${process.env.PATH ?? ""}`,
  };
  const options = { encoding: "utf8", env: environment };
  return spawnSync("bash", [installScript], options);
};

const assertCanonicalWorkspaceInstall = (): void => {
  const fixture = createWorkspaceFixture();
  try {
    const result = runInstaller(fixture);
    assert.equal(result.status, 0, `install script failed: ${result.stderr}`);
    const canonicalWorkspace = realpathSync(fixture.physicalWorkspace);
    const expected = `${canonicalWorkspace}\n${canonicalWorkspace}\ninstall --locked --verbose\n`;
    assert.equal(
      readFileSync(fixture.capturePath, "utf8"),
      expected,
      "mise must receive one canonical workspace for its current directory and config root",
    );
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
};

describe("setup/mise workspace identity", () => {
  it("installs from one physical config and lockfile root", assertCanonicalWorkspaceInstall);
});
