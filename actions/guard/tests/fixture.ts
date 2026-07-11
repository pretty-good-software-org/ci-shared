const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { fixtureContents, requiredFiles } = require("./fixture-files.ts");

interface ExecutionResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

interface Replacement {
  from: string;
  path: string;
  root: string;
  to: string;
}

const temporaryDirectories: string[] = [];

const writeFixtureFile = (root: string, path: string, content = "fixture\n"): void => {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
};

const createCompliantRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ci-shared-guard-"));
  temporaryDirectories.push(root);

  for (const path of requiredFiles) {
    writeFixtureFile(root, path);
  }
  for (const [path, content] of Object.entries(fixtureContents)) {
    writeFixtureFile(root, path, content as string);
  }

  return root;
};

const execute = (checker: string, root: string): ExecutionResult => {
  const result = spawnSync("bash", [checker], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
  });
  assert.ifError(result.error);
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const replaceInFixture = ({ from, path, root, to }: Replacement): void => {
  const fixturePath = join(root, path);
  const original = readFileSync(fixturePath, "utf8");
  assert.ok(original.includes(from), `${path} must contain the value being replaced`);
  writeFileSync(fixturePath, original.replace(from, to));
};

module.exports = {
  createCompliantRepository,
  execute,
  replaceInFixture,
  temporaryDirectories,
  writeFixtureFile,
};
