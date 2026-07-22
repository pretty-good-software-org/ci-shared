const { chmodSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { replaceInFixture, writeFixtureFile } = require("./fixture.ts");
const { configureRumdlRepository } = require("./contract-rumdl.ts");
const { compatibilityBoundaryScenarios } = require("./contract-rumdl-boundaries.ts");

interface ContractScenario {
  configure: (root: string) => void;
  expectedStatus: number;
  name: string;
}

interface Replacement {
  from: string;
  path: string;
  to: string;
}

const executableMode = 0o755;
const passingStatus = 0;
const failingStatus = 1;
const replace = (root: string, replacement: Replacement): void => replaceInFixture({ ...replacement, root });

const configureMixedLintContracts = (root: string): void => {
  configureRumdlRepository(root);
  writeFixtureFile(root, ".markdownlint-cli2.jsonc");
  writeFixtureFile(root, "mise-tasks/lint/markdownlint");
  replace(root, {
    from: "#MISE depends=[lint:actionlint, lint:yamllint, lint:rumdl]",
    path: "mise-tasks/lint/default",
    to: "#MISE depends=[lint:actionlint, lint:yamllint, lint:markdownlint, lint:rumdl]",
  });
};

const configureRumdlWithLegacyToolState = (root: string): void => {
  configureRumdlRepository(root);
  replace(root, {
    from: '[tools]\nnode = "22.22.1"\n',
    path: ".mise.toml",
    to: '[tools]\nmarkdownlint-cli2 = "0.22.0"\nnode = "22.22.1"\n',
  });
  writeFixtureFile(root, "mise.lock", '[[tools.markdownlint-cli2]]\nversion = "0.22.0"\n');
};

const configureCommentedOnlyFake = (root: string): void => {
  configureRumdlRepository(root);
  writeFixtureFile(
    root,
    ".rumdl.toml",
    `[global]
fixable = [
  # "MD007"
  # "MD013"
  # "MD029"
  # "MD047"
  # "MD060"
  # "MD071"
  # "MD076"
]
`,
  );
  writeFixtureFile(root, "mise-tasks/lint/rumdl", "# rumdl check --deny-config-warnings\n");
  chmodSync(join(root, "mise-tasks/lint/rumdl"), executableMode);
};

const configureMissingRumdlTask = (root: string): void => {
  configureRumdlRepository(root);
  rmSync(join(root, "mise-tasks/lint/rumdl"), { force: true });
};

const configureMissingRumdlConfig = (root: string): void => {
  configureRumdlRepository(root);
  rmSync(join(root, ".rumdl.toml"), { force: true });
};

const contractScenarios: ContractScenario[] = [
  { configure: () => {}, expectedStatus: passingStatus, name: "legacy markdownlint contract pass" },
  { configure: configureRumdlRepository, expectedStatus: passingStatus, name: "rumdl disable-style contract pass" },
  { configure: configureMixedLintContracts, expectedStatus: failingStatus, name: "partial mixed lint contract fail" },
  {
    configure: configureRumdlWithLegacyToolState,
    expectedStatus: failingStatus,
    name: "rumdl contract with legacy pin and lock fail",
  },
  {
    configure: configureCommentedOnlyFake,
    expectedStatus: failingStatus,
    name: "commented-only rumdl contract fake fail",
  },
  { configure: configureMissingRumdlTask, expectedStatus: failingStatus, name: "missing rumdl task fail" },
  { configure: configureMissingRumdlConfig, expectedStatus: failingStatus, name: "missing rumdl config fail" },
  ...compatibilityBoundaryScenarios,
];

module.exports = { contractScenarios };
