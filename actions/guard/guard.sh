#!/usr/bin/env bash
#MISE description="Validate this repository against the base-template standard"
set -euo pipefail

# Repo-local overrides. Supported variables:
#   GUARD_LINT_RUNNER='[self-hosted, Linux, ARM64]'
#   GUARD_SKIP_CHECKS='a,e,h'
if [[ -f .guardrc ]]; then
  # shellcheck source=/dev/null
  source .guardrc
fi

GUARD_LINT_RUNNER="${GUARD_LINT_RUNNER:-[self-hosted, Linux, ARM64]}"
GUARD_SKIP_CHECKS="${GUARD_SKIP_CHECKS:-}"
failures=0

is_skipped() {
  local check="$1"
  [[ ",${GUARD_SKIP_CHECKS//[[:space:]]/}," == *",${check},"* ]]
}

pass() { printf 'PASS %s - %s\n' "$1" "$2"; }
fail() { printf 'FAIL %s - %s\n' "$1" "$2"; failures=$((failures + 1)); }
skip() { printf 'PASS %s - skipped via GUARD_SKIP_CHECKS\n' "$1"; }

run_check() {
  local letter="$1"
  local description="$2"
  local fn="$3"
  if is_skipped "$letter"; then
    skip "$letter"
  elif "$fn"; then
    pass "$letter" "$description"
  else
    fail "$letter" "$description"
  fi
}

check_a() {
  local required=(
    .actionlint.yml
    .coderabbit.yaml
    .github/workflows/lint.yml
    .markdownlint-cli2.jsonc
    .mise.toml
    .mise.ci.toml
    .mise.development.toml
    .miserc.toml
    .yamllint.yml
    AGENTS.md
    CLAUDE.md
    README.md
    cog.toml
    lefthook.yml
    lefthook/commit-msg.yml
    lefthook/files.yml
    lefthook/lint.yml
    lefthook/secrets.yml
    mise-tasks/lint/actionlint
    mise-tasks/lint/default
    mise-tasks/lint/markdownlint
    mise-tasks/lint/yamllint
    mise-tasks/setup/default
    mise.lock
    mise.development.lock
  )
  local missing=()
  local path
  for path in "${required[@]}"; do
    [[ -e "$path" ]] || missing+=("$path")
  done
  ((${#missing[@]} == 0)) || { printf '  missing: %s\n' "${missing[*]}" >&2; return 1; }
}

check_b() {
  local forbidden=(
    .markdownlint.yml
    lefthook/general.yml
    lefthook/pre-commit.yml
    mise-tasks/lint/actions
    mise-tasks/lint/markdown
    mise-tasks/lint/yaml
    mise-tasks/lint/_default
  )
  local present=()
  local path
  for path in "${forbidden[@]}"; do
    [[ ! -e "$path" ]] || present+=("$path")
  done
  ((${#present[@]} == 0)) || { printf '  forbidden present: %s\n' "${present[*]}" >&2; return 1; }
}

check_c() {
  local modules=(lefthook/files.yml lefthook/lint.yml lefthook/commit-msg.yml lefthook/secrets.yml)
  grep -Eq '^extends:[[:space:]]*$' lefthook.yml || return 1
  grep -Eq '^[[:space:]]+-[[:space:]]+lefthook/' lefthook.yml || return 1
  ! grep -Eq '^[[:space:]]+-[[:space:]]+.*[*?\[]' lefthook.yml || return 1
  local module
  for module in "${modules[@]}"; do
    grep -Eq "^[[:space:]]+-[[:space:]]+${module//./\.}[[:space:]]*$" lefthook.yml || return 1
  done
}

check_d() {
  local task=mise-tasks/lint/default
  [[ -f "$task" ]] || return 1
  grep -Eq '^#MISE depends=.*lint:actionlint' "$task" || return 1
  grep -Eq '^#MISE depends=.*lint:yamllint' "$task" || return 1
  grep -Eq '^#MISE depends=.*lint:markdownlint' "$task" || return 1
}

check_e() {
  local file bad=0
  for file in .mise.toml .mise.ci.toml .mise.development.toml; do
    [[ -f "$file" ]] || return 1
    awk -v file="$file" '
      /^[[:space:]]*\[/ { in_tools = ($0 ~ /^[[:space:]]*\[tools\][[:space:]]*$/); next }
      in_tools && /^[[:space:]]*[A-Za-z0-9_.-]+[[:space:]]*=/ {
        value = $0
        sub(/^[^=]*=[[:space:]]*/, "", value)
        sub(/[[:space:]]*(#.*)?$/, "", value)
        gsub(/^"|"$/, "", value)
        if (value !~ /^[0-9]+\.[0-9]+\.[0-9]+$/) {
          printf "  %s: non exact-semver tool pin: %s\n", file, $0 > "/dev/stderr"
          bad = 1
        }
      }
      END { exit bad }
    ' "$file" || bad=1
  done
  ((bad == 0))
}

check_f() {
  local old_org="prettygood"
  old_org+="-software"
  ! grep -RIn --exclude-dir=.git "$old_org" . >/tmp/template-guard-old-org-matches.$$ 2>/dev/null || {
    cat /tmp/template-guard-old-org-matches.$$ >&2
    rm -f /tmp/template-guard-old-org-matches.$$
    return 1
  }
  rm -f /tmp/template-guard-old-org-matches.$$
}

check_g() {
  local workflow=.github/workflows/lint.yml
  [[ -f "$workflow" ]] || return 1
  grep -Fq 'mise run lint:default' "$workflow" || return 1
  grep -Eq '^concurrency:[[:space:]]*$' "$workflow" || return 1
  grep -Fq 'pretty-good-software-org/ci-shared/actions/setup/mise@v1' "$workflow" || return 1
}

check_h() {
  local workflow=.github/workflows/lint.yml
  [[ -f "$workflow" ]] || return 1
  local expected actual
  expected="${GUARD_LINT_RUNNER//[[:space:]]/}"
  actual="$(awk -F: '/^[[:space:]]*runs-on:/ {print $2; exit}' "$workflow")"
  actual="${actual//[[:space:]]/}"
  [[ "$actual" == "$expected" ]]
}

standards_file() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f lint-standards.toml ]]; then
    printf '%s\n' "lint-standards.toml"
  else
    printf '%s\n' "${script_dir}/lint-standards.toml"
  fi
}

toml_value() {
  local file="$1" section="$2" key="$3"
  awk -v section="$section" -v key="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    /^\[[^]]+\][[:space:]]*$/ {
      in_section = ($0 == "[" section "]")
      next
    }
    in_section && $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      sub(/^[^=]*=[[:space:]]*/, "")
      sub(/[[:space:]]*(#.*)?$/, "")
      gsub(/^\"|\"$/, "")
      print
      exit
    }
  ' "$file"
}

yaml_number() {
  local file="$1" key="$2"
  grep -E "^[[:space:]]*${key}:[[:space:]]*[0-9]+([[:space:]]*#.*)?$" "$file" \
    | head -n 1 \
    | sed -E 's/^[^:]+:[[:space:]]*([0-9]+).*/\1/'
}

yaml_number_in_section() {
  local file="$1" section="$2" key="$3"
  awk -v section="$section" -v key="$key" '
    function indent(line) { match(line, /[^ ]/); return RSTART - 1 }
    $0 ~ "^[[:space:]]*" section ":[[:space:]]*($|#)" { in_section = 1; base = indent($0); next }
    in_section && /^[^[:space:]]/ { in_section = 0 }
    in_section && indent($0) <= base && $0 !~ /^[[:space:]]*($|#)/ { in_section = 0 }
    in_section && $0 ~ "^[[:space:]]*" key ":[[:space:]]*[0-9]+" {
      sub(/^[^:]*:[[:space:]]*/, "")
      sub(/[[:space:]]*(#.*)?$/, "")
      print
      exit
    }
  ' "$file"
}

# Go file length is enforced via revive's file-length-limit rule:
#   revive:
#     rules:
#       - name: file-length-limit
#         arguments:
#           - max: <n>
revive_file_length_max() {
  local file="$1"
  awk '
    /- name:[[:space:]]*file-length-limit/ { in_rule = 1; next }
    in_rule && /- name:/ { in_rule = 0 }
    in_rule && /max:[[:space:]]*[0-9]+/ {
      sub(/.*max:[[:space:]]*/, "")
      sub(/[[:space:]]*(#.*)?$/, "")
      print
      exit
    }
  ' "$file"
}

require_number() {
  local label="$1" actual="$2" expected="$3"
  if [[ -z "$actual" || "$actual" != "$expected" ]]; then
    printf '  %s: expected %s, got %s\n' "$label" "$expected" "${actual:-missing}" >&2
    return 1
  fi
}

require_le_number() {
  local label="$1" actual="$2" expected="$3"
  if [[ -z "$actual" || ! "$actual" =~ ^[0-9]+$ || "$actual" -gt "$expected" ]]; then
    printf '  %s: expected <= %s, got %s\n' "$label" "$expected" "${actual:-missing}" >&2
    return 1
  fi
}

check_i_go() {
  [[ -f go.mod ]] || return 0
  [[ -f .golangci.yml ]] || { printf '  go.mod present but .golangci.yml missing\n' >&2; return 1; }
  local std="$1" bad=0
  require_number 'go cyclop' "$(yaml_number_in_section .golangci.yml cyclop max-complexity)" "$(toml_value "$std" go cyclop)" || bad=1
  require_number 'go gocognit' "$(yaml_number_in_section .golangci.yml gocognit min-complexity)" "$(toml_value "$std" go gocognit)" || bad=1
  require_number 'go funlen lines' "$(yaml_number_in_section .golangci.yml funlen lines)" "$(toml_value "$std" go funlen_lines)" || bad=1
  require_number 'go funlen statements' "$(yaml_number_in_section .golangci.yml funlen statements)" "$(toml_value "$std" go funlen_stmts)" || bad=1
  require_number 'go nestif' "$(yaml_number_in_section .golangci.yml nestif min-complexity)" "$(toml_value "$std" go nestif)" || bad=1
  require_number 'go lll' "$(yaml_number_in_section .golangci.yml lll line-length)" "$(toml_value "$std" go lll)" || bad=1
  require_number 'go file length' "$(revive_file_length_max .golangci.yml)" "$(toml_value "$std" go file_length)" || bad=1
  ((bad == 0))
}

check_i_rust() {
  [[ -f Cargo.toml ]] || return 0
  local std="$1" bad=0
  local pedantic too_many_lines nursery
  pedantic="$(toml_value "$std" rust pedantic)"
  too_many_lines="$(toml_value "$std" rust too_many_lines)"
  nursery="$(toml_value "$std" rust nursery)"
  grep -Eq 'clippy::pedantic[[:space:]]*=[[:space:]]*"deny"|pedantic[[:space:]]*=[[:space:]]*"deny"' Cargo.toml || {
    printf '  Cargo.toml: clippy pedantic must be %s\n' "$pedantic" >&2; bad=1;
  }
  [[ -f clippy.toml ]] || { printf '  Cargo.toml present but clippy.toml missing\n' >&2; bad=1; }
  [[ ! -f clippy.toml ]] || require_number 'rust too-many-lines' \
    "$(grep -E '^[[:space:]]*too-many-lines-threshold[[:space:]]*=' clippy.toml | head -n 1 | sed -E 's/.*=[[:space:]]*([0-9]+).*/\1/')" \
    "$too_many_lines" || bad=1
  ! grep -RIn 'clippy::nursery\|nursery' Cargo.toml .cargo 2>/dev/null || {
    printf '  rust nursery lint group is %s by default\n' "$nursery" >&2; bad=1;
  }
  ((bad == 0))
}

check_i_python() {
  [[ -f pyproject.toml ]] || return 0
  local std="$1" bad=0
  grep -Eq 'select[[:space:]]*=.*"C90[0-9]*"' pyproject.toml || { printf '  pyproject.toml: Ruff select must include C90\n' >&2; bad=1; }
  grep -Eq 'select[[:space:]]*=.*"PLR[0-9]*"' pyproject.toml || { printf '  pyproject.toml: Ruff select must include PLR\n' >&2; bad=1; }
  require_number 'python C901' "$(grep -E '^[[:space:]]*max-complexity[[:space:]]*=' pyproject.toml | head -n 1 | sed -E 's/.*=[[:space:]]*([0-9]+).*/\1/')" "$(toml_value "$std" python c901)" || bad=1
  require_number 'python line length' "$(grep -E '^[[:space:]]*line-length[[:space:]]*=' pyproject.toml | head -n 1 | sed -E 's/.*=[[:space:]]*([0-9]+).*/\1/')" "$(toml_value "$std" python line)" || bad=1
  # PLR code -> Ruff [tool.ruff.lint.pylint] key
  declare -A plr_key=(
    [PLR0911]=max-returns
    [PLR0912]=max-branches
    [PLR0913]=max-args
    [PLR0915]=max-statements
  )
  local code key want
  for code in PLR0912 PLR0913 PLR0915 PLR0911; do
    key="${plr_key[$code]}"
    want="$(toml_value "$std" python "$(printf '%s' "$code" | tr '[:upper:]' '[:lower:]')")"
    grep -Eq "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*${want}\b" pyproject.toml || {
      printf '  pyproject.toml: missing Ruff %s (%s = %s) threshold\n' "$code" "$key" "$want" >&2; bad=1;
    }
  done
  ((bad == 0))
}

check_i_yaml() {
  [[ -f .yamllint.yml ]] || return 0
  local std="$1" actual
  actual="$(yaml_number .yamllint.yml max)"
  require_le_number 'yaml line length' "$actual" "$(toml_value "$std" yaml line_length)"
}

check_i_lint_honesty() {
  ! grep -RIn --include='*' -- '||[[:space:]]*true' mise-tasks/lint 2>/tmp/template-guard-lint-true.$$ || {
    cat /tmp/template-guard-lint-true.$$ >&2
    rm -f /tmp/template-guard-lint-true.$$
    return 1
  }
  rm -f /tmp/template-guard-lint-true.$$
}

check_i() {
  local std
  std="$(standards_file)"
  [[ -f "$std" ]] || { printf '  lint standards file missing: %s\n' "$std" >&2; return 1; }
  check_i_go "$std" && check_i_rust "$std" && check_i_python "$std" && check_i_yaml "$std" && check_i_lint_honesty
}

check_j() {
  # Changie changelog config correctness. Presence is provided by class
  # templates; this enforces conformance only when .changie.yaml exists, so
  # non-released repos (e.g. infrastructure roots) that omit changie still pass.
  [[ -f .changie.yaml ]] || return 0
  local version
  version="$(toml_value "$(standards_file)" changie tool_version)"
  grep -Eq "\"github:miniscruff/changie\"[[:space:]]*=[[:space:]]*\"${version//./\\.}\"" .mise.toml || {
    printf '  changie not pinned to %s in .mise.toml [tools]\n' "$version" >&2
    return 1
  }
  [[ -f .changes/header.tpl.md ]] || { printf '  .changes/header.tpl.md missing\n' >&2; return 1; }
  [[ -d .changes/unreleased ]] || { printf '  .changes/unreleased/ missing\n' >&2; return 1; }
  if grep -Eq '^    -[[:space:]]' .changie.yaml; then
    printf '  .changie.yaml uses 4-space list indent; org standard is 2-space\n' >&2
    return 1
  fi
}

run_check a 'required base-template files exist' check_a
run_check b 'forbidden legacy files are absent' check_b
run_check c 'lefthook.yml extends explicit base modules without globs' check_c
run_check d 'lint default depends on actionlint, yamllint, markdownlint' check_d
run_check e 'mise tool versions use exact Style-A semver pins' check_e
run_check f 'old org name is absent' check_f
run_check g 'lint workflow uses shared mise setup, concurrency, and lint task' check_g
run_check h "lint workflow runner policy is ${GUARD_LINT_RUNNER}" check_h
run_check i 'repo lint config matches lint-standards.toml and lint tasks do not swallow failures' check_i
run_check j 'changie config, when present, is pinned to the standard and 2-space' check_j

if ((failures > 0)); then
  printf 'template guard failed with %d failure(s)\n' "$failures" >&2
  exit 1
fi

printf 'template guard passed\n'
