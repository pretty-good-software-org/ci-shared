const { readFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { replaceInFixture, writeFixtureFile } = require("./fixture.ts");
const { requiredFiles } = require("./fixture-files.ts");

interface Mutation {
  from: string;
  path: string;
  to: string;
}

interface Scenario {
  configure: (root: string) => void;
  name: string;
}

const replace = (root: string, mutation: Mutation): void => {
  replaceInFixture({ ...mutation, root });
};

const configureGuardrcWaiver = (root: string): void => {
  const mutation = { from: "max-complexity = 10", path: "pyproject.toml", to: "max-complexity = 11" };
  replace(root, mutation);
  writeFixtureFile(root, ".guardrc", "GUARD_SKIP_CHECKS=i\n");
};

const configureCallerStandards = (root: string): void => {
  const standardsPath = resolve("actions/guard/lint-standards.toml");
  const standards = readFileSync(standardsPath, "utf8");
  writeFixtureFile(root, "lint-standards.toml", standards.replace("c901 = 10", "c901 = 11"));
  const mutation = { from: "max-complexity = 10", path: "pyproject.toml", to: "max-complexity = 11" };
  replace(root, mutation);
};

const configureArchivedRepository = (root: string): void => {
  const languageFiles = ["go.mod", ".golangci.yml", "Cargo.toml", "clippy.toml", "pyproject.toml"];
  for (const path of [...requiredFiles, ...languageFiles]) {
    rmSync(join(root, path), { force: true, recursive: true });
  }
  writeFixtureFile(root, ".guardrc", "GUARD_SKIP_CHECKS=a,b,c,d,e,f,g,h,i,j\n");
};

const configureChangieIndentViolation = (root: string): void => {
  writeFixtureFile(root, ".changie.yaml", "---\nkinds:\n    - label: Added\n      auto: minor\n");
  writeFixtureFile(root, ".changes/header.tpl.md", "# Changelog\n");
  writeFixtureFile(root, ".changes/unreleased/.gitkeep", "");
  replace(root, {
    from: "[tools]",
    path: ".mise.toml",
    to: '[tools]\n"github:miniscruff/changie" = "1.24.0"',
  });
};

const configureFloatingMiseAction = (root: string): void => {
  replace(root, {
    from: "actions/setup/mise@1ab91760d0b1a9cf368ecda69db5e4795c592b7c # v1",
    path: ".github/workflows/lint.yml",
    to: "actions/setup/mise@v1",
  });
};

const configureConcurrencyDeadlock = (root: string): void => {
  writeFixtureFile(
    root,
    ".github/workflows/plan.yml",
    "name: Plan\non:\n  workflow_call:\nconcurrency:\n  group: tofu-state\n  cancel-in-progress: false\njobs:\n  plan:\n    runs-on: [self-hosted, Linux, ARM64]\n    steps:\n      - run: echo plan\n",
  );
  writeFixtureFile(
    root,
    ".github/workflows/drift.yml",
    "name: Drift\non:\n  schedule:\n    - cron: '0 0 * * *'\nconcurrency:\n  group: tofu-state\n  cancel-in-progress: false\njobs:\n  detect:\n    uses: ./.github/workflows/plan.yml\n",
  );
};

const scenarios: Scenario[] = [
  { configure: () => {}, name: "compliant repo without caller lint standards" },
  {
    configure: (root) => {
      replace(root, { from: "max-complexity: 10", path: ".golangci.yml", to: "max-complexity: 11" });
    },
    name: "go complexity threshold violation",
  },
  {
    configure: (root) => {
      replace(root, { from: "max: 300", path: ".golangci.yml", to: "max: 301" });
    },
    name: "go file-length threshold violation",
  },
  {
    configure: (root) => {
      replace(root, { from: "= 80", path: "clippy.toml", to: "= 81" });
    },
    name: "rust file-length threshold violation",
  },
  {
    configure: (root) => {
      const mutation = { from: "max-complexity = 10", path: "pyproject.toml", to: "max-complexity = 11" };
      replace(root, mutation);
    },
    name: "python complexity threshold violation",
  },
  { configure: configureGuardrcWaiver, name: ".guardrc waiver" },
  { configure: configureCallerStandards, name: "caller-local lint standards override" },
  { configure: configureArchivedRepository, name: "archived empty repository with explicit waivers" },
  { configure: configureChangieIndentViolation, name: "changie config 4-space indent violation" },
  { configure: configureFloatingMiseAction, name: "floating shared mise action ref" },
  {
    configure: configureConcurrencyDeadlock,
    name: "drift caller shares its plan callee concurrency group",
  },
];

module.exports = { scenarios };
