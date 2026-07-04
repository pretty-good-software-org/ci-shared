---
last_validated: 2026-02-10T00:00:00Z
project_type: github-actions
---

# Agent Instructions: ci-shared

## Repository Overview

Shared composite actions for CI/CD across the organization. Each action is a self-contained directory under `actions/` with its own `action.yml`, TypeScript implementation, bundled JS, and tests.

## Repository Structure

```text
lib/
├── exec.ts                         # Shared execution helpers (execCapture, execStream, execStreamWithEnv)
├── github-output.ts                # GitHub Actions output writer (writeGitHubOutput, resolveOutputWriter)
└── test-helpers.ts                 # Shared test mocks (mockExec, captureCommands, captureOutputs, etc.)
actions/
├── aws/
│   ├── cleanup-dynamodb/           # Delete DynamoDB tables by prefix
│   │   ├── action.yml
│   │   ├── action.ts
│   │   ├── dist/index.js
│   │   └── tests/cleanup-dynamodb.test.ts
│   └── cleanup-s3/                 # Delete S3 buckets by prefix (versioned)
│       ├── action.yml
│       ├── action.ts
│       ├── dist/index.js
│       └── tests/cleanup-s3.test.ts
├── setup/
│   └── mise/                       # Checkout + mise install
│       ├── action.yml
│       ├── action.ts
│       ├── dist/index.js
│       └── tests/mise.test.ts
├── github/
│   └── comment/            # Create or update PR comment by identifier
│       ├── action.yml
│       ├── action.ts
│       ├── dist/index.js
│       └── tests/comment.test.ts
└── tofu/
    ├── analyze-drift/              # Detect infrastructure drift from plan JSON
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/analyze-drift.test.ts
    ├── apply/                      # Apply plan
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/apply.test.ts
    ├── build-plan-details/          # Build plan output as collapsible details block
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/build-plan-details.test.ts
    ├── build-policy-summary/        # Build policy check result markdown fragment
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/build-policy-summary.test.ts
    ├── build-step-summary/          # Build step outcomes markdown fragment
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/build-step-summary.test.ts
    ├── fmt-check/                  # Check formatting
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/fmt-check.test.ts
    ├── init/                       # Initialize configuration
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/init.test.ts
    ├── plan/                       # Create plan + capture outputs
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/plan.test.ts
    ├── policy/                     # Conftest policy check
    │   ├── action.yml
    │   ├── action.ts
    │   ├── dist/index.js
    │   └── tests/policy.test.ts
    └── validate/                   # Validate configuration
        ├── action.yml
        ├── action.ts
        ├── dist/index.js
        └── tests/validate.test.ts
taskfiles/
├── setup.yml                       # Dev tools, git hooks, npm deps
├── build.yml                       # ncc build
├── lint.yml                        # All linters (actionlint, yamllint, markdownlint, oxlint, oxfmt, typecheck)
├── test.yml                        # Node test runner
└── release.yml                     # Changelog generation and release flow
.github/workflows/
└── ci.yml                          # Self-CI: tests + linting + build via mise + task
lefthook/
├── ci.yml                          # actionlint, yamllint, markdownlint, oxlint, oxfmt, typecheck hooks
├── commit-msg.yml                  # commitlint hook
└── general.yml                     # whitespace, EOF, merge conflict, large file hooks
```

## Development Guidelines

- Zero npm runtime dependencies — use Node built-in modules only
- `typescript` and `@types/node` are devDependencies only (build-time)
- Shared helpers live in `lib/` — ncc inlines them into each action's `dist/index.js`
- Source is TypeScript (`.ts`), bundled JavaScript (`dist/index.js`) is committed
- Tests must pass before merge
- Conventional commits enforced via commitlint
- Entry point for each action is `action.ts` — other `.ts` files in the directory are helpers bundled via `require()`
- Squash merge only

## Setup

```bash
# Install all dev tools and git hooks
mise run setup
```

This runs `mise install` (node 22, actionlint, yamllint, markdownlint-cli2, oxlint, oxfmt, lefthook), configures git hooks via lefthook, and installs npm dependencies (commitlint, typescript, @types/node, @vercel/ncc).

## Available Commands

```bash
task setup              # Install dev tools, git hooks, and npm deps
task build              # Compile TypeScript to JavaScript via ncc
task test               # Run all tests (auto-discovered via actions/*/*/tests/*.test.ts)
task lint               # Run all linters (actionlint + yamllint + markdownlint + oxlint + typecheck + oxfmt)
task lint:actions       # Lint GitHub Actions workflows
task lint:yaml          # Lint YAML files
task lint:markdown      # Lint Markdown files
task lint:ts            # Lint TypeScript files
task lint:typecheck     # Type-check TypeScript files
task lint:format        # Auto-format TypeScript files
task lint:format:check  # Check TypeScript formatting
task ci:validate        # Run full CI validation locally (build + lint + test)
task release:changelog  # Generate CHANGELOG.md from commit history
task release:release    # Create a release (usage: task release:release VERSION=x.y.z)
```

## Testing

Tests use Node built-in test runner (`node:test` + `node:assert`) with `--experimental-strip-types` to run TypeScript directly.

```bash
mise run test
```

Tests are auto-discovered via the glob `actions/*/*/tests/*.test.ts`. No additional test dependencies are needed.

## Tool Management

Tools are managed via [mise](https://mise.jdx.dev/):

- `.mise.toml` — base tools (node 22, actionlint, yamllint, markdownlint-cli2, oxlint, oxfmt)
- `.mise.development.toml` — local dev extras (lefthook)
- `.mise.ci.toml` — CI profile (empty, uses base tools only)

## Git Workflow

1. Run `git status` to check current state
2. Create a feature branch from `main`
3. Make changes and commit using conventional commits
4. Run `mise run ci:validate` before pushing
5. Push and create a PR — squash merge only

### Git Hooks

Managed via [lefthook](https://github.com/evilmartians/lefthook). Hooks are split into files under `lefthook/`:

- **commit-msg** — enforces conventional commits via commitlint
- **pre-commit (general)** — trailing whitespace, EOF newline, YAML syntax, large files, merge conflicts
- **pre-commit (ci)** — actionlint, yamllint, markdownlint, oxlint, oxfmt, typecheck

## Adding a New Action

1. Create `actions/<category>/<action-name>/action.yml` with composite action definition
2. Add implementation in `action.ts` alongside `action.yml`
3. Add tests in `actions/<category>/<action-name>/tests/` using Node built-in test runner (`node:test` + `node:assert`)
4. Tests are auto-discovered via `actions/*/*/tests/*.test.ts` glob
5. Run `mise run build` to bundle TypeScript with `ncc` — compiled `dist/index.js` must be committed

## Versioning

Consumers pin to `@v1` (floating major tag). On release:

```bash
git tag -a v1.x.x -m "Release description"
git tag -f v1 v1.x.x
git push origin v1.x.x v1 --force
```

## Consumer Usage

```yaml
# Setup
- uses: prettygood-software/ci-shared/actions/setup/mise@v1
  with:
    mise-env: ci

# OpenTofu workflow
- uses: prettygood-software/ci-shared/actions/tofu/fmt-check@v1
- uses: prettygood-software/ci-shared/actions/tofu/init@v1
- uses: prettygood-software/ci-shared/actions/tofu/validate@v1
- uses: prettygood-software/ci-shared/actions/tofu/plan@v1
  id: plan
- uses: prettygood-software/ci-shared/actions/tofu/policy@v1
  with:
    plan-json: ${{ steps.plan.outputs.plan-json }}
- uses: prettygood-software/ci-shared/actions/tofu/build-step-summary@v1
  id: step-summary
  with:
    fmt_outcome: ${{ steps.fmt.outcome }}
    init_outcome: ${{ steps.init.outcome }}
    validate_outcome: ${{ steps.validate.outcome }}
    plan_outcome: ${{ steps.plan.outcome }}
- uses: prettygood-software/ci-shared/actions/tofu/build-plan-details@v1
  id: plan-details
  with:
    plan: ${{ steps.plan.outputs.plan }}
- uses: prettygood-software/ci-shared/actions/tofu/build-policy-summary@v1
  id: policy-summary
  with:
    has_violations: ${{ steps.policy.outputs.has_violations }}
    actor: ${{ github.actor }}
- uses: prettygood-software/ci-shared/actions/github/comment@v1
  with:
    comment-body: |
      ${{ steps.step-summary.outputs.step-summary }}
      ${{ steps.plan-details.outputs.plan-details }}
      ${{ steps.policy-summary.outputs.policy-summary }}
    comment-identifier: '### OpenTofu Plan Results'
- uses: prettygood-software/ci-shared/actions/tofu/apply@v1
  with:
    plan-file: ${{ steps.plan.outputs.plan-file }}

# Drift detection
- uses: prettygood-software/ci-shared/actions/tofu/analyze-drift@v1
  id: drift
  with:
    plan-json: ${{ steps.plan.outputs.plan-json }}

# AWS cleanup
- uses: prettygood-software/ci-shared/actions/aws/cleanup-s3@v1
  with:
    prefix: my-test-bucket-
- uses: prettygood-software/ci-shared/actions/aws/cleanup-dynamodb@v1
  with:
    prefix: my-test-table-
```
