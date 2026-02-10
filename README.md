# ci-shared

Shared composite actions for CI/CD across the organization.

## Actions

### post-plan-comment

Posts OpenTofu plan results as a PR comment. Creates a new comment or updates an existing one.

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

| Input | Description |
|-------|-------------|
| `plan` | OpenTofu plan output text |
| `fmt_outcome` | Outcome of the format check step |
| `init_outcome` | Outcome of the init step |
| `validate_outcome` | Outcome of the validate step |
| `plan_outcome` | Outcome of the plan step |
| `has_violations` | Whether conftest policy violations were found (`true`/`false`) |
| `actor` | GitHub actor who triggered the workflow |

## Development

Prerequisites: [mise](https://mise.jdx.dev/)

```bash
# Install all dev tools (node, task, linters) and git hooks
task setup

# Run tests
task test

# Run all linters
task lint

# Compile TypeScript and bundle with ncc
task build

# Run full CI validation locally (build + lint + test)
task ci:validate
```

## Adding a New Action

1. Create `actions/<action-name>/action.yml` with composite action definition
2. Add implementation in TypeScript alongside `action.yml`
3. Add tests in `actions/<action-name>/tests/` using Node built-in test runner (`node:test` + `node:assert`)
4. Tests are auto-discovered via `actions/*/tests/*.test.ts` glob
5. Run `task build` to bundle with `ncc` — compiled `dist/index.js` must be committed

## Versioning

Consumers pin to `@v1` (floating major tag). On release:

```bash
git tag -a v1.x.x -m "Release description"
git tag -f v1 v1.x.x
git push origin v1.x.x v1 --force
```
