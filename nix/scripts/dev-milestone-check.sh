#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/milestone-check"
REGISTRY_SOURCE_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
REGISTRY_FILE="$REGISTRY_SOURCE_FILE"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-milestone-registry-expansion.sh"
openclaw_milestone_prepare_expanded_registry "$SCRIPT_DIR" "$REGISTRY_SOURCE_FILE" REGISTRY_FILE
trap openclaw_milestone_cleanup_expanded_registry EXIT

mkdir -p "$ARTIFACT_DIR"

checks=()

validate_registry() {
  if [[ "${OPENCLAW_MILESTONE_SKIP_REGISTRY_VALIDATION:-false}" == "true" ]]; then
    return 0
  fi

  OPENCLAW_MILESTONE_CHECKS_FILE="$REGISTRY_FILE" "$SCRIPT_DIR/dev-milestone-registry-check.sh" >/dev/null
}

load_checks() {
  local line=""
  local line_number=0
  local name=""
  local script=""
  local description=""
  local extra=""

  if [[ ! -f "$REGISTRY_FILE" ]]; then
    echo "Milestone registry not found: $REGISTRY_FILE" >&2
    exit 1
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_number=$((line_number + 1))
    line="${line%$'\r'}"
    if [[ -z "${line//[[:space:]]/}" || "$line" == \#* ]]; then
      continue
    fi

    IFS=$'\t' read -r name script description extra <<<"$line"
    if [[ -z "${name:-}" || -z "${script:-}" || -z "${description:-}" || -n "${extra:-}" ]]; then
      echo "Invalid milestone registry row at $REGISTRY_FILE:$line_number" >&2
      exit 1
    fi
    if [[ "$name" == *"|"* || "$script" == *"|"* || "$description" == *"|"* ]]; then
      echo "Invalid milestone registry row contains pipe at $REGISTRY_FILE:$line_number" >&2
      exit 1
    fi
    if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
      echo "Milestone check script missing for '$name': $SCRIPT_DIR/$script" >&2
      exit 1
    fi

    checks+=("$name|$script|$description")
  done <"$REGISTRY_FILE"

  if (( ${#checks[@]} == 0 )); then
    echo "Milestone registry contains no checks: $REGISTRY_FILE" >&2
    exit 1
  fi
}

resolve_selected_filter() {
  local raw_filter="$1"
  if [[ "$raw_filter" != "@changed" ]]; then
    printf '%s' "$raw_filter"
    return 0
  fi

  "$SCRIPT_DIR/dev-milestone-select-changed-checks.sh"
}

validate_registry
load_checks

selected_filter="$(resolve_selected_filter "${OPENCLAW_MILESTONE_CHECKS:-}")"
started_at="$(date -Iseconds)"
passed=0
failed=0
summary_json="$ARTIFACT_DIR/summary.json"

should_run_check() {
  local name="$1"
  if [[ -z "$selected_filter" ]]; then
    return 0
  fi

  local item=""
  IFS="," read -ra selected_items <<<"$selected_filter"
  for item in "${selected_items[@]}"; do
    item="${item#"${item%%[![:space:]]*}"}"
    item="${item%"${item##*[![:space:]]}"}"
    if [[ "$item" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

results_json=""

echo "OpenClaw milestone check started at $started_at"
echo "Logs: $ARTIFACT_DIR"
echo "Registry: $REGISTRY_SOURCE_FILE"
echo "Expanded registry: $REGISTRY_FILE"
if [[ -n "$selected_filter" ]]; then
  echo "Selected checks: $selected_filter"
fi
echo

for entry in "${checks[@]}"; do
  IFS="|" read -r name script description <<<"$entry"
  if ! should_run_check "$name"; then
    continue
  fi

  log_file="$ARTIFACT_DIR/$name.log"
  start_seconds="$SECONDS"
  echo "==> [$name] $description"

  if bash "$SCRIPT_DIR/$script" >"$log_file" 2>&1; then
    duration=$((SECONDS - start_seconds))
    passed=$((passed + 1))
    echo "    PASS (${duration}s)"
    result="{\"name\":$(json_escape "$name"),\"status\":\"passed\",\"durationSeconds\":$duration,\"log\":$(json_escape "$log_file")}"
  else
    status=$?
    duration=$((SECONDS - start_seconds))
    failed=$((failed + 1))
    echo "    FAIL (${duration}s, exit $status)"
    echo "    Last log lines:"
    tail -n 60 "$log_file" | sed 's/^/      /'
    result="{\"name\":$(json_escape "$name"),\"status\":\"failed\",\"durationSeconds\":$duration,\"exitCode\":$status,\"log\":$(json_escape "$log_file")}"
  fi

  if [[ -z "$results_json" ]]; then
    results_json="$result"
  else
    results_json="$results_json,$result"
  fi
  echo
done

finished_at="$(date -Iseconds)"
total=$((passed + failed))
if (( total == 0 )); then
  echo "No milestone checks matched OPENCLAW_MILESTONE_CHECKS='$selected_filter'." >&2
  exit 1
fi

cat >"$summary_json" <<EOF
{
  "startedAt": "$started_at",
  "finishedAt": "$finished_at",
  "registrySourceFile": $(json_escape "$REGISTRY_SOURCE_FILE"),
  "registryFile": $(json_escape "$REGISTRY_FILE"),
  "total": $total,
  "passed": $passed,
  "failed": $failed,
  "results": [$results_json]
}
EOF

cat "$summary_json"
echo

if (( failed > 0 )); then
  echo "Milestone check failed. Summary: $summary_json" >&2
  exit 1
fi

echo "Milestone check passed. Summary: $summary_json"
