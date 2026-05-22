#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6520}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6521}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6522}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6523}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6524}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6525}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6526}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6527}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6590}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-first-record-append-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-first-record-append-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
LEDGER_FILE="$LEDGER_DIR/body-evidence-ledger.jsonl"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before observer body evidence ledger first record append."

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before observer first record append."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve observer-visible first body evidence ledger append."}' >/dev/null
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
  "Body Evidence Ledger First Record Task",
  "body-evidence-ledger-first-record-task-panel",
  "create-body-evidence-ledger-first-record-task-button",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "Body Evidence Ledger First Record:",
  "Body Evidence Ledger File:",
  "bodyEvidenceLedgerFirstRecord",
  "openclaw-body-evidence-ledger-first-record-task-v0",
  "/body/evidence-ledger/first-record-tasks",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
const finalTask = step.task ?? taskState.task;
const firstRecord = finalTask?.bodyEvidenceLedgerFirstRecord ?? {};
if (finalTask?.status !== "completed"
  || firstRecord.recordAppended !== true
  || firstRecord.durableStorageWritten !== true
  || firstRecord.appendResult?.registry !== "openclaw-body-evidence-ledger-first-record-append-v0") {
  throw new Error(`Observer-visible task should expose first record append evidence: ${JSON.stringify(finalTask)}`);
}
if (step.execution?.attempts?.[0]?.taskId !== finalTask.id
  || step.execution?.attempts?.[0]?.status !== "completed") {
  throw new Error(`Observer-visible operator step should expose completed append attempt summary: ${JSON.stringify(step.execution)}`);
}
const lines = String(ledgerRead.content ?? "").trim().split("\n").filter(Boolean);
if (lines.length !== 1) {
  throw new Error(`Observer ledger read should show one appended line: ${JSON.stringify(ledgerRead)}`);
}
const record = JSON.parse(lines[0]);
if (record.id !== firstRecord.recordId
  || record.contentHash !== firstRecord.contentHash
  || record.governance?.taskId !== finalTask.id
  || record.governance?.scheduler !== false
  || record.governance?.backgroundWriter !== false) {
  throw new Error(`Observer ledger record should match task evidence: ${JSON.stringify(record)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFirstRecordAppend: {
    status: "passed",
    taskId: finalTask.id,
    recordId: record.id,
    contentHash: record.contentHash,
    ledgerLines: lines.length,
  },
}, null, 2));
EOF
