#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6598}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6599}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6600}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6601}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6602}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6603}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6604}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6605}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6652}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-append-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-append-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare follow-up append route review."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
route_review="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-append-route-review")"

node - <<'EOF' "$PLAN_FILE" "$created_record_task" "$route_review" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const routeReview = JSON.parse(process.argv[4]);
const ledgerLines = fs.readFileSync(process.argv[5], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-append-route-review",
  "Body evidence ledger follow-up append route review checkpoint",
  "openclaw-body-evidence-ledger-followup-record-append",
  "Must not approve the follow-up task",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up append route token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`setup should create follow-up task shell: ${JSON.stringify(created)}`);
}
if (!routeReview.ok || routeReview.registry !== "openclaw-body-evidence-ledger-followup-record-append-route-review-v0") {
  throw new Error(`append route review should expose expected registry: ${JSON.stringify(routeReview)}`);
}
if (routeReview.mode !== "read_only_followup_append_route_review"
  || routeReview.status !== "selected"
  || routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-append"
  || routeReview.next?.recommendedSlice !== "openclaw-body-evidence-ledger-followup-record-append") {
  throw new Error(`append route review should select future approved append only: ${JSON.stringify(routeReview.decision)}`);
}
if (routeReview.summary?.taskId !== created.task?.id
  || routeReview.summary?.approvalStatus !== "pending"
  || routeReview.summary?.plannedSequence !== 2
  || routeReview.summary?.existingRecordCount !== 1
  || routeReview.summary?.recordAppended !== false
  || routeReview.summary?.durableStorageWritten !== false) {
  throw new Error(`append route summary should preserve pending no-append state: ${JSON.stringify(routeReview.summary)}`);
}
if (routeReview.governance?.readOnly !== true
  || routeReview.governance?.createsTask !== false
  || routeReview.governance?.createsApproval !== false
  || routeReview.governance?.approvesTask !== false
  || routeReview.governance?.canAppendLedgerRecord !== false
  || routeReview.governance?.recordAppended !== false
  || routeReview.governance?.durableStorageWritten !== false
  || routeReview.governance?.hostMutation !== false
  || routeReview.governance?.schedulesFollowUp !== false
  || routeReview.governance?.backgroundWriter !== false) {
  throw new Error(`append route review must remain read-only: ${JSON.stringify(routeReview.governance)}`);
}
for (const id of ["followup-readiness-ready", "route-selected", "pending-approval", "no-second-record", "review-only"]) {
  const check = routeReview.checklist?.find((item) => item.id === id);
  if (!check || check.status !== "passed") {
    throw new Error(`append route review missing passed check ${id}: ${JSON.stringify(routeReview.checklist)}`);
  }
}
if (ledgerLines.length !== 1 || routeReview.evidence?.noSecondRecord !== true) {
  throw new Error(`append route review must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordAppendRouteReview: {
    status: "passed",
    registry: routeReview.registry,
    selectedSlice: routeReview.decision.selectedSlice,
    taskId: routeReview.summary.taskId,
    approvalStatus: routeReview.summary.approvalStatus,
    existingRecordCount: routeReview.summary.existingRecordCount,
  },
}, null, 2));
EOF
