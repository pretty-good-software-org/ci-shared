# Releasing

## How It Works

Consumers reference actions by a floating major tag (e.g., `@v1`). Each release creates an immutable semver tag (`v1.2.3`) and moves the floating major tag (`v1`) forward to point at it.

```text
v1.0.0  v1.1.0  v1.2.0
  │       │       │
  ▼       ▼       ▼
──●───────●───────●──  main
                  ▲
                  │
                  v1 (floating)
```

Consumers pinned to `@v1` automatically get minor and patch updates. They only need to change their ref when a new major version is released.

## Version Numbering

| Change | Bump | Example |
|--------|------|---------|
| New action added | Minor | `v1.1.0` → `v1.2.0` |
| New optional input on existing action | Minor | `v1.2.0` → `v1.3.0` |
| Bug fix | Patch | `v1.2.0` → `v1.2.1` |
| Breaking input/output change | **Major** | `v1.x.x` → `v2.0.0` |
| Removed action | **Major** | `v1.x.x` → `v2.0.0` |
| Required input added to existing action | **Major** | `v1.x.x` → `v2.0.0` |

## When to Release

After a PR is squash-merged to `main` and CI passes. Not every merge needs a release — batch related changes if it makes sense.

## Release Steps

1. Make sure you're on an up-to-date `main`:

   ```bash
   git checkout main && git pull
   ```

2. Check what changed since the last release:

   ```bash
   task changelog
   ```

   Review the generated `CHANGELOG.md` to confirm the changes are correct.

3. Pick the next version number based on the table above.

4. Create the release:

   ```bash
   task release VERSION=1.2.0
   ```

   This will:
   - Generate `CHANGELOG.md` via git-cliff
   - Commit the updated changelog
   - Create an annotated semver tag (`v1.2.0`)
   - Move the floating major tag (`v1`) forward
   - Push tags to origin
   - Create a GitHub Release with notes extracted from the changelog

## Breaking Changes (Major Version Bump)

When bumping to a new major version (e.g., `v1` → `v2`):

1. Release as usual:

   ```bash
   task release VERSION=2.0.0
   ```

2. Do **not** move the old floating tag — consumers on `@v1` keep working with the last `v1.x.x`.

3. Notify consumers to migrate. Document what changed and how to update in the GitHub release notes.

## Verifying a Release

Confirm the floating tag points where you expect:

```bash
git rev-parse v1     # should match the semver tag
git rev-parse v1.x.x # should match v1
```

Consumers can verify with:

```yaml
# Pinned to floating major (recommended)
- uses: prettygood-software/ci-shared/actions/tofu/post-plan-comment@v1

# Pinned to exact version
- uses: prettygood-software/ci-shared/actions/tofu/post-plan-comment@v1.2.0

# Pinned to commit SHA (most secure)
- uses: prettygood-software/ci-shared/actions/tofu/post-plan-comment@abc1234
```
