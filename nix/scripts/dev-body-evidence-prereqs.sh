#!/usr/bin/env bash

prepare_body_evidence_timeline_readiness() {
  local core_url="$1"
  local reason="${2:-Prepare one next repair execution before body evidence ledger checks.}"
  local created_next_repair
  local next_repair_approval_id

  created_next_repair="$(curl --silent --fail -X POST "$core_url/system/systemd/next-repair-tasks" \
    -H 'content-type: application/json' \
    --data '{"confirm":true,"execute":true}')"
  next_repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_next_repair")"
  curl --silent --fail -X POST "$core_url/approvals/$next_repair_approval_id/approve" \
    -H 'content-type: application/json' \
    --data "{\"approvedBy\":\"milestone-check\",\"reason\":\"$reason\"}" >/dev/null
  curl --silent --fail -X POST "$core_url/operator/step" \
    -H 'content-type: application/json' \
    --data '{}' >/dev/null
}

prepare_body_evidence_ledger_demo_status_prereq_state() {
  local script_dir="$1"
  local repo_root="$2"
  local target_core_state="$3"
  local target_system_heal_state="$4"
  local target_ledger_dir="$5"

  BODY_EVIDENCE_LEDGER_DEMO_STATUS_FAST_PREREQ_REUSED=false
  BODY_EVIDENCE_FAST_PREREQ_REUSED=false

  if [[ "${OPENCLAW_MILESTONE_PREREQ_MODE:-full}" != "fast" ]]; then
    return 1
  fi

  if [[ -f "$script_dir/dev-openclaw-body-evidence-fast-prereq-state.sh" ]]; then
    # shellcheck source=/dev/null
    source "$script_dir/dev-openclaw-body-evidence-fast-prereq-state.sh"
  fi

  if declare -F openclaw_body_evidence_prepare_demo_status_prereq_state >/dev/null \
    && openclaw_body_evidence_prepare_demo_status_prereq_state "$script_dir" "$repo_root" "$target_core_state" "$target_system_heal_state" "$target_ledger_dir"; then
    BODY_EVIDENCE_LEDGER_DEMO_STATUS_FAST_PREREQ_REUSED=true
    BODY_EVIDENCE_FAST_PREREQ_REUSED=true
    return 0
  fi

  return 1
}

prepare_body_evidence_ledger_demo_status() {
  local core_url="$1"
  local reason="${2:-Prepare one bootstrap body evidence ledger record before next route checks.}"
  local created_directory
  local directory_approval_id
  local created_record_task
  local record_approval_id

  if [[ "${BODY_EVIDENCE_LEDGER_DEMO_STATUS_FAST_PREREQ_REUSED:-false}" == "true" \
    || "${BODY_EVIDENCE_FAST_PREREQ_REUSED:-false}" == "true" ]]; then
    return 0
  fi

  if [[ "${OPENCLAW_BODY_EVIDENCE_FAST_PREREQ_REQUIRED:-false}" == "true" ]]; then
    echo "Body evidence fast prerequisite state was required but not reused." >&2
    return 1
  fi

  prepare_body_evidence_timeline_readiness "$core_url" "$reason"

  created_directory="$(curl --silent --fail -X POST "$core_url/body/evidence-ledger/directory-tasks" \
    -H 'content-type: application/json' \
    --data '{"confirm":true}')"
  directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
  curl --silent --fail -X POST "$core_url/approvals/$directory_approval_id/approve" \
    -H 'content-type: application/json' \
    --data "{\"approvedBy\":\"milestone-check\",\"reason\":\"$reason\"}" >/dev/null
  curl --silent --fail -X POST "$core_url/operator/step" \
    -H 'content-type: application/json' \
    --data '{}' >/dev/null

  created_record_task="$(curl --silent --fail -X POST "$core_url/body/evidence-ledger/first-record-tasks" \
    -H 'content-type: application/json' \
    --data '{"confirm":true}')"
  record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
  curl --silent --fail -X POST "$core_url/approvals/$record_approval_id/approve" \
    -H 'content-type: application/json' \
    --data "{\"approvedBy\":\"milestone-check\",\"reason\":\"$reason\"}" >/dev/null
  curl --silent --fail -X POST "$core_url/operator/step" \
    -H 'content-type: application/json' \
    --data '{}' >/dev/null
}
