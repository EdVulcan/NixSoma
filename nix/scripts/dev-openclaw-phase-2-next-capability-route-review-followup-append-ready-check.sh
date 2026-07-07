#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6646}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6647}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6648}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6649}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6650}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6651}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6652}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6653}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6664}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-next-capability-route-review-followup-append-ready-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-next-capability-route-review-followup-append-ready-check.json}"

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

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare follow-up append readiness before completion route review."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve follow-up append before completion route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-append-readiness")"
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review")"

node - <<'EOF' "$PLAN_FILE" "$readiness" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);
const review = JSON.parse(process.argv[4]);

for (const token of [
  "openclaw-phase-2-completion-readiness",
  "After `openclaw-body-evidence-ledger-followup-record-append-readiness` is complete",
  "Phase 2 completion readiness checkpoint",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing completion route token: ${token}`);
  }
}
if (!readiness.ok || readiness.summary?.ready !== true || readiness.summary?.existingRecordCount !== 2) {
  throw new Error(`setup should expose follow-up append readiness: ${JSON.stringify(readiness.summary)}`);
}
if (!review.ok
  || review.registry !== "openclaw-phase-2-next-capability-route-review-v0"
  || review.decision?.selectedTrack !== "Phase 2 Completion"
  || review.decision?.selectedSlice !== "openclaw-phase-2-completion-readiness"
  || review.next?.recommendedSlice !== "openclaw-phase-2-completion-readiness") {
  throw new Error(`route review should select Phase 2 completion readiness: ${JSON.stringify(review.decision)}`);
}
if (review.evidence?.bodyEvidenceLedgerFollowupAppendReadinessReady !== true
  || review.evidence?.bodyEvidenceLedgerFollowupAppendRecordCount !== 2
  || !review.evidence?.bodyEvidenceLedgerFollowupAppendRecordId) {
  throw new Error(`route review should cite follow-up append readiness: ${JSON.stringify(review.evidence)}`);
}
if (review.governance?.createsTask !== false
  || review.governance?.mutatesHost !== false
  || review.governance?.executesCommand !== false
  || review.governance?.schedulesWork !== false) {
  throw new Error(`completion route review must remain read-only: ${JSON.stringify(review.governance)}`);
}

console.log(JSON.stringify({
  openclawPhase2NextCapabilityRouteReviewFollowupAppendReady: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    ledgerRecords: review.evidence.bodyEvidenceLedgerFollowupAppendRecordCount,
  },
}, null, 2));
EOF
