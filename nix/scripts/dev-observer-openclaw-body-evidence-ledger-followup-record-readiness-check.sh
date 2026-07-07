#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6574}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6575}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6576}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6577}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6578}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6579}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6580}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6581}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6644}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-followup-record-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-followup-record-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence ledger before observer follow-up record readiness."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-readiness")"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created_record_task" "$readiness" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const readiness = JSON.parse(process.argv[5]);
const ledgerLines = fs.readFileSync(process.argv[6], "utf8").trim().split("\n").filter(Boolean);

const requiredHtml = [
  "Body Evidence Ledger Follow-up Record Readiness",
  "body-evidence-ledger-followup-record-readiness-panel",
  "body-evidence-ledger-followup-record-readiness-ready",
  "body-evidence-ledger-followup-record-readiness-checks",
  "body-evidence-ledger-followup-record-readiness-records",
  "body-evidence-ledger-followup-record-readiness-mutation",
  "body-evidence-ledger-followup-record-readiness-json",
];
const requiredClient = [
  "/phase-2/body-evidence-ledger-followup-record-readiness",
  "refreshBodyEvidenceLedgerFollowupRecordReadiness",
  "bodyEvidenceLedgerFollowupRecordReadinessReady",
  "bodyEvidenceLedgerFollowupRecordReadinessChecks",
  "bodyEvidenceLedgerFollowupRecordReadinessRecords",
  "bodyEvidenceLedgerFollowupRecordReadinessMutation",
  "bodyEvidenceLedgerFollowupRecordReadinessJson",
  "openclaw-body-evidence-ledger-followup-record-readiness-v0",
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
  || readiness.registry !== "openclaw-body-evidence-ledger-followup-record-readiness-v0"
  || readiness.summary?.ready !== true
  || readiness.summary?.taskId !== created.task?.id
  || readiness.summary?.approvalStatus !== "pending"
  || readiness.summary?.existingRecordCount !== 1
  || readiness.summary?.recordAppended !== false) {
  throw new Error(`Observer follow-up readiness should prove shell-only state: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.canAppendLedgerRecord !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.schedulesFollowUp !== false
  || readiness.governance?.backgroundWriter !== false) {
  throw new Error(`Observer follow-up readiness should remain non-mutating: ${JSON.stringify(readiness.governance)}`);
}
if (ledgerLines.length !== 1 || readiness.evidence?.noSecondRecord !== true) {
  throw new Error(`Observer follow-up readiness must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFollowupRecordReadiness: {
    status: "passed",
    panel: "Body Evidence Ledger Follow-up Record Readiness",
    registry: readiness.registry,
    taskId: readiness.summary?.taskId,
    approvalStatus: readiness.summary?.approvalStatus,
    existingRecordCount: readiness.summary?.existingRecordCount,
  },
}, null, 2));
EOF
