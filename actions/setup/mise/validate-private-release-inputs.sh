#!/usr/bin/env bash
set -euo pipefail

present=0
if [[ -n "${INPUT_APP_ID:-}" ]]; then
  present=$((present + 1))
fi
if [[ -n "${INPUT_PRIVATE_KEY:-}" ]]; then
  present=$((present + 1))
fi
if [[ -n "${INPUT_PRIVATE_REPOSITORIES:-}" ]]; then
  present=$((present + 1))
fi

if [[ "$present" -ne 0 && "$present" -ne 3 ]]; then
  echo "::error::setup/mise: app-id, private-key, and private-repositories must be supplied together (or all omitted)"
  exit 1
fi
