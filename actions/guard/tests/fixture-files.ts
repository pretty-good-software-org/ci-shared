const requiredFiles = [
  ".actionlint.yml",
  ".coderabbit.yaml",
  ".github/workflows/lint.yml",
  ".markdownlint-cli2.jsonc",
  ".mise.toml",
  ".mise.ci.toml",
  ".mise.development.toml",
  ".miserc.toml",
  ".yamllint.yml",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "cog.toml",
  "lefthook.yml",
  "lefthook/commit-msg.yml",
  "lefthook/files.yml",
  "lefthook/lint.yml",
  "lefthook/secrets.yml",
  "mise-tasks/lint/actionlint",
  "mise-tasks/lint/default",
  "mise-tasks/lint/markdownlint",
  "mise-tasks/lint/yamllint",
  "mise-tasks/setup/default",
  "mise.lock",
  "mise.development.lock",
];

const goConfig = `linters-settings:
  cyclop:
    max-complexity: 10
  gocognit:
    min-complexity: 15
  funlen:
    lines: 60
    statements: 40
  nestif:
    min-complexity: 4
  lll:
    line-length: 120
  revive:
    rules:
      - name: file-length-limit
        arguments:
          - max: 300
`;

const pythonConfig = `[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["C90", "PLR"]

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.lint.pylint]
max-branches = 12
max-args = 6
max-statements = 50
max-returns = 6
`;

const exactToolPin = '[tools]\nnode = "22.22.1"\n';
const fixtureContents: Record<string, string> = {
  ".github/workflows/lint.yml":
    "concurrency:\n  group: lint\njobs:\n  lint:\n    runs-on: [self-hosted, Linux, ARM64]\n    steps:\n      - uses: pretty-good-software-org/ci-shared/actions/setup/mise@v1\n      - run: mise run lint:default\n",
  ".golangci.yml": goConfig,
  ".mise.ci.toml": exactToolPin,
  ".mise.development.toml": exactToolPin,
  ".mise.toml": exactToolPin,
  ".yamllint.yml": "rules:\n  line-length:\n    max: 120\n",
  "Cargo.toml": '[lints.clippy]\npedantic = "deny"\n',
  "clippy.toml": "too-many-lines-threshold = 80\n",
  "go.mod": "module example.test/guard\n",
  "lefthook.yml":
    "extends:\n  - lefthook/files.yml\n  - lefthook/lint.yml\n  - lefthook/commit-msg.yml\n  - lefthook/secrets.yml\n",
  "mise-tasks/lint/default": "#MISE depends=[lint:actionlint, lint:yamllint, lint:markdownlint]\n",
  "pyproject.toml": pythonConfig,
};

module.exports = { fixtureContents, requiredFiles };
