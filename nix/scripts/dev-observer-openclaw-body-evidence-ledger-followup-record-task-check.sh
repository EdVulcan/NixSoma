#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6550}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6551}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6552}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6553}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6554}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6555}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6556}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6557}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6620}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-followup-record-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-followup-record-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
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
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence ledger before observer follow-up record task shell."

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
route_review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-followup-record-route-review")"
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$route_review" "$created_record_task" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const routeReview = JSON.parse(process.argv[4]);
const created = JSON.parse(process.argv[5]);
const ledgerLines = fs.readFileSync(process.argv[6], "utf8").trim().split("\n").filter(Boolean);

const requiredHtml = [
  "Body Evidence Ledger Follow-up Record Task",
  "body-evidence-ledger-followup-record-task-panel",
  "body-evidence-ledger-followup-record-task-ready",
  "body-evidence-ledger-followup-record-task-type",
  "body-evidence-ledger-followup-record-task-approval",
  "body-evidence-ledger-followup-record-task-appended",
  "create-body-evidence-ledger-followup-record-task-button",
  "body-evidence-ledger-followup-record-task-json",
];
const requiredClient = [
  "/body/evidence-ledger/followup-record-tasks",
  "refreshBodyEvidenceLedgerFollowupRecordTask",
  "createBodyEvidenceLedgerFollowupRecordTask",
  "bodyEvidenceLedgerFollowupRecordTaskReady",
  "bodyEvidenceLedgerFollowupRecordTaskType",
  "bodyEvidenceLedgerFollowupRecordTaskApproval",
  "bodyEvidenceLedgerFollowupRecordTaskAppended",
  "bodyEvidenceLedgerFollowupRecordTaskJson",
  "openclaw-body-evidence-ledger-followup-record-task-v0",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!routeReview.ok || routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-task") {
  throw new Error(`Observer route review should select follow-up record task: ${JSON.stringify(routeReview)}`);
}
if (!created.ok
  || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0"
  || created.task?.bodyEvidenceLedgerFollowupRecord?.recordAppended !== false
  || created.task?.bodyEvidenceLedgerFollowupRecord?.durableStorageWritten !== false
  || created.task?.bodyEvidenceLedgerFollowupRecord?.plannedRecordType !== "body_evidence_timeline_followup"
  || created.task?.bodyEvidenceLedgerFollowupRecord?.plannedSequence !== 2) {
  throw new Error(`Observer follow-up record task should be queued without append: ${JSON.stringify(created)}`);
}
if (!created.approval?.id || created.approval?.status !== "pending") {
  throw new Error(`Observer follow-up record task should expose pending approval: ${JSON.stringify(created.approval)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.canAppendLedgerRecord !== false
  || created.governance?.canWriteLedger !== false
  || created.governance?.hostMutation !== false
  || created.governance?.recordAppended !== false
  || created.governance?.schedulesFollowUp !== false
  || created.governance?.backgroundWriter !== false) {
  throw new Error(`Observer follow-up record task governance should stay shell-only: ${JSON.stringify(created.governance)}`);
}
if (ledgerLines.length !== 1) {
  throw new Error(`Observer follow-up record task must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFollowupRecordTask: {
    status: "passed",
    panel: "Body Evidence Ledger Follow-up Record Task",
    registry: created.registry,
    taskId: created.task?.id,
    approvalId: created.approval?.id,
    recordAppended: created.task?.bodyEvidenceLedgerFollowupRecord?.recordAppended,
  },
}, null, 2));
EOF
