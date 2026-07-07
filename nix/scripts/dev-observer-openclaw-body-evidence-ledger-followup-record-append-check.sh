#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6622}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6623}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6624}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6625}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6626}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6627}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6628}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6629}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6658}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-followup-record-append-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-followup-record-append-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
LEDGER_FILE="$LEDGER_DIR/body-evidence-ledger.jsonl"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare observer follow-up append."
HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve observer-visible follow-up body evidence ledger append."}' >/dev/null
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$record_task_id")"
ledger_read="$(curl --silent --fail --get "$SYSTEM_URL/system/files/read-text" --data-urlencode "path=$LEDGER_FILE")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$step" "$task_state" "$ledger_read"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const step = JSON.parse(process.argv[4]);
const taskState = JSON.parse(process.argv[5]);
const ledgerRead = JSON.parse(process.argv[6]);

for (const token of [
  "Body Evidence Ledger Follow-up Record Task",
  "body-evidence-ledger-followup-record-task-panel",
  "Body Evidence Ledger Follow-up Append Route Review",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "Body Evidence Ledger Follow-up Record:",
  "Body Evidence Ledger Follow-up File:",
  "bodyEvidenceLedgerFollowupRecord",
  "openclaw-body-evidence-ledger-followup-record-append-v0",
  "/body/evidence-ledger/followup-record-append",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
const finalTask = step.task ?? taskState.task;
const followupRecord = finalTask?.bodyEvidenceLedgerFollowupRecord ?? {};
if (finalTask?.status !== "completed"
  || followupRecord.recordAppended !== true
  || followupRecord.durableStorageWritten !== true
  || followupRecord.appendResult?.registry !== "openclaw-body-evidence-ledger-followup-record-append-v0") {
  throw new Error(`Observer-visible task should expose follow-up append evidence: ${JSON.stringify(finalTask)}`);
}
if (step.execution?.attempts?.[0]?.taskId !== finalTask.id
  || step.execution?.attempts?.[0]?.status !== "completed") {
  throw new Error(`Observer-visible operator step should expose completed follow-up append attempt: ${JSON.stringify(step.execution)}`);
}
const lines = String(ledgerRead.content ?? "").trim().split("\n").filter(Boolean);
if (lines.length !== 2) {
  throw new Error(`Observer ledger read should show two appended lines: ${JSON.stringify(ledgerRead)}`);
}
const firstRecord = JSON.parse(lines[0]);
const secondRecord = JSON.parse(lines[1]);
if (secondRecord.id !== followupRecord.recordId
  || secondRecord.contentHash !== followupRecord.contentHash
  || secondRecord.previousRecord?.id !== firstRecord.id
  || secondRecord.governance?.taskId !== finalTask.id
  || secondRecord.governance?.scheduler !== false
  || secondRecord.governance?.backgroundWriter !== false) {
  throw new Error(`Observer follow-up ledger record should match task evidence: ${JSON.stringify(secondRecord)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFollowupRecordAppend: {
    status: "passed",
    taskId: finalTask.id,
    recordId: secondRecord.id,
    previousRecordId: secondRecord.previousRecord.id,
    contentHash: secondRecord.contentHash,
    ledgerLines: lines.length,
  },
}, null, 2));
EOF
