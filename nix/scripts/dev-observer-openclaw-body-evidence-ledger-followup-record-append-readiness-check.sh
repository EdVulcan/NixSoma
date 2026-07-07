#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6638}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6639}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6640}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6641}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6642}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6643}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6644}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6645}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6662}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-followup-record-append-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-followup-record-append-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare observer follow-up append readiness."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve observer-visible follow-up append before readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-append-readiness")"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created_record_task" "$readiness"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const readiness = JSON.parse(process.argv[5]);

const requiredHtml = [
  "Body Evidence Ledger Follow-up Append Readiness",
  "body-evidence-ledger-followup-record-append-readiness-panel",
  "body-evidence-ledger-followup-record-append-readiness-ready",
  "body-evidence-ledger-followup-record-append-readiness-checks",
  "body-evidence-ledger-followup-record-append-readiness-records",
  "body-evidence-ledger-followup-record-append-readiness-mutation",
  "body-evidence-ledger-followup-record-append-readiness-json",
];
const requiredClient = [
  "/phase-2/body-evidence-ledger-followup-record-append-readiness",
  "refreshBodyEvidenceLedgerFollowupRecordAppendReadiness",
  "bodyEvidenceLedgerFollowupRecordAppendReadinessReady",
  "bodyEvidenceLedgerFollowupRecordAppendReadinessChecks",
  "bodyEvidenceLedgerFollowupRecordAppendReadinessRecords",
  "bodyEvidenceLedgerFollowupRecordAppendReadinessMutation",
  "openclaw-body-evidence-ledger-followup-record-append-readiness-v0",
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
if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`Observer setup should create follow-up task shell: ${JSON.stringify(created)}`);
}
if (!readiness.ok
  || readiness.registry !== "openclaw-body-evidence-ledger-followup-record-append-readiness-v0"
  || readiness.summary?.ready !== true
  || readiness.summary?.taskId !== created.task?.id
  || readiness.summary?.approvalStatus !== "approved"
  || readiness.summary?.existingRecordCount !== 2
  || readiness.summary?.recordAppended !== true
  || readiness.governance?.createsTask !== false
  || readiness.governance?.hostMutation !== false) {
  throw new Error(`Observer follow-up append readiness should expose read-only two-record state: ${JSON.stringify(readiness)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFollowupRecordAppendReadiness: {
    status: "passed",
    panel: "Body Evidence Ledger Follow-up Append Readiness",
    registry: readiness.registry,
    taskId: readiness.summary?.taskId,
    recordId: readiness.summary?.recordId,
    ledgerRecords: readiness.summary?.existingRecordCount,
  },
}, null, 2));
EOF
