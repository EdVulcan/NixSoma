#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6558}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6559}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6560}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6561}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6562}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6563}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6564}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6565}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6628}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-next-capability-route-review-followup-ledger-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-next-capability-route-review-followup-ledger-plan-check.json}"

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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare body evidence ledger and candidate demo evidence before follow-up route review."

candidate_demo_status="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-demo-status")"
followup_plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-followup-record-plan")"
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review?afterRepairCandidateDemoStatus=true")"

node - <<'EOF' "$PLAN_FILE" "$candidate_demo_status" "$followup_plan" "$review" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const candidateDemoStatus = JSON.parse(process.argv[3]);
const followupPlan = JSON.parse(process.argv[4]);
const review = JSON.parse(process.argv[5]);
const ledgerLines = fs.readFileSync(process.argv[6], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "After `openclaw-systemd-repair-candidate-demo-status` is complete",
  "openclaw-body-evidence-ledger-followup-record-plan",
  "without creating another append",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up route token: ${token}`);
  }
}

if (!candidateDemoStatus.ok
  || candidateDemoStatus.registry !== "openclaw-systemd-repair-candidate-demo-status-v0"
  || candidateDemoStatus.summary?.demoReady !== true) {
  throw new Error(`candidate demo status should be ready before follow-up route review: ${JSON.stringify(candidateDemoStatus)}`);
}
if (!followupPlan.ok
  || followupPlan.registry !== "openclaw-body-evidence-ledger-followup-record-plan-v0"
  || followupPlan.summary?.planReady !== true
  || followupPlan.summary?.plannedSequence !== 2) {
  throw new Error(`follow-up record plan should be ready before route review: ${JSON.stringify(followupPlan.summary)}`);
}
if (!review.ok || review.registry !== "openclaw-phase-2-next-capability-route-review-v0") {
  throw new Error(`next capability route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.decision?.selectedTrack !== "Track C: Body Evidence Memory"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-plan") {
  throw new Error(`follow-up route review should select follow-up ledger record plan: ${JSON.stringify(review.decision)}`);
}
for (const forbidden of [
  "no repair candidate assessment loop",
  "no body evidence timeline loop",
  "no body evidence ledger plan or append loop",
  "no follow-up ledger append without a separate route review",
  "no plugin/runtime adapter work",
  "no automatic repair",
  "no broader host mutation",
]) {
  if (!review.decision?.notSelected?.includes(forbidden)) {
    throw new Error(`follow-up route review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.evidence?.repairCandidateDemoStatusCheckpointComplete !== true
  || review.evidence?.candidateDemoReady !== true
  || review.evidence?.bodyEvidenceTimelineReady !== true
  || review.evidence?.bodyEvidenceLedgerReady !== true
  || review.evidence?.bodyEvidenceLedgerFollowupRecordPlanReady !== true
  || review.evidence?.bodyEvidenceLedgerFollowupRecordPlanRegistry !== "openclaw-body-evidence-ledger-followup-record-plan-v0"
  || review.evidence?.bodyEvidenceLedgerFollowupPlannedSequence !== 2) {
  throw new Error(`follow-up route review should cite candidate, timeline, ledger, and follow-up plan evidence: ${JSON.stringify(review.evidence)}`);
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected
  || selected.track !== "Track C"
  || selected.firstSlice !== "openclaw-body-evidence-ledger-followup-record-plan"
  || selected.mutation !== false) {
  throw new Error(`follow-up route review should recommend non-mutating follow-up plan: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-followup-record-plan"
  || !String(review.next?.boundary ?? "").includes("do not create tasks")) {
  throw new Error(`follow-up route review should point to plan-only boundary: ${JSON.stringify(review.next)}`);
}
if (review.governance?.createsTask !== false
  || review.governance?.mutatesHost !== false
  || review.governance?.executesCommand !== false
  || review.governance?.triggersRecovery !== false
  || review.governance?.schedulesWork !== false) {
  throw new Error(`follow-up route review must remain read-only: ${JSON.stringify(review.governance)}`);
}
if (ledgerLines.length !== 1) {
  throw new Error(`follow-up route review must not append another ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  openclawPhase2NextCapabilityRouteReviewFollowupLedgerPlan: {
    status: "passed",
    registry: review.registry,
    selectedTrack: review.decision.selectedTrack,
    selectedSlice: review.decision.selectedSlice,
    plannedSequence: review.evidence.bodyEvidenceLedgerFollowupPlannedSequence,
    next: review.next.recommendedSlice,
  },
}, null, 2));
EOF
