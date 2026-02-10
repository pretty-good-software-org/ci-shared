# Agent Instructions: ci-shared

## Overview

Shared composite actions for CI/CD across the organization. Each action is a self-contained directory under `actions/` with its own `action.yml`, implementation, and tests.

## Structure

```text
actions/
└── post-plan-comment/
    ├── action.yml                  # Composite action definition
    ├── post-plan-comment.js        # Script (runs via actions/github-script)
    └── post-plan-comment.test.js   # Tests (Node built-in test runner)
.github/workflows/
└── ci.yml                          # Self-CI: tests + actionlint
```

## Commands

```bash
# Run tests
node --test actions/post-plan-comment/post-plan-comment.test.js

# Lint workflows
actionlint
```

## Adding a New Action

1. Create `actions/<action-name>/action.yml` with composite action definition
2. Add implementation script alongside `action.yml`
3. Add tests using Node built-in test runner (`node:test` + `node:assert`)
4. Update CI workflow to run new tests

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
