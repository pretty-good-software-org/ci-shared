# ci-shared

Shared composite actions for CI/CD across the organization.

## Actions

### setup/mise

Checkout repository and install tools via mise. By default, tool installs authenticate with `github-token` (the
caller's `github.token`), which cannot read private repositories. When mise needs to download a release asset from a
*private* repository — e.g. a GitHub-backend tool pinned in `mise.lock` — pass `app-id`, `private-key`, and
`private-repositories` together, and this action mints a short-lived installation token scoped to exactly those
repositories instead.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/setup/mise@v1
  with:
    mise-env: ci
```

| Input | Description | Default |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `mise-env` | MISE_ENV value (e.g., `ci`) | `''` (falls back to the caller's `MISE_ENV` env) |
| `github-token` | GitHub token for authenticated API requests during tool install | `${{ github.token }}` |
| `fetch-depth` | Checkout fetch depth; `0` for full history (needed by commit-range checks) | `1` |
| `app-id` | GitHub App ID for minting a private-release installation token | `''` (must be set together with `private-key` and `private-repositories`, or omitted) |
| `private-key` | GitHub App private key for minting a private-release installation token | `''` (must be set together with `app-id` and `private-repositories`, or omitted) |
| `private-repositories` | Comma or newline-separated repositories the minted token may access | `''` (must be set together with `app-id` and `private-key`, or omitted) |

**Installing a private release asset**, e.g. an App installed only on `skillctl` so mise can download a private tool
release referenced in `mise.lock`:

```yaml
- uses: pretty-good-software-org/ci-shared/actions/setup/mise@v1
  with:
    mise-env: ci
    app-id: ${{ secrets.CI_PRIVATE_CONTENT_APP_ID }}
    private-key: ${{ secrets.CI_PRIVATE_CONTENT_PRIVATE_KEY }}
    private-repositories: skillctl
```

If only one or two of `app-id`, `private-key`, and `private-repositories` are set, the action fails before checkout or
install with a `::error::` annotation instead of silently falling back to the default `github-token` path.

> ROAD SIGN: private GitHub tools remain checksum locked and GitHub-attestation verified. The minted token is scoped
> to `owner: ${{ github.repository_owner }}` and exactly the repositories listed in `private-repositories` — never the
> caller's own repository, never "all repositories" — and the App requires only `permission-contents: read` and
> `permission-attestations: read`. It is revoked automatically when the job ends
> (`actions/create-github-app-token`'s default `skip-token-revoke: false`). **Cost:** one extra composite step per run
> (a few seconds to mint) and no standing secret to provision or rotate, versus a long-lived per-repo PAT that must be
> manually rotated and audited. **Security:** replaces the unrepeatable per-repo "Actions access" grant (see
> `setup/npm-auth` below) with a scoped, short-lived, automatically-revoked token, so a leaked token is worthless
> after the job ends and cannot reach any repository outside the configured list. Authoritative implementation:
> `actions/setup/mise/action.yml` and `actions/setup/mise/validate-private-release-inputs.sh`; verified by
> `actions/setup/mise/tests/private-release-token.test.ts` and
> `actions/setup/mise/tests/validate-private-release-inputs.test.ts`.

### setup/npm-auth

Authenticate npm/bun installs against GitHub Packages using a GitHub App installation token, instead of the per-repo
"Actions access" grant configured in each private package's Settings UI. Those grants are unreproducible state — there
is no API to manage them, and the 2026-07-05 org rename silently dropped most of them and took org CI down. This action
mints a short-lived token the same way `org-aws-infrastructure/.github/workflows/plan.yml` already does for private
policy fetching, writes `~/.npmrc` to route the configured scope to `npm.pkg.github.com`, and exports `NODE_AUTH_TOKEN`
for install steps that read the token from the environment instead.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/setup/npm-auth@v1
  with:
    app-id: ${{ secrets.CI_PRIVATE_CONTENT_APP_ID }}
    private-key: ${{ secrets.CI_PRIVATE_CONTENT_PRIVATE_KEY }}
```

| Input         | Description                           | Default                     |
| ------------- | ------------------------------------- | --------------------------- |
| `app-id`      | GitHub App ID                         | (required)                  |
| `private-key` | GitHub App private key                | (required)                  |
| `scope`       | npm scope to route to GitHub Packages | `@pretty-good-software-org` |

The App backing `CI_PRIVATE_CONTENT_APP_ID` needs the `packages: read` permission. That permission is granted in the
GitHub App settings UI by an org admin — it is not something this action or its workflow can configure.

**Migrating a consumer workflow**, replacing the `GITHUB_TOKEN` env var on a bun/npm install step with a minted App
token:

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

### setup/org-lint-config

Install an exact private `org-lint-config` release using a repository-scoped GitHub App token. Pin this action to a full
`ci-shared` commit SHA. The action downloads only the archive asset attached to the requested tag, verifies the literal
consumer-provided digest before extraction, rejects unsafe archive entries, and publishes the output directory only
after validation succeeds. It does not download or trust the release checksum sidecar.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/setup/org-lint-config@<full-ci-shared-commit-sha>
  id: org-lint-config
  with:
    app-id: ${{ secrets.CI_PRIVATE_CONTENT_APP_ID }}
    private-key: ${{ secrets.CI_PRIVATE_CONTENT_PRIVATE_KEY }}
    version: v1.0.0
    sha256: dab95cf648e13009bd6f90b74561ed22e4444912443461789a8906071fb1f7ee
    output-directory: ${{ runner.temp }}/org-lint-config-v1.0.0
```

| Input              | Description                                    | Default    |
| ------------------ | ---------------------------------------------- | ---------- |
| `app-id`           | GitHub App ID                                  | (required) |
| `private-key`      | GitHub App private key                         | (required) |
| `version`          | Exact release tag in `v1.0.0` form             | (required) |
| `sha256`           | Literal 64-character lowercase archive SHA-256 | (required) |
| `output-directory` | Directory for the verified extracted release   | (required) |

| Output | Description                                                |
| ------ | ---------------------------------------------------------- |
| `path` | Absolute path to the installed `org-lint-config` directory |

The GitHub App installation must include only `pretty-good-software-org/org-lint-config` and grant repository
`contents: read`. The canonical implementation is `actions/setup/org-lint-config/action.yml`; its metadata and archive
safety contract are verified by `actions/setup/org-lint-config/tests/`.

### tofu/fmt-check

Check OpenTofu formatting.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/fmt-check@v1
```

| Input               | Description                                 | Default |
| ------------------- | ------------------------------------------- | ------- |
| `working-directory` | Directory containing OpenTofu configuration | `tofu`  |

### tofu/init

Initialize OpenTofu configuration.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/init@v1
  with:
    backend: 'false'
```

| Input               | Description                                    | Default |
| ------------------- | ---------------------------------------------- | ------- |
| `working-directory` | Directory containing OpenTofu configuration    | `tofu`  |
| `backend`           | Enable backend initialization (`true`/`false`) | `true`  |

### tofu/validate

Validate OpenTofu configuration.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/validate@v1
```

| Input               | Description                                 | Default |
| ------------------- | ------------------------------------------- | ------- |
| `working-directory` | Directory containing OpenTofu configuration | `tofu`  |

### tofu/plan

Create OpenTofu plan and capture outputs.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/plan@v1
  id: plan
```

| Input               | Description                                 | Default |
| ------------------- | ------------------------------------------- | ------- |
| `working-directory` | Directory containing OpenTofu configuration | `tofu`  |

| Output      | Description                        |
| ----------- | ---------------------------------- |
| `plan`      | Plan text (truncated to 60k chars) |
| `plan-file` | Path to binary plan file           |
| `plan-json` | Path to JSON plan file             |

### tofu/apply

Apply an OpenTofu plan.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/apply@v1
  with:
    plan-file: ${{ steps.plan.outputs.plan-file }}
```

| Input               | Description                                           | Default       |
| ------------------- | ----------------------------------------------------- | ------------- |
| `working-directory` | Directory containing OpenTofu configuration           | `tofu`        |
| `plan-file`         | Path to the plan file (relative to working directory) | `plan.tfplan` |

### tofu/policy

Run Conftest policy checks against an OpenTofu plan. The canonical form pins the policy repository to an exact commit
and declares every Rego package that the run must evaluate:

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/policy@v1
  with:
    plan-json: ${{ steps.plan.outputs.plan-json }}
    policy-ref: '91fc4fcb981a24d8a1e5387c49cabfbe5900a4dd'
    required-namespaces: |
      policies.common
      policies.s3
```

`policy-ref` and `required-namespaces` must be set together. The action fetches only the requested commit, verifies the
checked-out commit, confirms that every required package exists in non-test Rego source, and passes those packages to
Conftest as explicit namespaces. Omitting both inputs preserves the legacy floating-policy behavior for staged consumer
migration. New consumers should use the pinned form.

| Input                 | Description                                                      | Default          |
| --------------------- | ---------------------------------------------------------------- | ---------------- |
| `plan-json`           | Path to the JSON plan file                                       | `tofu/plan.json` |
| `policy-ref`          | Exact lowercase 40-character `opa-policies` commit SHA           | `''`             |
| `required-namespaces` | Newline-delimited Rego packages that must exist and be evaluated | `''`             |
| `client-id`           | GitHub App client ID for cross-repo policy fetching              | `''`             |
| `private-key`         | GitHub App private key for cross-repo policy fetching            | `''`             |
| `owner`               | Owner where the cross-repo access app is installed               | repository owner |
| `app-id`              | Deprecated GitHub App ID for cross-repo policy fetching          | `''`             |

| Output              | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `has_violations`    | Whether policy violations were found (`true`/`false`) |
| `policy_violations` | Violation details (empty if none)                     |

### tofu/build-plan-details

Builds OpenTofu plan output as a collapsible markdown fragment.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/tofu/build-plan-details@v1
  id: plan-details
  with:
    plan: ${{ steps.plan.outputs.plan }}
```

| Input  | Description               |
| ------ | ------------------------- |
| `plan` | OpenTofu plan output text |

| Output         | Description                                         |
| -------------- | --------------------------------------------------- |
| `plan-details` | Collapsible details block with terraform code fence |

### github/comment

Create or update a PR comment identified by a marker string.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/github/comment@v1
  with:
    comment-body: ${{ steps.comment.outputs.comment-body }}
    comment-identifier: '### OpenTofu Plan Results'
```

| Input                | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `comment-body`       | Full markdown body of the comment                                 |
| `comment-identifier` | String used to match an existing comment (matched via startsWith) |

### aws/cleanup-s3

Delete S3 buckets matching a prefix. Handles versioned buckets.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/aws/cleanup-s3@v1
  with:
    prefix: my-test-bucket-
```

| Input    | Description                 | Default     |
| -------- | --------------------------- | ----------- |
| `prefix` | Bucket name prefix to match | (required)  |
| `region` | AWS region                  | `us-east-1` |

### aws/cleanup-dynamodb

Delete DynamoDB tables matching a prefix.

```yaml
- uses: pretty-good-software-org/ci-shared/actions/aws/cleanup-dynamodb@v1
  with:
    prefix: my-test-table-
```

| Input    | Description                | Default     |
| -------- | -------------------------- | ----------- |
| `prefix` | Table name prefix to match | (required)  |
| `region` | AWS region                 | `us-east-1` |

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

# Add an unreleased changelog entry
mise run changie

# Run full CI validation locally (build + lint + test)
mise run ci:validate
```

### Markdown policy

Markdown formatting follows the organization policy from `template-base` PR #23 and `org-evaluation-harnesses`.
`.rumdl.toml`, Mise tasks, and Lefthook are the authoritative implementation. The native rumdl v0.2.38 binary is
pinned by Mise, and `mise.lock` records checksums and GitHub artifact provenance for Linux ARM64, Linux x64 with glibc
and musl, macOS ARM64, and macOS x64. Windows is unsupported. `mise run format:markdown` formats tracked Markdown;
`mise run check:markdown-format` verifies it. The formatter check is included in `mise run lint:default` and the
pre-commit hook. YAML frontmatter must retain its semantics.

### YAML lint policy

`.lint/configs/yamllint.yml` is vendored byte-for-byte from the private `pretty-good-software-org/org-lint-config`
release `v1.0.0`; `.yamllint.yml` sources it via `extends: .lint/configs/yamllint.yml` and keeps its own local
`ignore:` list. `.org-lint-config.json` is the pin — the release archive's SHA-256 and each vendored file's SHA-256 —
checked in at the repository root.

ci-shared is public, so its own pull-request CI must not depend on the `CI_PRIVATE_CONTENT` GitHub App secret that
`setup/org-lint-config` (above) uses for other, private consumer repos. `mise run org-lint-config:verify`
(`org-lint-config-sync/verify.ts`) recomputes the vendored file's SHA-256 and compares it to the pin — no network, no
secrets — and is wired into `mise run lint`. `mise run org-lint-config:regenerate`
(`org-lint-config-sync/regenerate.ts`) is maintainer-only: it requires `gh auth login` against the private
`org-lint-config` repo, re-verifies both the archive and per-file hashes before writing, and is never run in CI.

Never hand-edit `.lint/configs/yamllint.yml` — it must only ever be regeneration's byte-exact output.
`.org-lint-config.json` is different: it is the trust anchor, so deliberately updating it to adopt a new release is
expected, but only by hand, only by a maintainer, and only through the verified procedure in AGENTS.md ("Updating
the Pinned org-lint-config Release"). Regeneration re-verifies and republishes an already-vetted pin; it must never
be the thing that originates one.

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
