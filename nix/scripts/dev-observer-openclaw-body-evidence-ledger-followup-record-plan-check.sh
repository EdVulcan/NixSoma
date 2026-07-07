#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6540}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6541}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6542}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6543}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6544}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6545}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6546}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6547}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6610}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-followup-record-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-followup-record-plan-check.json}"

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

prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare one bootstrap body evidence ledger record before observer follow-up record planning."

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-followup-record-plan")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$plan"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const plan = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger Follow-up Record Plan",
  "body-evidence-ledger-followup-record-plan-panel",
  "body-evidence-ledger-followup-record-plan-ready",
  "body-evidence-ledger-followup-record-plan-type",
  "body-evidence-ledger-followup-record-plan-records",
  "body-evidence-ledger-followup-record-plan-written",
  "body-evidence-ledger-followup-record-plan-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-followup-record-plan",
  "refreshBodyEvidenceLedgerFollowupRecordPlan",
  "bodyEvidenceLedgerFollowupRecordPlanReady",
  "bodyEvidenceLedgerFollowupRecordPlanType",
  "bodyEvidenceLedgerFollowupRecordPlanRecords",
  "bodyEvidenceLedgerFollowupRecordPlanWritten",
  "bodyEvidenceLedgerFollowupRecordPlanJson",
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
if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-followup-record-plan-v0") {
  throw new Error(`Observer source should expose follow-up record plan registry: ${JSON.stringify(plan)}`);
}
if (plan.summary?.planReady !== true
  || plan.summary?.existingRecordCount !== 1
  || plan.summary?.plannedRecordType !== "body_evidence_timeline_followup"
  || plan.summary?.plannedSequence !== 2
  || plan.summary?.durableStorageWritten !== false) {
  throw new Error(`Observer follow-up record plan should be ready without writing: ${JSON.stringify(plan.summary)}`);
}
if (plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
  || plan.governance?.executesCommand !== false
  || plan.governance?.hostMutation !== false
  || plan.governance?.canAppendLedgerRecord !== false
  || plan.governance?.canWriteLedger !== false
  || plan.governance?.schedulesFollowUp !== false
  || plan.governance?.backgroundWriter !== false
  || plan.governance?.bulkImport !== false) {
  throw new Error(`Observer follow-up record plan must stay plan-only: ${JSON.stringify(plan.governance)}`);
}
if (!plan.plan?.deferredActions?.some((action) => action.includes("do not create a follow-up append task"))) {
  throw new Error(`Observer follow-up record plan should show deferred task boundary: ${JSON.stringify(plan.plan)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerFollowupRecordPlan: {
    status: "passed",
    panel: "Body Evidence Ledger Follow-up Record Plan",
    registry: plan.registry,
    existingRecords: plan.summary?.existingRecordCount,
    plannedSequence: plan.summary?.plannedSequence,
  },
}, null, 2));
EOF
