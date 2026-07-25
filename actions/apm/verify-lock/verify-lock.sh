#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'APM lock verification failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

readonly candidate_checkout="${1:-}"
readonly apm_bin="${2:-}"
[[ -d "$candidate_checkout" ]] || fail "candidate path must be a directory"
[[ -x "$apm_bin" ]] || fail "APM path must be executable"
[[ -n "${GITHUB_TOKEN:-}" ]] || fail "GITHUB_TOKEN must be set"
require_command cmp
require_command diff
require_command find
require_command git
require_command tar

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
readonly consumer="$verification_root/consumer"
readonly consumer_home="$verification_root/consumer-home"
readonly gitconfig="$verification_root/gitconfig"
mkdir -p "$candidate" "$marketplace" "$first_home" "$second_home" "$consumer" "$consumer_home"
touch "$gitconfig"
git -C "$candidate_checkout" archive --format=tar HEAD | tar -xf - -C "$candidate"

for required_file in apm.yml apm.lock.yaml .claude-plugin/marketplace.json; do
  [[ -f "$candidate/$required_file" && ! -L "$candidate/$required_file" ]] || \
    fail "$required_file must be a regular tracked file"
done

# APM 0.26.0 does not filter Python bytecode while copying local packages.
# Clean only the archived candidate copy; never execute candidate maintenance scripts.
find "$candidate/plugins" -type d -name __pycache__ -prune -exec rm -rf -- {} +
find "$candidate/plugins" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete
cp -R "$candidate/.claude-plugin" "$marketplace/"
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

verify_doc_update_consumer() {
  local skills_dir="$consumer/.agents/skills"
  local expected_skills actual_skills
  readonly expected_skills=$'doc-agents-md\ndoc-changelog\ndoc-readme\ndoc-update-project'

  cat > "$consumer/apm.yml" <<'YAML'
name: doc-update-consumer
version: 1.0.0
description: Isolated documentation dependency consumer.
targets: [agent-skills]
YAML

  (
    cd "$consumer"
    run_apm "$consumer_home" marketplace add "$marketplace" --name pretty-good-skills
    run_apm "$consumer_home" install doc-update-project@pretty-good-skills
  )

  [[ -d "$skills_dir" && ! -L "$skills_dir" ]] || \
    fail "doc-update-project consumer did not create a regular .agents/skills directory"
  actual_skills="$(find "$skills_dir" -mindepth 1 -maxdepth 1 -exec basename {} \; | sort)"
  [[ "$actual_skills" == "$expected_skills" ]] || \
    fail "doc-update-project consumer installed the wrong skills; expected [$expected_skills], got [$actual_skills]"
  while IFS= read -r skill; do
    [[ -d "$skills_dir/$skill" && ! -L "$skills_dir/$skill" ]] || \
      fail "doc-update-project consumer skill $skill must be a regular directory"
  done <<< "$actual_skills"
  [[ ! -e "$consumer/.pi/skills" && ! -L "$consumer/.pi/skills" ]] || \
    fail "doc-update-project consumer created a duplicate .pi/skills projection"
}

cd "$candidate"
rm -rf -- apm_modules .agents
run_apm "$first_home" marketplace add "$marketplace" --name pretty-good-skills
run_apm "$first_home" install
run_apm "$first_home" install --frozen
run_apm "$first_home" audit --ci
cp apm.lock.yaml "$generated_lock"

rm -rf -- apm_modules .agents
run_apm "$second_home" marketplace add "$marketplace" --name pretty-good-skills
run_apm "$second_home" install
if ! cmp -s "$generated_lock" apm.lock.yaml; then
  diff -u "$generated_lock" apm.lock.yaml >&2 || true
  fail "two clean APM resolutions produced different lockfiles"
fi

if ! cmp -s "$committed_lock" "$generated_lock"; then
  diff -u "$committed_lock" "$generated_lock" >&2 || true
  fail "apm.lock.yaml is stale; run 'mise run lock:refresh' locally and commit the result"
fi

verify_doc_update_consumer
printf 'APM lock matches clean audited resolutions and doc-update-project resolves its specialists\n'
