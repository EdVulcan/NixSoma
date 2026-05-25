#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6540}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6541}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6542}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6543}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6544}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6545}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6546}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6547}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6610}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence ledger before follow-up record task shell."

route_review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-followup-record-route-review")"
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"

node - <<'EOF' "$PLAN_FILE" "$route_review" "$created_record_task" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const routeReview = JSON.parse(process.argv[3]);
const created = JSON.parse(process.argv[4]);
const ledgerLines = fs.readFileSync(process.argv[5], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-task",
  "Body evidence ledger follow-up record task checkpoint",
  "pending medium-risk approval",
  "Does not append a ledger record",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up record task token: ${token}`);
  }
}

if (!routeReview.ok || routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-task") {
  throw new Error(`follow-up route review should select task shell: ${JSON.stringify(routeReview)}`);
}
if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`follow-up record task should expose expected registry: ${JSON.stringify(created)}`);
}
if (created.mode !== "approval-gated-ledger-followup-record-task-shell") {
  throw new Error(`follow-up record task should remain task-shell only: ${JSON.stringify(created.mode)}`);
}
if (created.sourceRegistry !== "openclaw-body-evidence-ledger-followup-record-route-review-v0") {
  throw new Error(`follow-up record task should cite route review source: ${JSON.stringify(created.sourceRegistry)}`);
}
if (created.task?.type !== "body_evidence_ledger_followup_record_task"
  || created.task?.status !== "queued"
  || created.task?.bodyEvidenceLedgerFollowupRecord?.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0"
  || created.task?.bodyEvidenceLedgerFollowupRecord?.plannedRecordType !== "body_evidence_timeline_followup"
  || created.task?.bodyEvidenceLedgerFollowupRecord?.plannedSequence !== 2
  || created.task?.bodyEvidenceLedgerFollowupRecord?.existingRecordCount !== 1
  || created.task?.bodyEvidenceLedgerFollowupRecord?.recordAppended !== false
  || created.task?.bodyEvidenceLedgerFollowupRecord?.durableStorageWritten !== false
  || created.task?.bodyEvidenceLedgerFollowupRecord?.appendExecutionEnabled !== false) {
  throw new Error(`follow-up record task should queue append shell without writing: ${JSON.stringify(created.task)}`);
}
if (!created.approval?.id || created.approval?.status !== "pending") {
  throw new Error(`follow-up record task should create pending approval: ${JSON.stringify(created.approval)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.canAppendLedgerRecord !== false
  || created.governance?.canWriteLedger !== false
  || created.governance?.executed !== false
  || created.governance?.hostMutation !== false
  || created.governance?.recordAppended !== false
  || created.governance?.durableStorageWritten !== false
  || created.governance?.schedulesFollowUp !== false
  || created.governance?.backgroundWriter !== false) {
  throw new Error(`follow-up record task governance should create only task and approval: ${JSON.stringify(created.governance)}`);
}
const phases = created.task?.plan?.steps?.map((step) => step.phase) ?? [];
for (const phase of ["review_followup_record_route", "waiting_for_approval", "deferred_followup_record_append_shell"]) {
  if (!phases.includes(phase)) {
    throw new Error(`follow-up record task plan missing phase ${phase}: ${JSON.stringify(phases)}`);
  }
}
if (ledgerLines.length !== 1) {
  throw new Error(`follow-up record task must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordTask: {
    status: "passed",
    registry: created.registry,
    taskId: created.task.id,
    approvalId: created.approval.id,
    recordType: created.task.bodyEvidenceLedgerFollowupRecord.plannedRecordType,
    plannedSequence: created.task.bodyEvidenceLedgerFollowupRecord.plannedSequence,
    recordAppended: created.task.bodyEvidenceLedgerFollowupRecord.recordAppended,
  },
}, null, 2));
EOF
