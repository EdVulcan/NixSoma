#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6630}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6631}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6632}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6633}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6634}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6635}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6636}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6637}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6660}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-append-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-append-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare bootstrap ledger record before follow-up append readiness."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded body evidence ledger follow-up append before readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-append-readiness")"

node - <<'EOF' "$PLAN_FILE" "$created_record_task" "$readiness"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const readiness = JSON.parse(process.argv[4]);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-append-readiness",
  "Body evidence ledger follow-up record append readiness checkpoint",
  "Verifies exactly two JSONL records",
  "Must return to whitepaper route review",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up append readiness token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`setup should create follow-up task shell: ${JSON.stringify(created)}`);
}
if (!readiness.ok
  || readiness.registry !== "openclaw-body-evidence-ledger-followup-record-append-readiness-v0"
  || readiness.status !== "ready_for_route_review"
  || readiness.summary?.ready !== true
  || readiness.summary?.taskId !== created.task?.id
  || readiness.summary?.approvalStatus !== "approved"
  || readiness.summary?.plannedRecordType !== "body_evidence_timeline_followup"
  || readiness.summary?.plannedSequence !== 2
  || readiness.summary?.existingRecordCount !== 2
  || readiness.summary?.recordAppended !== true
  || readiness.summary?.durableStorageWritten !== true) {
  throw new Error(`follow-up append readiness should prove two-record durable state: ${JSON.stringify(readiness.summary)}`);
}
if (!readiness.summary?.recordId
  || !readiness.summary?.previousRecordId
  || !readiness.summary?.previousRecordHash
  || !readiness.summary?.contentHash) {
  throw new Error(`follow-up append readiness should expose record linkage and hashes: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.canAppendLedgerRecord !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.schedulesFollowUp !== false
  || readiness.governance?.backgroundWriter !== false
  || readiness.governance?.triggersRecovery !== false) {
  throw new Error(`follow-up append readiness must remain read-only: ${JSON.stringify(readiness.governance)}`);
}
for (const id of ["followup-task-completed", "two-ledger-records", "followup-record-type", "previous-record-link", "no-hidden-writer"]) {
  const check = readiness.checklist?.find((item) => item.id === id);
  if (!check || check.status !== "passed") {
    throw new Error(`follow-up append readiness missing passed check ${id}: ${JSON.stringify(readiness.checklist)}`);
  }
}
if (readiness.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`follow-up append readiness should return to route review: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordAppendReadiness: {
    status: "passed",
    registry: readiness.registry,
    taskId: readiness.summary.taskId,
    recordId: readiness.summary.recordId,
    previousRecordId: readiness.summary.previousRecordId,
    ledgerRecords: readiness.summary.existingRecordCount,
  },
}, null, 2));
EOF
