#!/usr/bin/env bash

PHASE_3_PREREQS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$PHASE_3_PREREQS_DIR/dev-body-evidence-prereqs.sh"

prepare_phase_3_prereqs() {
  local core_url="$1"
  local reason="${2:-Prepare Phase 2 completion evidence before Phase 3 checks.}"
  local created_repair
  local repair_approval_id
  local created_record_task
  local record_task_id
  local record_approval_id

  created_repair="$(curl --silent --fail -X POST "$core_url/system/systemd/repair-execution-tasks" \
    -H 'content-type: application/json' \
    --data '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
  repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_repair")"
  curl --silent --fail -X POST "$core_url/approvals/$repair_approval_id/approve" \
    -H 'content-type: application/json' \
    --data "{\"approvedBy\":\"milestone-check\",\"reason\":\"$reason\"}" >/dev/null
  curl --silent --fail -X POST "$core_url/operator/step" \
    -H 'content-type: application/json' \
    --data '{}' >/dev/null

  prepare_body_evidence_ledger_demo_status "$core_url" "$reason"

  created_record_task="$(curl --silent --fail -X POST "$core_url/body/evidence-ledger/followup-record-tasks" \
    -H 'content-type: application/json' \
    --data '{"confirm":true}')"
  record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
  record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
  curl --silent --fail -X POST "$core_url/body/evidence-ledger/followup-record-append" \
    -H 'content-type: application/json' \
    --data "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
  curl --silent --fail -X POST "$core_url/approvals/$record_approval_id/approve" \
    -H 'content-type: application/json' \
    --data "{\"approvedBy\":\"milestone-check\",\"reason\":\"$reason\"}" >/dev/null
  curl --silent --fail -X POST "$core_url/operator/step" \
    -H 'content-type: application/json' \
    --data '{}' >/dev/null
}
