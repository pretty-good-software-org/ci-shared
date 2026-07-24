const assert = require("node:assert/strict");
const { chmodSync, mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const executableMode = 0o755;
const stableLock = "lock: stable\n";
const temporaryDirectories: string[] = [];

interface Fixture {
  fakeApm: string;
  firstLock: string;
  log: string;
  repository: string;
  secondLock: string;
  sentinel: string;
  state: string;
}

interface Result {
  status: number | null;
  stderr: string;
  stdout: string;
}

interface RunRequest {
  args: string[];
  command: string;
  cwd: string;
  env?: Record<string, string>;
}

const run = ({ args, command, cwd, env = {} }: RunRequest): Result => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const writeExecutable = (path: string, content: string): void => {
  writeFileSync(path, content);
  chmodSync(path, executableMode);
};

const fakeApmScript = `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${APM_NO_SCRIPTS:-}" != 1 ]]; then touch "$FAKE_APM_SENTINEL"; fi
printf '%s\\n' "$*" >>"$FAKE_APM_LOG"
case "$1" in
  marketplace|audit) exit 0 ;;
  install)
    if [[ "\${2:-}" == "--frozen" ]]; then exit 0; fi
    count="$(cat "$FAKE_APM_STATE" 2>/dev/null || printf 0)"
    count=$((count + 1))
    printf '%s\\n' "$count" >"$FAKE_APM_STATE"
    if [[ "$count" == 1 ]]; then
      cp "$FAKE_APM_FIRST_LOCK" apm.lock.yaml
    else
      cp "$FAKE_APM_SECOND_LOCK" apm.lock.yaml
    fi
    ;;
  *) exit 64 ;;
esac
`;

const writeCandidate = (fixture: Fixture, committedLock: string): void => {
  const { repository, sentinel } = fixture;
  mkdirSync(join(repository, ".claude-plugin"), { recursive: true });
  mkdirSync(join(repository, "plugins/example/skills/example"), { recursive: true });
  const maliciousManifest = `dependencies: []\nlifecycle:\n  pre-install:\n    - type: command\n      run: touch ${sentinel}\n`;
  writeFileSync(join(repository, "apm.yml"), maliciousManifest);
  writeFileSync(join(repository, "apm.lock.yaml"), committedLock);
  writeFileSync(join(repository, ".claude-plugin/marketplace.json"), '{"plugins":[]}\n');
  writeFileSync(join(repository, "plugins/example/skills/example/SKILL.md"), "# Example\n");
};

const commitCandidate = (repository: string): void => {
  const initialization = run({ args: ["init", "-q"], command: "git", cwd: repository });
  assert.equal(initialization.status, 0, "fixture Git initialization must succeed");
  const staging = run({ args: ["add", "."], command: "git", cwd: repository });
  assert.equal(staging.status, 0, "fixture files must be staged");
  const args = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"];
  const commit = run({ args, command: "git", cwd: repository });
  assert.equal(commit.status, 0, `fixture commit must succeed: ${commit.stderr}`);
};

const createFixture = (committedLock = stableLock): Fixture => {
  const root = mkdtempSync(join(tmpdir(), "apm-lock-verifier-test-"));
  temporaryDirectories.push(root);
  const fixture = {
    fakeApm: join(root, "apm"),
    firstLock: join(root, "first-lock.yaml"),
    log: join(root, "apm.log"),
    repository: join(root, "candidate"),
    secondLock: join(root, "second-lock.yaml"),
    sentinel: join(root, "candidate-script-ran"),
    state: join(root, "state"),
  };
  writeCandidate(fixture, committedLock);
  writeFileSync(fixture.firstLock, stableLock);
  writeFileSync(fixture.secondLock, stableLock);
  writeExecutable(fixture.fakeApm, fakeApmScript);
  commitCandidate(fixture.repository);
  return fixture;
};

module.exports = { createFixture, run, temporaryDirectories };
