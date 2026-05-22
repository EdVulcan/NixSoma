#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6510}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6511}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6512}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6513}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6514}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6515}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6516}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6517}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6580}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-first-record-append-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-first-record-append-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
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
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before body evidence ledger first record append."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before first record append."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
approved_record="$(post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded body evidence ledger bootstrap append."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$record_task_id")"
ledger_read="$(curl --silent --fail --get "$SYSTEM_URL/system/files/read-text" --data-urlencode "path=$LEDGER_FILE")"

node - <<'EOF' "$PLAN_FILE" "$created_record_task" "$approved_record" "$step" "$task_state" "$ledger_read"
const crypto = require("node:crypto");
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const approved = JSON.parse(process.argv[4]);
const step = JSON.parse(process.argv[5]);
const taskState = JSON.parse(process.argv[6]);
const ledgerRead = JSON.parse(process.argv[7]);

for (const token of [
  "openclaw-body-evidence-ledger-first-record-append",
  "Body evidence ledger first record append checkpoint",
  "Appends exactly one `body_evidence_ledger_bootstrap` JSONL record",
  "Does not schedule background persistence",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing first record append token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-first-record-task-v0") {
  throw new Error(`first record task should be created first: ${JSON.stringify(created)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`first record task approval should be approved: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run approved first record append: ${JSON.stringify(step)}`);
}
const finalTask = step.task ?? taskState.task;
if (finalTask?.status !== "completed" || finalTask?.outcome?.kind !== "completed") {
  throw new Error(`first record task should complete after append: ${JSON.stringify(finalTask)}`);
}
const firstRecord = finalTask.bodyEvidenceLedgerFirstRecord ?? {};
if (firstRecord.plannedRecordType !== "body_evidence_ledger_bootstrap"
  || firstRecord.recordAppended !== true
  || firstRecord.durableStorageWritten !== true
  || firstRecord.appendResult?.registry !== "openclaw-body-evidence-ledger-first-record-append-v0"
  || firstRecord.ledgerFileDisplayPath !== ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl") {
  throw new Error(`first record task should expose append evidence: ${JSON.stringify(firstRecord)}`);
}
const details = finalTask.outcome?.details ?? {};
if (details.recordAppended !== true
  || details.durableStorageWritten !== true
  || details.scheduler !== false
  || details.backgroundWriter !== false
  || details.bulkImport !== false) {
  throw new Error(`append outcome should preserve no-background boundary: ${JSON.stringify(details)}`);
}
if (step.execution?.attempts?.[0]?.taskId !== finalTask.id
  || step.execution?.attempts?.[0]?.status !== "completed") {
  throw new Error(`operator step should expose completed append attempt summary: ${JSON.stringify(step.execution)}`);
}
const lines = String(ledgerRead.content ?? "").trim().split("\n").filter(Boolean);
if (lines.length !== 1) {
  throw new Error(`ledger should contain exactly one JSONL record: ${JSON.stringify(ledgerRead)}`);
}
const record = JSON.parse(lines[0]);
if (record.id !== firstRecord.recordId
  || record.evidenceType !== "body_evidence_ledger_bootstrap"
  || record.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0"
  || record.sourceEndpoint !== "/system/route/body-evidence-timeline-readiness"
  || record.governance?.taskId !== finalTask.id
  || record.governance?.approvalId !== approved.approval.id
  || record.governance?.appendOnly !== true
  || record.governance?.scheduler !== false
  || record.governance?.backgroundWriter !== false
  || record.governance?.bulkImport !== false) {
  throw new Error(`ledger record should carry bootstrap governance evidence: ${JSON.stringify(record)}`);
}
const { contentHash, ...hashBase } = record;
const expectedHash = crypto.createHash("sha256").update(JSON.stringify(hashBase)).digest("hex");
if (contentHash !== expectedHash || firstRecord.contentHash !== expectedHash) {
  throw new Error(`ledger record hash mismatch: ${JSON.stringify({ contentHash, expectedHash, firstRecordHash: firstRecord.contentHash })}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFirstRecordAppend: {
    status: "passed",
    registry: firstRecord.appendResult.registry,
    taskId: finalTask.id,
    recordId: record.id,
    contentHash,
    ledgerLines: lines.length,
  },
}, null, 2));
EOF
