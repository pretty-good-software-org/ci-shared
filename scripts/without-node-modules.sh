# Keep the repository-wide `mdformat .` command from traversing locally installed
# package documentation. The dependency tree is restored before the task exits.
if [[ -d node_modules ]]; then
  mdformat_node_modules_backup="$(mktemp -d "${TMPDIR:-/tmp}/ci-shared-node-modules.XXXXXX")"
  mv node_modules "$mdformat_node_modules_backup/node_modules"

  restore_mdformat_node_modules() {
    local status=$?
    if ! mv "$mdformat_node_modules_backup/node_modules" node_modules; then
      printf 'restore node_modules after mdformat: failed to restore dependency tree\n' >&2
      exit 1
    fi
    if ! rmdir "$mdformat_node_modules_backup"; then
      printf 'restore node_modules after mdformat: failed to remove temporary directory %s\n' \
        "$mdformat_node_modules_backup" >&2
      exit 1
    fi
    exit "$status"
  }

  trap restore_mdformat_node_modules EXIT
fi
