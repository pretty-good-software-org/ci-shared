#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'APM consumer verification failed: %s\n' "$1" >&2
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
[[ "${PACKAGE:-}" =~ ^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$ ]] || fail "PACKAGE is invalid"
[[ "${TARGET:-}" =~ ^[A-Za-z0-9._-]+$ ]] || fail "TARGET is invalid"
validate_relative_path "${PROJECTION_PATH:-}" "PROJECTION_PATH"
for command in diff find git realpath sort tar tr wc; do
  require_command "$command"
done

verification_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/apm-consumer-verification.XXXXXX")"
cleanup() {
  local status=$?
  if ! rm -rf -- "$verification_root"; then
    printf 'APM consumer verification failed: could not remove %s\n' "$verification_root" >&2
    if ((status == 0)); then status=1; fi
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

readonly candidate="$verification_root/candidate"
readonly consumer="$verification_root/consumer"
readonly marketplace="$verification_root/marketplace"
readonly state_home="$verification_root/home"
readonly gitconfig="$verification_root/gitconfig"
readonly expected_file="$verification_root/expected-entries"
readonly actual_file="$verification_root/actual-entries"
mkdir -p "$candidate" "$consumer" "$marketplace" "$state_home"
touch "$gitconfig" "$expected_file"
git -C "$candidate_checkout" archive --format=tar HEAD | tar -xf - -C "$candidate"

copy_marketplace_directory "$candidate" "${MARKETPLACE_PATH:-}" "$marketplace"

declare -i entry_count=0
while IFS= read -r entry || [[ -n "$entry" ]]; do
  [[ -n "$entry" ]] || continue
  [[ "$entry" =~ ^[A-Za-z0-9._-]+$ && "$entry" != "." && "$entry" != ".." ]] || \
    fail "EXPECTED_ENTRIES contains an invalid entry"
  printf '%s\n' "$entry" >> "$expected_file"
  entry_count=$((entry_count + 1))
done <<< "${EXPECTED_ENTRIES:-}"
((entry_count > 0)) || fail "EXPECTED_ENTRIES must contain at least one entry"
if [[ "$(sort -u "$expected_file" | wc -l | tr -d ' ')" != "$entry_count" ]]; then
  fail "EXPECTED_ENTRIES contains duplicates"
fi
sort -o "$expected_file" "$expected_file"

cat > "$consumer/apm.yml" <<YAML
name: isolated-apm-consumer
version: 1.0.0
description: Isolated APM package consumer verification.
targets: [$TARGET]
YAML

(
  cd "$consumer"
  APM_NO_SCRIPTS=1 HOME="$state_home" GIT_CONFIG_GLOBAL="$gitconfig" GIT_TERMINAL_PROMPT=0 \
    "$apm_bin" marketplace add "$marketplace" --name "$MARKETPLACE_NAME"
  APM_NO_SCRIPTS=1 HOME="$state_home" GIT_CONFIG_GLOBAL="$gitconfig" GIT_TERMINAL_PROMPT=0 \
    "$apm_bin" install "$PACKAGE"
)

readonly projection="$consumer/$PROJECTION_PATH"
[[ -d "$projection" && ! -L "$projection" ]] || fail "projection path must be a regular directory"
readonly consumer_real="$(realpath "$consumer")"
readonly projection_real="$(realpath "$projection")"
[[ "$projection_real" == "$consumer_real"/* ]] || fail "projection path escapes the consumer"
find "$projection" -mindepth 1 -maxdepth 1 -exec basename {} \; | sort > "$actual_file"
if ! diff -u "$expected_file" "$actual_file" >&2; then
  fail "projection entries differ from EXPECTED_ENTRIES"
fi
while IFS= read -r entry; do
  [[ -d "$projection/$entry" && ! -L "$projection/$entry" ]] || \
    fail "projection entry $entry must be a regular directory"
done < "$actual_file"

while IFS= read -r forbidden_path || [[ -n "$forbidden_path" ]]; do
  [[ -n "$forbidden_path" ]] || continue
  validate_relative_path "$forbidden_path" "FORBIDDEN_PATHS entry"
  [[ ! -e "$consumer/$forbidden_path" && ! -L "$consumer/$forbidden_path" ]] || \
    fail "forbidden consumer path exists: $forbidden_path"
done <<< "${FORBIDDEN_PATHS:-}"

printf 'APM consumer %s installed the expected %s projection\n' "$PACKAGE" "$PROJECTION_PATH"
