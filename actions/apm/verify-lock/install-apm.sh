#!/usr/bin/env bash
set -euo pipefail

# ROAD SIGN (2026-07-24): APM 0.26.0 publishes checksums but no GitHub
# attestations. This trusted verifier pins the Linux ARM64 archive digest.
readonly apm_version="0.26.0"
readonly apm_archive_url="https://github.com/microsoft/apm/releases/download/v${apm_version}/apm-linux-arm64.tar.gz"
readonly apm_archive_sha256="c4d6b5ab6d9bdca3c3c324db7ce8d1c4faf7b317f45a55a50ae2571eaa506d25"

fail() {
  printf 'APM setup failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_command curl
require_command find
require_command sha256sum
require_command tar
[[ "$(uname -s)" == "Linux" ]] || fail "the pinned verifier supports Linux only"
[[ "$(uname -m)" == "aarch64" ]] || fail "the pinned verifier supports arm64 only"
[[ -n "${GITHUB_OUTPUT:-}" ]] || fail "GITHUB_OUTPUT must be set"

apm_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/apm-${apm_version}.XXXXXX")"
cleanup_required=true
cleanup() {
  local status=$?
  if [[ "$cleanup_required" == true ]] && ! rm -rf -- "$apm_root"; then
    printf 'APM setup failed: could not remove %s\n' "$apm_root" >&2
    if ((status == 0)); then status=1; fi
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

archive_path="$apm_root/apm.tar.gz"
curl --fail --location --proto '=https' --tlsv1.2 --output "$archive_path" "$apm_archive_url"
printf '%s  %s\n' "$apm_archive_sha256" "$archive_path" | sha256sum --check --status || \
  fail "APM ${apm_version} archive checksum did not match"
tar -xzf "$archive_path" -C "$apm_root"
rm -f -- "$archive_path"

apm_bin="$(find "$apm_root" -type f -name apm -perm -u+x -print -quit)"
[[ -n "$apm_bin" ]] || fail "APM ${apm_version} archive contains no executable"
printf 'apm-bin=%s\n' "$apm_bin" >>"$GITHUB_OUTPUT"
printf 'apm-root=%s\n' "$apm_root" >>"$GITHUB_OUTPUT"
cleanup_required=false
