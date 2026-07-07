#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-demo-status-check.json"
SOURCE_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-demo-status-check.json"
SOURCE_LEDGER_FILE="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger-prereq/body-evidence-ledger.jsonl"

missing_fast_prereq_hooks=()
while IFS= read -r script_path; do
  script_basename="$(basename "$script_path")"
  if [[ "$script_basename" == "dev-body-evidence-prereqs.sh" ]]; then
    continue
  fi
  if ! grep -q 'prepare_body_evidence_ledger_demo_status_prereq_state' "$script_path"; then
    missing_fast_prereq_hooks+=("$script_path")
  fi
done < <(grep -rl 'prepare_body_evidence_ledger_demo_status ' "$SCRIPT_DIR" | sort)

if (( ${#missing_fast_prereq_hooks[@]} > 0 )); then
  printf 'Body evidence demo-status scripts missing fast prereq hook:\n' >&2
  printf '  %s\n' "${missing_fast_prereq_hooks[@]}" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_CORE_STATE" || ! -f "$SOURCE_SYSTEM_HEAL_STATE" || ! -f "$SOURCE_LEDGER_FILE" ]]; then
  bash "$SCRIPT_DIR/dev-openclaw-body-evidence-ledger-demo-status-check.sh" >/dev/null
  mkdir -p "$(dirname "$SOURCE_LEDGER_FILE")"
  cp "$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl" "$SOURCE_LEDGER_FILE"
fi

run_body_evidence_fast_prereq_consumer() {
  local script_name="$1"
  echo "Body evidence fast prerequisite consumer: $script_name"
  OPENCLAW_MILESTONE_PREREQ_MODE=fast \
  OPENCLAW_BODY_EVIDENCE_FAST_PREREQ_REQUIRED=true \
  OPENCLAW_BODY_EVIDENCE_PREREQ_SOURCE_CORE="$SOURCE_CORE_STATE" \
  OPENCLAW_BODY_EVIDENCE_PREREQ_SOURCE_SYSTEM_HEAL="$SOURCE_SYSTEM_HEAL_STATE" \
  OPENCLAW_BODY_EVIDENCE_PREREQ_SOURCE_LEDGER_FILE="$SOURCE_LEDGER_FILE" \
    bash "$SCRIPT_DIR/$script_name"
}

run_body_evidence_fast_prereq_consumer "dev-openclaw-body-evidence-ledger-followup-record-readiness-check.sh"
run_body_evidence_fast_prereq_consumer "dev-observer-openclaw-body-evidence-ledger-followup-record-task-check.sh"
run_body_evidence_fast_prereq_consumer "dev-openclaw-phase-2-completion-readiness-check.sh"
