# ci-shared

Shared composite actions for CI/CD across the organization.

## Actions

### setup/mise

Checkout repository and install tools via mise.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/setup/mise@v1
  with:
    mise-env: ci
```

| Input | Description | Default |
|-------|-------------|---------|
| `mise-env` | MISE_ENV value (e.g., `ci`) | `''` |

### setup/npm-auth

Authenticate npm/bun installs against GitHub Packages using a GitHub App installation token, instead of the
per-repo "Actions access" grant configured in each private package's Settings UI. Those grants are unreproducible
state — there is no API to manage them, and the 2026-07-05 org rename silently dropped most of them and took org
CI down. This action mints a short-lived token the same way `org-aws-infrastructure/.github/workflows/plan.yml`
already does for private policy fetching, writes `~/.npmrc` to route the configured scope to
`npm.pkg.github.com`, and exports `NODE_AUTH_TOKEN` for install steps that read the token from the environment
instead.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/setup/npm-auth@v1
  with:
    app-id: ${{ secrets.CI_PRIVATE_CONTENT_APP_ID }}
    private-key: ${{ secrets.CI_PRIVATE_CONTENT_PRIVATE_KEY }}
```

| Input | Description | Default |
|-------|-------------|---------|
| `app-id` | GitHub App ID | (required) |
| `private-key` | GitHub App private key | (required) |
| `scope` | npm scope to route to GitHub Packages | `@pretty-good-software-org` |

The App backing `CI_PRIVATE_CONTENT_APP_ID` needs the `packages: read` permission. That permission is granted in
the GitHub App settings UI by an org admin — it is not something this action or its workflow can configure.

**Migrating a consumer workflow**, replacing the `GITHUB_TOKEN` env var on a bun/npm install step with a minted
App token:

```diff
+      - uses: pretty-good-software-org/ci-shared/actions/setup/npm-auth@v1
+        with:
+          app-id: ${{ secrets.CI_PRIVATE_CONTENT_APP_ID }}
+          private-key: ${{ secrets.CI_PRIVATE_CONTENT_PRIVATE_KEY }}

       - name: Install dependencies
         run: bun install
-        env:
-          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> Consumer repos are not migrated by this change — see the PR description for the rollout plan.

### tofu/fmt-check

Check OpenTofu formatting.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/fmt-check@v1
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |

### tofu/init

Initialize OpenTofu configuration.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/init@v1
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
- uses: pretty-good-software-org/ci-shared/actions/tofu/validate@v1
```

| Input | Description | Default |
|-------|-------------|---------|
| `working-directory` | Directory containing OpenTofu configuration | `tofu` |

### tofu/plan

Create OpenTofu plan and capture outputs.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/plan@v1
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
- uses: pretty-good-software-org/ci-shared/actions/tofu/apply@v1
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
- uses: pretty-good-software-org/ci-shared/actions/tofu/policy@v1
  with:
    plan-json: ${{ steps.plan.outputs.plan-json }}
```

| Input | Description | Default |
|-------|-------------|---------|
| `plan-json` | Path to the JSON plan file | `tofu/plan.json` |
| `client-id` | GitHub App client ID for cross-repo policy fetching | `''` |
| `private-key` | GitHub App private key for cross-repo policy fetching | `''` |
| `app-id` | Deprecated GitHub App ID for cross-repo policy fetching | `''` |

| Output | Description |
|--------|-------------|
| `has_violations` | Whether policy violations were found (`true`/`false`) |
| `policy_violations` | Violation details (empty if none) |

### tofu/build-plan-details

Builds OpenTofu plan output as a collapsible markdown fragment.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/build-plan-details@v1
  id: plan-details
  with:
    plan: ${{ steps.plan.outputs.plan }}
```

| Input | Description |
|-------|-------------|
| `plan` | OpenTofu plan output text |

| Output | Description |
|--------|-------------|
| `plan-details` | Collapsible details block with terraform code fence |

### github/comment

Create or update a PR comment identified by a marker string.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/github/comment@v1
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
- uses: pretty-good-software-org/ci-shared/actions/aws/cleanup-s3@v1
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
- uses: pretty-good-software-org/ci-shared/actions/aws/cleanup-dynamodb@v1
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
mise run setup

# Run tests
mise run test

# Run all linters
mise run lint

# Compile TypeScript and bundle with ncc
mise run build

# Run full CI validation locally (build + lint + test)
mise run ci:validate
```

## Adding a New Action

1. Create `actions/<category>/<action-name>/action.yml` with composite action definition
2. Add implementation in TypeScript alongside `action.yml`
3. Add tests in `actions/<category>/<action-name>/tests/` using Node built-in test runner (`node:test` + `node:assert`)
4. Tests are auto-discovered via `actions/*/*/tests/*.test.ts` glob
5. Run `mise run build` to bundle with `ncc` — compiled `dist/index.js` must be committed

## Versioning

Consumers pin to `@v1` (floating major tag). On release:

```bash
git tag -a v1.x.x -m "Release description"
git tag -f v1 v1.x.x
git push origin v1.x.x v1 --force
```
