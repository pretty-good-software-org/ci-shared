const { chmodSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { replaceInFixture, writeFixtureFile } = require("./fixture.ts");

interface Replacement {
  from: string;
  path: string;
  to: string;
}

const executableMode = 0o755;
const compatibilityOptions = [
  { key: "reflow-mode", section: "MD013", value: '"default"', wrongValue: '"compact"' },
  { key: "code-blocks", section: "MD013", value: "false", wrongValue: "true" },
  { key: "code-spans", section: "MD013", value: "false", wrongValue: "true" },
  { key: "headings", section: "MD013", value: "false", wrongValue: "true" },
  { key: "tables", section: "MD013", value: "false", wrongValue: "true" },
  { key: "code-blocks", section: "MD010", value: "true", wrongValue: "false" },
  { key: "list-items", section: "MD027", value: "true", wrongValue: "false" },
  { key: "ignore-case", section: "MD051", value: "false", wrongValue: "true" },
];
const rumdlSections = [
  { block: "[MD010]\ncode-blocks = true\n", section: "MD010" },
  {
    block:
      '[MD013]\nline-length = 120\nreflow = true\nreflow-mode = "default"\ncode-blocks = false\ncode-spans = false\nheadings = false\ntables = false\n',
    section: "MD013",
  },
  { block: "[MD027]\nlist-items = true\n", section: "MD027" },
  { block: "[MD051]\nignore-case = false\n", section: "MD051" },
];
const compatibilitySections = rumdlSections.map(({ section }) => section);
const rumdlConfig = `[global]
disable = ["MD029", "MD060"]
fixable = ["MD007", "MD013", "MD029", "MD047", "MD060", "MD071", "MD076"]
line-length = 120
flavor = "gfm"

${rumdlSections.map(({ block }) => block).join("\n")}`;
const rumdlTask = `#!/usr/bin/env bash
set -euo pipefail

git ls-files -z -- '*.md' | xargs -0 rumdl check --deny-config-warnings --
`;
const directRumdlTask = `#!/usr/bin/env bash
set -euo pipefail

rumdl check --deny-config-warnings -- .
`;

const replace = (root: string, replacement: Replacement): void => {
  replaceInFixture({ ...replacement, root });
};

const configureRumdlRepositoryBase = (root: string): void => {
  for (const path of [".markdownlint-cli2.jsonc", "mise-tasks/lint/markdownlint"]) {
    rmSync(join(root, path), { force: true });
  }
  replace(root, {
    from: "#MISE depends=[lint:actionlint, lint:yamllint, lint:markdownlint]",
    path: "mise-tasks/lint/default",
    to: "#MISE depends=[lint:actionlint, lint:yamllint, lint:rumdl]",
  });
  writeFixtureFile(root, ".rumdl.toml", rumdlConfig);
};

const writeRumdlTask = (root: string, task: string): void => {
  writeFixtureFile(root, "mise-tasks/lint/rumdl", task);
  chmodSync(join(root, "mise-tasks/lint/rumdl"), executableMode);
};

const configureRumdlRepository = (root: string): void => {
  configureRumdlRepositoryBase(root);
  writeRumdlTask(root, rumdlTask);
};

const configureDirectRumdlRepository = (root: string): void => {
  configureRumdlRepositoryBase(root);
  writeRumdlTask(root, directRumdlTask);
};

const findSectionBlock = (section: string): string => {
  const definition = rumdlSections.find((candidate) => candidate.section === section);
  if (!definition) {
    throw new Error(`missing rumdl section fixture for [${section}]`);
  }
  return definition.block;
};

const mutateSection = (root: string, section: string, replacement: string): void => {
  replace(root, { from: findSectionBlock(section), path: ".rumdl.toml", to: replacement });
};

const optionLine = (option: (typeof compatibilityOptions)[number]): string => `${option.key} = ${option.value}\n`;
const mutateOption = (root: string, option: (typeof compatibilityOptions)[number], replacement: string): void => {
  replace(root, { from: optionLine(option), path: ".rumdl.toml", to: replacement });
};
module.exports = {
  compatibilityOptions,
  compatibilitySections,
  configureDirectRumdlRepository,
  configureRumdlRepository,
  findSectionBlock,
  mutateOption,
  mutateSection,
  optionLine,
};
