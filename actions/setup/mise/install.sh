#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE must identify the checked-out repository}"
canonical_workspace="$(realpath "$GITHUB_WORKSPACE")"
cd "$canonical_workspace"
export MISE_CONFIG_ROOT="$canonical_workspace"

python_version="$(mise config get --file "$canonical_workspace/.mise.toml" --raw tools.python 2>/dev/null || true)"
if [[ -n "$python_version" ]]; then
  mise install --locked --verbose "python@$python_version"
fi

exec mise install --locked --verbose
