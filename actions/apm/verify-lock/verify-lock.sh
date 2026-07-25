#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'APM lock verification failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../path-validation.sh"

readonly candidate_checkout="${1:-}"
readonly apm_bin="${2:-}"
[[ -d "$candidate_checkout" ]] || fail "candidate path must be a directory"
[[ -x "$apm_bin" ]] || fail "APM path must be executable"
[[ -n "${GITHUB_TOKEN:-}" ]] || fail "GITHUB_TOKEN must be set"
[[ "${MARKETPLACE_NAME:-}" =~ ^[A-Za-z0-9._-]+$ ]] || fail "MARKETPLACE_NAME is invalid"
[[ -n "${REPAIR_COMMAND:-}" && "$REPAIR_COMMAND" != *$'\n'* ]] || fail "REPAIR_COMMAND is invalid"
for command in cmp diff find git realpath sort tar; do
  require_command "$command"
done

verification_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/apm-lock-verification.XXXXXX")"
cleanup() {
  local status=$?
  if ! rm -rf -- "$verification_root"; then
    printf 'APM lock verification failed: could not remove %s\n' "$verification_root" >&2
    if ((status == 0)); then status=1; fi
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

readonly candidate="$verification_root/candidate"
readonly marketplace="$verification_root/marketplace"
readonly first_home="$verification_root/first-home"
readonly second_home="$verification_root/second-home"
readonly gitconfig="$verification_root/gitconfig"
mkdir -p "$candidate" "$marketplace" "$first_home" "$second_home"
touch "$gitconfig"
git -C "$candidate_checkout" archive --format=tar HEAD | tar -xf - -C "$candidate"

for required_file in apm.yml apm.lock.yaml; do
  [[ -f "$candidate/$required_file" && ! -L "$candidate/$required_file" ]] || \
    fail "$required_file must be a regular tracked file"
done
copy_marketplace_directory "$candidate" "${MARKETPLACE_PATH:-}" "$marketplace"

# APM 0.26.0 does not filter Python bytecode while copying local packages.
# Clean only the archived candidate copy; never execute candidate maintenance scripts.
find "$candidate/plugins" -type d -name __pycache__ -prune -exec rm -rf -- {} +
find "$candidate/plugins" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete
readonly committed_lock="$verification_root/committed-apm.lock.yaml"
readonly generated_lock="$verification_root/generated-apm.lock.yaml"
cp "$candidate/apm.lock.yaml" "$committed_lock"

run_apm() {
  local state_home="$1"
  shift
  APM_NO_SCRIPTS=1 \
    HOME="$state_home" \
    GIT_CONFIG_GLOBAL="$gitconfig" \
    GIT_TERMINAL_PROMPT=0 \
    "$apm_bin" "$@"
}

cd "$candidate"
rm -rf -- apm_modules .agents
run_apm "$first_home" marketplace add "$marketplace" --name "$MARKETPLACE_NAME"
run_apm "$first_home" install
run_apm "$first_home" install --frozen
run_apm "$first_home" audit --ci
cp apm.lock.yaml "$generated_lock"

rm -rf -- apm_modules .agents
run_apm "$second_home" marketplace add "$marketplace" --name "$MARKETPLACE_NAME"
run_apm "$second_home" install
if ! cmp -s "$generated_lock" apm.lock.yaml; then
  diff -u "$generated_lock" apm.lock.yaml >&2 || true
  fail "two clean APM resolutions produced different lockfiles"
fi

if ! cmp -s "$committed_lock" "$generated_lock"; then
  diff -u "$committed_lock" "$generated_lock" >&2 || true
  fail "apm.lock.yaml is stale; run '$REPAIR_COMMAND' locally and commit the result"
fi
printf 'APM lock matches a clean, audited resolution\n'
