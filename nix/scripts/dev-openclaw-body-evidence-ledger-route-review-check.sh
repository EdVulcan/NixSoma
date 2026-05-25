#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6410}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6411}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6412}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6413}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6414}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6415}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6416}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6417}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6480}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

created_next_repair="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true,"execute":true}')"
next_repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_next_repair")"
post_json "$CORE_URL/approvals/$next_repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one next repair execution before body evidence ledger route review."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-route-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-route-review",
  "Body evidence ledger route review checkpoint",
  "operator-visible storage root plan",
  "no durable storage write",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing ledger route review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-body-evidence-ledger-route-review-v0") {
  throw new Error(`ledger route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_body_evidence_ledger_route_review") {
  throw new Error(`ledger route review should remain read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.status !== "selected"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-storage-root-plan") {
  throw new Error(`ledger route review should select storage-root planning: ${JSON.stringify(review.decision)}`);
}
if (!review.decision?.notSelected?.includes("no direct durable ledger append")
  || !review.decision?.notSelected?.includes("no background ledger scheduler")
  || !review.decision?.notSelected?.includes("no denial recovery or duplicate-click hardening")) {
  throw new Error(`ledger route review should reject direct writes and hardening loops: ${JSON.stringify(review.decision?.notSelected)}`);
}
if (review.evidence?.ledgerPlanReady !== true
  || review.evidence?.plannedSchema !== "body-evidence-ledger-record-v0"
  || review.evidence?.durableStorageWritten !== false
  || !Array.isArray(review.evidence?.unmetWriteGateIds)
  || review.evidence.unmetWriteGateIds.length < 4) {
  throw new Error(`ledger route review should cite ready plan and unmet write gates: ${JSON.stringify(review.evidence)}`);
}
if (review.governance?.canWriteLedger !== false
  || review.governance?.durableStorageWritten !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.hostMutation !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`ledger route review must not write or execute: ${JSON.stringify(review.governance)}`);
}
const directAppend = review.candidates?.find((candidate) => candidate.id === "direct-ledger-append");
if (!directAppend || directAppend.recommended !== false || directAppend.durableWrite !== true) {
  throw new Error(`ledger route review should keep direct append deferred: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-storage-root-plan") {
  throw new Error(`ledger route review should route to storage-root planning: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    unmetWriteGates: review.evidence.unmetWriteGateIds.length,
    durableStorageWritten: review.governance.durableStorageWritten,
    next: review.next.recommendedSlice,
  },
}, null, 2));
EOF
