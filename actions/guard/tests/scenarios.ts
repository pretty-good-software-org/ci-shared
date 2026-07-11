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
  writeFixtureFile(root, ".guardrc", "GUARD_SKIP_CHECKS=a,b,c,d,e,f,g,h,i\n");
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
];

module.exports = { scenarios };
