# Agent Instructions: ci-shared

## Overview

Shared composite actions for CI/CD across the organization. Each action is a self-contained directory under `actions/` with its own `action.yml`, implementation, and tests.

## Structure

```text
actions/
└── post-plan-comment/
    ├── action.yml                  # Composite action definition
    ├── post-plan-comment.js        # Script (runs via actions/github-script)
    └── tests/
        ├── build-comment.test.js   # Tests for buildComment
        └── post-comment.test.js    # Tests for postComment
.github/workflows/
└── ci.yml                          # Self-CI: tests + linting via mise + task
lefthook/
├── ci.yml                          # actionlint, yamllint, markdownlint, oxlint, oxfmt hooks
├── commit-msg.yml                  # commitlint hook
└── general.yml                     # whitespace, EOF, merge conflict, large file hooks
```

## Setup

```bash
# Install all dev tools and git hooks
task setup
```

This installs mise tools (node, task, actionlint, yamllint, markdownlint-cli2, oxlint, oxfmt, lefthook), configures git hooks via lefthook, and installs npm dependencies (commitlint).

## Commands

```bash
# Run tests
task test

# Run all linters (actionlint + yamllint + markdownlint + oxlint + oxfmt)
task lint

# Run individual linters
task lint:actions
task lint:yaml
task lint:markdown
task lint:js

# Auto-format JavaScript files
task format

# Check JavaScript formatting
task format:check

# Run full CI validation locally
task ci:validate
```

## Tool Management

Tools are managed via [mise](https://mise.jdx.dev/):

- `.mise.toml` — base tools (node, task, actionlint, yamllint, markdownlint-cli2, oxlint, oxfmt)
- `.mise.development.toml` — local dev extras (lefthook)
- `.mise.ci.toml` — CI profile (empty, uses base tools only)

## Git Hooks

Managed via [lefthook](https://github.com/evilmartians/lefthook). Hooks are split into files under `lefthook/`:

- **commit-msg** — enforces conventional commits via commitlint
- **pre-commit (general)** — trailing whitespace, EOF newline, YAML syntax, large files, merge conflicts
- **pre-commit (ci)** — actionlint, yamllint, markdownlint, oxlint, oxfmt

## Adding a New Action

1. Create `actions/<action-name>/action.yml` with composite action definition
2. Add implementation script alongside `action.yml`
3. Add tests in `actions/<action-name>/tests/` using Node built-in test runner (`node:test` + `node:assert`)
4. Tests are auto-discovered via `actions/*/tests/*.test.js` glob

## Versioning

Consumers pin to `@v1` (floating major tag). On release:

```bash
git tag -a v1.x.x -m "Release description"
git tag -f v1 v1.x.x
git push origin v1.x.x v1 --force
```

## Consumer Usage

```yaml
- uses: OlechowskiMichal/ci-shared/actions/post-plan-comment@v1
  with:
    plan: ${{ steps.plan.outputs.plan }}
    fmt_outcome: ${{ steps.fmt.outcome }}
    init_outcome: ${{ steps.init.outcome }}
    validate_outcome: ${{ steps.validate.outcome }}
    plan_outcome: ${{ steps.plan.outcome }}
    has_violations: ${{ steps.policy.outputs.has_violations }}
    actor: ${{ github.actor }}
```

## Guidelines

- Zero npm dependencies — use Node built-in modules only
- Each action is self-contained (no shared code between actions)
- Tests must pass before merge
- Conventional commits
- Squash merge only
