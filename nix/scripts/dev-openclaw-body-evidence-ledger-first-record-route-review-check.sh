#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6510}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6511}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6512}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6513}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6514}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6515}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6516}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6517}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6580}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-first-record-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-first-record-route-review-check.json}"

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

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before body evidence ledger first record route review."

created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before first-record route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-first-record-route-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-first-record-route-review",
  "Body evidence ledger first record route review checkpoint",
  "approval-gated first-record append task shell",
  "Creates no task, no approval, no command execution",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing first record route-review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-body-evidence-ledger-first-record-route-review-v0") {
  throw new Error(`first record route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_body_evidence_ledger_first_record_route_review") {
  throw new Error(`first record route review should remain read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-first-record-task"
  || review.decision?.status !== "selected") {
  throw new Error(`first record route review should select first record task shell: ${JSON.stringify(review.decision)}`);
}
for (const token of [
  "no background ledger writer",
  "no bulk evidence import",
  "no denial recovery or duplicate-click hardening",
]) {
  if (!review.decision?.notSelected?.includes(token)) {
    throw new Error(`first record route review should reject ${token}: ${JSON.stringify(review.decision?.notSelected)}`);
  }
}
if (review.evidence?.firstRecordPlanReady !== true
  || review.evidence?.plannedRecordType !== "body_evidence_ledger_bootstrap"
  || review.evidence?.directoryExists !== true
  || review.evidence?.sourceRegistry !== "openclaw-body-evidence-timeline-readiness-v0"
  || review.evidence?.durableStorageWritten !== false) {
  throw new Error(`first record route evidence should be ready without writes: ${JSON.stringify(review.evidence)}`);
}
if (review.governance?.canAppendLedgerRecord !== false
  || review.governance?.canWriteLedger !== false
  || review.governance?.durableStorageWritten !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.hostMutation !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`first record route review must not write or create tasks: ${JSON.stringify(review.governance)}`);
}
const selected = review.candidates?.find((candidate) => candidate.firstSlice === "openclaw-body-evidence-ledger-first-record-task");
if (!selected || selected.recommended !== true || selected.scheduler !== false || selected.durableWrite !== true) {
  throw new Error(`first record route review should recommend explicit append task candidate: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-first-record-task") {
  throw new Error(`first record route review should route to first record task: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerFirstRecordRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    recordType: review.evidence.plannedRecordType,
    directoryExists: review.evidence.directoryExists,
    durableStorageWritten: review.evidence.durableStorageWritten,
  },
}, null, 2));
EOF
