#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6530}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6531}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6532}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6533}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6534}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6535}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6536}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6537}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6600}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-followup-record-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-followup-record-plan-check.json}"

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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare one bootstrap body evidence ledger record before follow-up record planning."

plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-followup-record-plan")"

node - <<'EOF' "$PLAN_FILE" "$plan" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(process.argv[3]);
const ledgerLines = fs.readFileSync(process.argv[4], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "openclaw-body-evidence-ledger-followup-record-plan",
  "Body evidence ledger follow-up record plan checkpoint",
  "planned follow-up record type",
  "Creates no task, no approval, no command execution",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up record token: ${token}`);
  }
}

if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-followup-record-plan-v0") {
  throw new Error(`follow-up record plan should expose expected registry: ${JSON.stringify(plan)}`);
}
if (plan.mode !== "plan_only_body_evidence_ledger_followup_record") {
  throw new Error(`follow-up record plan should remain plan-only: ${JSON.stringify(plan.mode)}`);
}
if (plan.summary?.planReady !== true
  || plan.summary?.timelineReady !== true
  || plan.summary?.ledgerReady !== true
  || plan.summary?.existingRecordCount !== 1
  || plan.summary?.plannedRecordType !== "body_evidence_timeline_followup"
  || plan.summary?.plannedSequence !== 2
  || plan.summary?.durableStorageWritten !== false
  || plan.summary?.hiddenMutation !== false) {
  throw new Error(`follow-up record plan should be ready without writing: ${JSON.stringify(plan.summary)}`);
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
  throw new Error(`follow-up record plan must stay non-mutating: ${JSON.stringify(plan.governance)}`);
}
if (plan.plan?.plannedRecord?.sourceEndpoint !== "/system/route/body-evidence-timeline-readiness"
  || plan.plan?.plannedRecord?.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0") {
  throw new Error(`follow-up record should cite timeline readiness: ${JSON.stringify(plan.plan?.plannedRecord)}`);
}
if (!plan.plan?.preAppendChecks?.some((check) => check.includes("route review"))
  || !plan.plan?.deferredActions?.some((action) => action.includes("do not append a second ledger record"))) {
  throw new Error(`follow-up plan should expose pre-append checks and deferred actions: ${JSON.stringify(plan.plan)}`);
}
if (plan.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`follow-up record plan should return to route review: ${JSON.stringify(plan.next)}`);
}
if (ledgerLines.length !== 1) {
  throw new Error(`follow-up plan must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFollowupRecordPlan: {
    status: "passed",
    registry: plan.registry,
    existingRecords: plan.summary.existingRecordCount,
    plannedSequence: plan.summary.plannedSequence,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
