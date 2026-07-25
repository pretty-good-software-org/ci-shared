const assert = require("node:assert/strict");
const { chmodSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const executableMode = 0o755;
const temporaryDirectories: string[] = [];

interface Fixture {
  fakeApm: string;
  log: string;
  repository: string;
  sentinel: string;
}

interface Result {
  status: number | null;
  stderr: string;
  stdout: string;
}

const runGit = (args: string[], cwd: string): Result => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const fakeApmScript = `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${APM_NO_SCRIPTS:-}" != 1 ]]; then touch "$FAKE_APM_SENTINEL"; fi
printf '%s\\n' "$*" >> "$FAKE_APM_LOG"
case "$1" in
  marketplace) exit 0 ;;
  install)
    mkdir -p .agents/skills
    for entry in skill-a skill-b; do
      if [[ "$entry" != "\${FAKE_APM_OMIT_ENTRY:-}" ]]; then
        mkdir -p ".agents/skills/$entry"
      fi
    done
    if [[ "\${FAKE_APM_SYMLINK_ENTRY:-}" == 1 ]]; then
      rm -rf .agents/skills/skill-b
      symlink_target="$(mktemp -d)"
      ln -s "$symlink_target" .agents/skills/skill-b
    fi
    if [[ "\${FAKE_APM_CREATE_FORBIDDEN:-}" == 1 ]]; then
      mkdir -p .pi/skills
    fi
    ;;
  *) exit 64 ;;
esac
`;

const commitCandidate = (repository: string): void => {
  assert.equal(runGit(["init", "-q"], repository).status, 0, "fixture Git initialization must succeed");
  assert.equal(runGit(["add", "."], repository).status, 0, "fixture files must be staged");
  const commitArgs = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"];
  const commit = runGit(commitArgs, repository);
  assert.equal(commit.status, 0, `fixture commit must succeed: ${commit.stderr}`);
};

const createFixture = (): Fixture => {
  const root = mkdtempSync(join(tmpdir(), "apm-consumer-test-"));
  temporaryDirectories.push(root);
  const fixture = {
    fakeApm: join(root, "apm"),
    log: join(root, "apm.log"),
    repository: join(root, "candidate"),
    sentinel: join(root, "candidate-script-ran"),
  };
  mkdirSync(join(fixture.repository, ".claude-plugin"), { recursive: true });
  writeFileSync(join(fixture.repository, ".claude-plugin/marketplace.json"), '{"plugins":[]}\n');
  writeFileSync(join(fixture.repository, "README.md"), "# Fixture\n");
  writeFileSync(fixture.fakeApm, fakeApmScript);
  chmodSync(fixture.fakeApm, executableMode);
  commitCandidate(fixture.repository);
  return fixture;
};

const addMarketplaceSymlink = (fixture: Fixture): void => {
  const target = join(fixture.repository, "outside-marketplace-file");
  writeFileSync(target, "outside\n");
  symlinkSync(target, join(fixture.repository, ".claude-plugin/escape"));
  const staging = runGit(["add", "."], fixture.repository);
  assert.equal(staging.status, 0, "symlink mutation must be staged");
  const commitArgs = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "symlink"];
  assert.equal(runGit(commitArgs, fixture.repository).status, 0, "symlink mutation must be committed");
};

const cleanTemporaryDirectories = (): void => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
};

module.exports = { addMarketplaceSymlink, cleanTemporaryDirectories, createFixture };
