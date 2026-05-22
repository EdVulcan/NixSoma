#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6574}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6575}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6576}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6577}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6578}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6579}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6580}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6581}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6644}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence ledger before follow-up record readiness."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-readiness")"

node - <<'EOF' "$PLAN_FILE" "$created_record_task" "$readiness" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const readiness = JSON.parse(process.argv[4]);
const ledgerLines = fs.readFileSync(process.argv[5], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-readiness",
  "Body evidence ledger follow-up record readiness checkpoint",
  "Confirms one queued `body_evidence_ledger_followup_record_task`",
  "Must return to whitepaper route review before approving the task",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up readiness token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`follow-up task shell should be created before readiness: ${JSON.stringify(created)}`);
}
if (!readiness.ok || readiness.registry !== "openclaw-body-evidence-ledger-followup-record-readiness-v0") {
  throw new Error(`follow-up readiness should expose expected registry: ${JSON.stringify(readiness)}`);
}
if (readiness.mode !== "read_only_followup_record_task_readiness"
  || readiness.status !== "ready_for_route_review"
  || readiness.summary?.ready !== true) {
  throw new Error(`follow-up readiness should be ready and read-only: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.summary?.taskId !== created.task?.id
  || readiness.summary?.approvalStatus !== "pending"
  || readiness.summary?.plannedRecordType !== "body_evidence_timeline_followup"
  || readiness.summary?.plannedSequence !== 2
  || readiness.summary?.existingRecordCount !== 1
  || readiness.summary?.recordAppended !== false
  || readiness.summary?.durableStorageWritten !== false) {
  throw new Error(`follow-up readiness summary should prove shell-only state: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.canAppendLedgerRecord !== false
  || readiness.governance?.canWriteLedger !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.schedulesFollowUp !== false
  || readiness.governance?.backgroundWriter !== false
  || readiness.governance?.bulkImport !== false) {
  throw new Error(`follow-up readiness governance must remain read-only: ${JSON.stringify(readiness.governance)}`);
}
for (const id of ["followup-task-shell", "pending-approval-boundary", "planned-second-record", "no-second-ledger-record", "no-hidden-writer"]) {
  const check = readiness.checklist?.find((item) => item.id === id);
  if (!check || check.status !== "passed") {
    throw new Error(`follow-up readiness missing passed check ${id}: ${JSON.stringify(readiness.checklist)}`);
  }
}
if (ledgerLines.length !== 1 || readiness.evidence?.ledger?.lineCount !== 1 || readiness.evidence?.noSecondRecord !== true) {
  throw new Error(`follow-up readiness must not append a second ledger record: ${JSON.stringify(readiness.evidence?.ledger)}`);
}
if (readiness.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`follow-up readiness should return to route review: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordReadiness: {
    status: "passed",
    registry: readiness.registry,
    taskId: readiness.summary.taskId,
    approvalStatus: readiness.summary.approvalStatus,
    existingRecordCount: readiness.summary.existingRecordCount,
    next: readiness.next.recommendedSlice,
  },
}, null, 2));
EOF
