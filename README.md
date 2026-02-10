# ci-shared

Shared composite actions for CI/CD across the organization.

## Actions

### setup/mise

Checkout repository and install tools via mise.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/setup/mise@v1
  with:
    mise-env: ci
```

| Input | Description | Default |
|-------|-------------|---------|
| `mise-env` | MISE_ENV value (e.g., `ci`) | `''` |

### tofu/fmt-check

Check OpenTofu formatting.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/fmt-check@v1
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |

### tofu/init

Initialize OpenTofu configuration.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/init@v1
  with:
    backend: 'false'
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |
| `backend` | Enable backend initialization (`true`/`false`) | `true` |

### tofu/validate

Validate OpenTofu configuration.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/validate@v1
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |

### tofu/plan

Create OpenTofu plan and capture outputs.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/plan@v1
  id: plan
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |

| Output | Description |
|--------|-------------|
| `plan` | Plan text (truncated to 60k chars) |
| `plan-file` | Path to binary plan file |
| `plan-json` | Path to JSON plan file |

### tofu/apply

Apply an OpenTofu plan.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/apply@v1
  with:
    plan-file: ${{ steps.plan.outputs.plan-file }}
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |
| `plan-file` | Path to the plan file (relative to working directory) | `plan.tfplan` |

### tofu/policy

Run Conftest policy checks against an OpenTofu plan.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/policy@v1
  with:
    plan-json: ${{ steps.plan.outputs.plan-json }}
```

| Input | Description | Default |
|-------|-------------|---------|
| `plan-json` | Path to the JSON plan file | `tofu/plan.json` |

| Output | Description |
|--------|-------------|
| `has_violations` | Whether policy violations were found (`true`/`false`) |
| `policy_violations` | Violation details (empty if none) |

### tofu/build-plan-comment

Builds OpenTofu plan results as a markdown comment body.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/tofu/build-plan-comment@v1
  id: comment
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

| Output | Description |
|--------|-------------|
| `comment-body` | Markdown comment body |

### github/comment

Create or update a PR comment identified by a marker string.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/github/comment@v1
  with:
    comment-body: ${{ steps.comment.outputs.comment-body }}
    comment-identifier: '### OpenTofu Plan Results'
```

| Input | Description |
|-------|-------------|
| `comment-body` | Full markdown body of the comment |
| `comment-identifier` | String used to match an existing comment (matched via startsWith) |

### aws/cleanup-s3

Delete S3 buckets matching a prefix. Handles versioned buckets.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/aws/cleanup-s3@v1
  with:
    prefix: my-test-bucket-
```

| Input | Description | Default |
|-------|-------------|---------|
| `prefix` | Bucket name prefix to match | (required) |
| `region` | AWS region | `us-east-1` |

### aws/cleanup-dynamodb

Delete DynamoDB tables matching a prefix.

```yaml
- uses: OlechowskiMichal/ci-shared/actions/aws/cleanup-dynamodb@v1
  with:
    prefix: my-test-table-
```

| Input | Description | Default |
|-------|-------------|---------|
| `prefix` | Table name prefix to match | (required) |
| `region` | AWS region | `us-east-1` |

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

1. Create `actions/<category>/<action-name>/action.yml` with composite action definition
2. Add implementation in TypeScript alongside `action.yml`
3. Add tests in `actions/<category>/<action-name>/tests/` using Node built-in test runner (`node:test` + `node:assert`)
4. Tests are auto-discovered via `actions/*/*/tests/*.test.ts` glob
5. Run `task build` to bundle with `ncc` — compiled `dist/index.js` must be committed

## Versioning

Consumers pin to `@v1` (floating major tag). On release:

```bash
git tag -a v1.x.x -m "Release description"
git tag -f v1 v1.x.x
git push origin v1.x.x v1 --force
```
