#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6530}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6531}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6532}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6533}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6534}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6535}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6536}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6537}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6600}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
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

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence ledger before follow-up record route review."

review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-followup-record-route-review")"

node - <<'EOF' "$PLAN_FILE" "$review" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);
const ledgerLines = fs.readFileSync(process.argv[4], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-route-review",
  "Body evidence ledger follow-up record route review checkpoint",
  "future approval-gated follow-up append task shell",
  "Creates no task, no approval, no command execution",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up route-review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-body-evidence-ledger-followup-record-route-review-v0") {
  throw new Error(`follow-up route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_body_evidence_ledger_followup_record_route_review") {
  throw new Error(`follow-up route review should remain read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.selectedTrack !== "Track C: Body Evidence Memory"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-task"
  || review.decision?.status !== "selected") {
  throw new Error(`follow-up route review should select future task shell: ${JSON.stringify(review.decision)}`);
}
for (const token of [
  "no direct follow-up ledger append",
  "no recurring ledger writer",
  "no background persistence",
  "no denial recovery or duplicate-click hardening",
]) {
  if (!review.decision?.notSelected?.includes(token)) {
    throw new Error(`follow-up route review should reject ${token}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.evidence?.followupRecordPlanReady !== true
  || review.evidence?.plannedRecordType !== "body_evidence_timeline_followup"
  || review.evidence?.plannedSequence !== 2
  || review.evidence?.existingRecordCount !== 1
  || review.evidence?.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0"
  || review.evidence?.sourceEndpoint !== "/system/route/body-evidence-timeline-readiness"
  || review.evidence?.durableStorageWritten !== false) {
  throw new Error(`follow-up route evidence should be ready without writes: ${JSON.stringify(review.evidence)}`);
}
if (review.governance?.canAppendLedgerRecord !== false
  || review.governance?.canWriteLedger !== false
  || review.governance?.durableStorageWritten !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.hostMutation !== false
  || review.governance?.schedulesFollowUp !== false
  || review.governance?.backgroundWriter !== false
  || review.governance?.bulkImport !== false) {
  throw new Error(`follow-up route review must not write or create tasks: ${JSON.stringify(review.governance)}`);
}
const selected = review.candidates?.find((candidate) => candidate.firstSlice === "openclaw-body-evidence-ledger-followup-record-task");
if (!selected || selected.recommended !== true || selected.scheduler !== false || selected.durableWrite !== true) {
  throw new Error(`follow-up route review should recommend explicit future task candidate: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-followup-record-task") {
  throw new Error(`follow-up route review should route to future follow-up task: ${JSON.stringify(review.next)}`);
}
if (ledgerLines.length !== 1) {
  throw new Error(`follow-up route review must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    plannedSequence: review.evidence.plannedSequence,
    existingRecords: review.evidence.existingRecordCount,
    durableStorageWritten: review.evidence.durableStorageWritten,
  },
}, null, 2));
EOF
