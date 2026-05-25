#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6582}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6583}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6584}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6585}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6586}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6587}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6588}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6589}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6648}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-next-capability-route-review-followup-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-next-capability-route-review-followup-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare follow-up readiness before next capability route review."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-readiness")"
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review")"

node - <<'EOF' "$PLAN_FILE" "$created_record_task" "$readiness" "$review" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const readiness = JSON.parse(process.argv[4]);
const review = JSON.parse(process.argv[5]);
const ledgerLines = fs.readFileSync(process.argv[6], "utf8").trim().split("\n").filter(Boolean);

for (const token of [
  "openclaw-phase-2-next-capability-route-review-followup-readiness",
  "Phase 2 next capability route review after follow-up ledger readiness checkpoint",
  "openclaw-body-evidence-ledger-followup-record-append-route-review",
  "Must not approve the follow-up task",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing follow-up readiness route token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`setup should create follow-up task shell: ${JSON.stringify(created)}`);
}
if (!readiness.ok
  || readiness.registry !== "openclaw-body-evidence-ledger-followup-record-readiness-v0"
  || readiness.summary?.ready !== true
  || readiness.summary?.taskId !== created.task?.id
  || readiness.summary?.approvalStatus !== "pending"
  || readiness.summary?.existingRecordCount !== 1
  || readiness.summary?.recordAppended !== false) {
  throw new Error(`setup should expose follow-up readiness without append: ${JSON.stringify(readiness.summary)}`);
}
if (!review.ok || review.registry !== "openclaw-phase-2-next-capability-route-review-v0") {
  throw new Error(`next capability route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_next_capability_route_selection"
  || review.decision?.selectedTrack !== "Track C: Body Evidence Memory"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-append-route-review"
  || review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-followup-record-append-route-review") {
  throw new Error(`route review should select future follow-up append route review only: ${JSON.stringify(review.decision)}`);
}
if (review.evidence?.bodyEvidenceLedgerFollowupRecordReadinessReady !== true
  || review.evidence?.bodyEvidenceLedgerFollowupRecordReadinessRegistry !== "openclaw-body-evidence-ledger-followup-record-readiness-v0"
  || review.evidence?.bodyEvidenceLedgerFollowupTaskId !== created.task?.id
  || review.evidence?.bodyEvidenceLedgerFollowupApprovalStatus !== "pending"
  || review.evidence?.bodyEvidenceLedgerFollowupExistingRecordCount !== 1
  || review.evidence?.bodyEvidenceLedgerFollowupRecordAppended !== false) {
  throw new Error(`route review should cite follow-up readiness evidence: ${JSON.stringify(review.evidence)}`);
}
if (review.governance?.readOnly !== true
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.mutatesHost !== false
  || review.governance?.triggersRecovery !== false
  || review.governance?.schedulesWork !== false) {
  throw new Error(`route review must remain read-only: ${JSON.stringify(review.governance)}`);
}
if (!review.decision?.notSelected?.some((item) => item.includes("no follow-up ledger approval or append"))) {
  throw new Error(`route review should explicitly avoid approval or append: ${JSON.stringify(review.decision)}`);
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected
  || selected.firstSlice !== "openclaw-body-evidence-ledger-followup-record-append-route-review"
  || selected.mutation !== false) {
  throw new Error(`route review should recommend non-mutating append route review: ${JSON.stringify(review.candidates)}`);
}
if (ledgerLines.length !== 1) {
  throw new Error(`route review must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  openclawPhase2NextCapabilityRouteReviewFollowupReadiness: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    taskId: review.evidence.bodyEvidenceLedgerFollowupTaskId,
    approvalStatus: review.evidence.bodyEvidenceLedgerFollowupApprovalStatus,
    existingRecordCount: review.evidence.bodyEvidenceLedgerFollowupExistingRecordCount,
  },
}, null, 2));
EOF
