#!/usr/bin/env bash

validate_relative_path() {
  local path="$1" label="$2" component
  local -a components
  [[ -n "$path" && "$path" != /* && "$path" != "." && "$path" != *$'\n'* ]] || \
    fail "$label must be a non-empty relative path"
  IFS='/' read -r -a components <<< "$path"
  for component in "${components[@]}"; do
    [[ -n "$component" && "$component" != "." && "$component" != ".." ]] || \
      fail "$label contains an unsafe path component"
  done
}

copy_marketplace_directory() {
  local candidate_root="$1" relative_path="$2" destination_root="$3"
  local candidate_root_real marketplace_source marketplace_source_real
  validate_relative_path "$relative_path" "MARKETPLACE_PATH"
  candidate_root_real="$(realpath "$candidate_root")"
  marketplace_source="$candidate_root/$relative_path"
  [[ -d "$marketplace_source" && ! -L "$marketplace_source" ]] || \
    fail "marketplace path must be a regular directory"
  marketplace_source_real="$(realpath "$marketplace_source")"
  [[ "$marketplace_source_real" == "$candidate_root_real"/* ]] || fail "marketplace path escapes the candidate"
  [[ -z "$(find "$marketplace_source" -type l -print -quit)" ]] || \
    fail "marketplace path contains a symbolic link"
  cp -R "$marketplace_source" "$destination_root/"
}
