#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE must identify the checked-out repository}"
canonical_workspace="$(realpath "$GITHUB_WORKSPACE")"
cd "$canonical_workspace"
export MISE_CONFIG_ROOT="$canonical_workspace"
exec mise install --locked --verbose
