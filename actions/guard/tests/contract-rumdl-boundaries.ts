interface CompatibilityOption {
  key: string;
  section: string;
  value: string;
  wrongValue: string;
}

const {
  compatibilityOptions,
  compatibilitySections,
  configureRumdlRepository,
  findSectionBlock,
  mutateOption,
  mutateSection,
  optionLine,
}: {
  compatibilityOptions: CompatibilityOption[];
  compatibilitySections: string[];
  configureRumdlRepository: (root: string) => void;
  findSectionBlock: (section: string) => string;
  mutateOption: (root: string, option: CompatibilityOption, replacement: string) => void;
  mutateSection: (root: string, section: string, replacement: string) => void;
  optionLine: (option: CompatibilityOption) => string;
} = require("./contract-rumdl.ts");

interface ContractScenario {
  configure: (root: string) => void;
  expectedError: string;
  expectedStatus: number;
  name: string;
}

const failingStatus = 1;
const boundaryScenario = (name: string, expectedError: string, mutate: (root: string) => void): ContractScenario => ({
  configure: (root) => {
    configureRumdlRepository(root);
    mutate(root);
  },
  expectedError,
  expectedStatus: failingStatus,
  name,
});
const commented = (block: string): string =>
  block
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
const duplicateCount = 2;

const compatibilityBoundaryScenarios: ContractScenario[] = [
  ...compatibilityOptions.map((option) =>
    boundaryScenario(
      `rumdl ${option.section}.${option.key} missing option fail`,
      `missing active [${option.section}] ${option.key} option`,
      (root) => mutateOption(root, option, ""),
    ),
  ),
  ...compatibilitySections.map((section) =>
    boundaryScenario(`rumdl ${section} missing section fail`, `missing active [${section}] section`, (root) =>
      mutateSection(root, section, ""),
    ),
  ),
  ...compatibilityOptions.map((option) =>
    boundaryScenario(
      `rumdl ${option.section}.${option.key} wrong value fail`,
      `[${option.section}] ${option.key} must be ${option.value}, got ${option.wrongValue}`,
      (root) => mutateOption(root, option, `${option.key} = ${option.wrongValue}\n`),
    ),
  ),
  ...compatibilitySections.map((section) =>
    boundaryScenario(`rumdl ${section} duplicate section fail`, `duplicate active [${section}] sections`, (root) => {
      const block = findSectionBlock(section);
      mutateSection(root, section, `${block}${block}`);
    }),
  ),
  ...compatibilitySections.map((section) =>
    boundaryScenario(`rumdl ${section} commented-only section fail`, `missing active [${section}] section`, (root) =>
      mutateSection(root, section, commented(findSectionBlock(section))),
    ),
  ),
  ...compatibilityOptions.map((option) =>
    boundaryScenario(
      `rumdl ${option.section}.${option.key} duplicate option fail`,
      `duplicate active [${option.section}] ${option.key} options`,
      (root) => mutateOption(root, option, optionLine(option).repeat(duplicateCount)),
    ),
  ),
  ...compatibilityOptions.map((option) =>
    boundaryScenario(
      `rumdl ${option.section}.${option.key} commented-only option fail`,
      `missing active [${option.section}] ${option.key} option`,
      (root) => mutateOption(root, option, `# ${optionLine(option)}`),
    ),
  ),
];

module.exports = { compatibilityBoundaryScenarios };
