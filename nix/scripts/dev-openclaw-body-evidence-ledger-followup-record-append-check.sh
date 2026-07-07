#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6614}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6615}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6616}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6617}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6618}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6619}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6620}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6621}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6656}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-append-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-append-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
LEDGER_FILE="$LEDGER_DIR/body-evidence-ledger.jsonl"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare bootstrap ledger record before follow-up append."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
armed_append="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}")"
approved_record="$(post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded body evidence ledger follow-up append."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$record_task_id")"
ledger_read="$(curl --silent --fail --get "$SYSTEM_URL/system/files/read-text" --data-urlencode "path=$LEDGER_FILE")"

node - <<'EOF' "$PLAN_FILE" "$created_record_task" "$armed_append" "$approved_record" "$step" "$task_state" "$ledger_read"
const crypto = require("node:crypto");
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const armed = JSON.parse(process.argv[4]);
const approved = JSON.parse(process.argv[5]);
const step = JSON.parse(process.argv[6]);
const taskState = JSON.parse(process.argv[7]);
const ledgerRead = JSON.parse(process.argv[8]);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-append",
  "Body evidence ledger follow-up record append checkpoint",
  "Appends exactly one `body_evidence_timeline_followup` JSONL record",
  "Does not create another task",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up append token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`follow-up record task should be created first: ${JSON.stringify(created)}`);
}
if (!armed.ok
  || armed.registry !== "openclaw-body-evidence-ledger-followup-record-append-v0"
  || armed.task?.id !== created.task?.id
  || armed.governance?.appendExecutionEnabled !== true
  || armed.governance?.createsTask !== false
  || armed.governance?.createsApproval !== false
  || armed.governance?.recordAppended !== false) {
  throw new Error(`follow-up append should arm existing task without writing: ${JSON.stringify(armed)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`follow-up record approval should be approved: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run approved follow-up append: ${JSON.stringify(step)}`);
}
const finalTask = step.task ?? taskState.task;
if (finalTask?.id !== created.task?.id || finalTask?.status !== "completed" || finalTask?.outcome?.kind !== "completed") {
  throw new Error(`follow-up record task should complete after append: ${JSON.stringify(finalTask)}`);
}
const followupRecord = finalTask.bodyEvidenceLedgerFollowupRecord ?? {};
if (followupRecord.plannedRecordType !== "body_evidence_timeline_followup"
  || followupRecord.plannedSequence !== 2
  || followupRecord.recordAppended !== true
  || followupRecord.durableStorageWritten !== true
  || followupRecord.appendResult?.registry !== "openclaw-body-evidence-ledger-followup-record-append-v0"
  || followupRecord.ledgerFileDisplayPath !== ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl") {
  throw new Error(`follow-up task should expose append evidence: ${JSON.stringify(followupRecord)}`);
}
const details = finalTask.outcome?.details ?? {};
if (details.recordAppended !== true
  || details.durableStorageWritten !== true
  || details.scheduler !== false
  || details.backgroundWriter !== false
  || details.bulkImport !== false) {
  throw new Error(`follow-up append outcome should preserve no-background boundary: ${JSON.stringify(details)}`);
}
const lines = String(ledgerRead.content ?? "").trim().split("\n").filter(Boolean);
if (lines.length !== 2) {
  throw new Error(`ledger should contain exactly two JSONL records: ${JSON.stringify(ledgerRead)}`);
}
const firstRecord = JSON.parse(lines[0]);
const secondRecord = JSON.parse(lines[1]);
if (secondRecord.id !== followupRecord.recordId
  || secondRecord.evidenceType !== "body_evidence_timeline_followup"
  || secondRecord.sequence !== 2
  || secondRecord.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0"
  || secondRecord.sourceEndpoint !== "/system/route/body-evidence-timeline-readiness"
  || secondRecord.previousRecord?.id !== firstRecord.id
  || secondRecord.previousRecord?.contentHash !== firstRecord.contentHash
  || secondRecord.governance?.taskId !== finalTask.id
  || secondRecord.governance?.approvalId !== approved.approval.id
  || secondRecord.governance?.appendOnly !== true
  || secondRecord.governance?.scheduler !== false
  || secondRecord.governance?.backgroundWriter !== false
  || secondRecord.governance?.bulkImport !== false) {
  throw new Error(`ledger follow-up record should carry append governance evidence: ${JSON.stringify(secondRecord)}`);
}
const { contentHash, ...hashBase } = secondRecord;
const expectedHash = crypto.createHash("sha256").update(JSON.stringify(hashBase)).digest("hex");
if (contentHash !== expectedHash || followupRecord.contentHash !== expectedHash) {
  throw new Error(`follow-up ledger record hash mismatch: ${JSON.stringify({ contentHash, expectedHash, taskHash: followupRecord.contentHash })}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordAppend: {
    status: "passed",
    registry: followupRecord.appendResult.registry,
    taskId: finalTask.id,
    recordId: secondRecord.id,
    previousRecordId: secondRecord.previousRecord.id,
    contentHash,
    ledgerLines: lines.length,
  },
}, null, 2));
EOF
