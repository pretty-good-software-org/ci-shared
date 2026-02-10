---
last_validated: 2026-02-10T00:00:00Z
project_type: github-actions
---

# Agent Instructions: ci-shared

## Repository Overview

Shared composite actions for CI/CD across the organization. Each action is a self-contained directory under `actions/` with its own `action.yml`, TypeScript implementation, bundled JS, and tests.

## Repository Structure

```text
actions/
└── post-plan-comment/
    ├── action.yml                  # Composite action definition
    ├── post-plan-comment.ts        # TypeScript source
    ├── dist/
    │   └── index.js                # Bundled JS (committed, used at runtime)
    └── tests/
        ├── build-comment.test.ts   # Tests for buildComment
        └── post-comment.test.ts    # Tests for postComment
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
- Each action is self-contained (no shared code between actions)
- Source is TypeScript (`.ts`), bundled JavaScript (`dist/index.js`) is committed
- Tests must pass before merge
- Conventional commits enforced via commitlint
- Squash merge only

## Setup

```bash
# Install all dev tools and git hooks
task setup
```

This runs `mise install` (node 22, task 3, actionlint, yamllint, markdownlint-cli2, oxlint, oxfmt, lefthook), configures git hooks via lefthook, and installs npm dependencies (commitlint, typescript, @types/node, @vercel/ncc).

## Available Commands

```bash
task setup              # Install dev tools, git hooks, and npm deps
task build              # Compile TypeScript to JavaScript via ncc
task test               # Run all tests (auto-discovered via actions/*/tests/*.test.ts)
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
task test
```

Tests are auto-discovered via the glob `actions/*/tests/*.test.ts`. No additional test dependencies are needed.

## Tool Management

Tools are managed via [mise](https://mise.jdx.dev/):

- `.mise.toml` — base tools (node 22, task 3, actionlint, yamllint, markdownlint-cli2, oxlint, oxfmt)
- `.mise.development.toml` — local dev extras (lefthook)
- `.mise.ci.toml` — CI profile (empty, uses base tools only)

## Git Workflow

1. Run `git status` to check current state
2. Create a feature branch from `main`
3. Make changes and commit using conventional commits
4. Run `task ci:validate` before pushing
5. Push and create a PR — squash merge only

### Git Hooks

Managed via [lefthook](https://github.com/evilmartians/lefthook). Hooks are split into files under `lefthook/`:

- **commit-msg** — enforces conventional commits via commitlint
- **pre-commit (general)** — trailing whitespace, EOF newline, YAML syntax, large files, merge conflicts
- **pre-commit (ci)** — actionlint, yamllint, markdownlint, oxlint, oxfmt, typecheck

## Adding a New Action

1. Create `actions/<action-name>/action.yml` with composite action definition
2. Add implementation in TypeScript alongside `action.yml`
3. Add tests in `actions/<action-name>/tests/` using Node built-in test runner (`node:test` + `node:assert`)
4. Tests are auto-discovered via `actions/*/tests/*.test.ts` glob
5. Run `task build` to bundle TypeScript with `ncc` — compiled `dist/index.js` must be committed

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
