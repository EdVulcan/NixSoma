#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6450}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6451}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6452}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6453}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6454}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6455}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6456}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6457}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6520}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-storage-root-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-storage-root-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before body evidence ledger storage root route review."

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-storage-root-route-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-storage-root-route-review",
  "Body evidence ledger storage root route review checkpoint",
  "ledger directory creation task shell",
  "no durable storage write",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing storage root route review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-body-evidence-ledger-storage-root-route-review-v0") {
  throw new Error(`storage root route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_body_evidence_ledger_storage_root_route_review") {
  throw new Error(`storage root route review should remain read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.status !== "selected"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-directory-task") {
  throw new Error(`storage root route review should select directory task shell: ${JSON.stringify(review.decision)}`);
}
if (!review.decision?.notSelected?.includes("no direct ledger record write")
  || !review.decision?.notSelected?.includes("no background ledger scheduler")
  || !review.decision?.notSelected?.includes("no denial recovery or duplicate-click hardening")) {
  throw new Error(`storage root route review should reject direct writes and hardening loops: ${JSON.stringify(review.decision?.notSelected)}`);
}
if (review.evidence?.storageRootPlanReady !== true
  || review.evidence?.selectedRootId !== "repo-artifacts-body-evidence-ledger"
  || review.evidence?.selectedDisplayPath !== ".artifacts/openclaw-body-evidence-ledger"
  || review.evidence?.rootInsideWorkspace !== true
  || review.evidence?.directoryCreated !== false
  || review.evidence?.durableStorageWritten !== false) {
  throw new Error(`storage root route review should cite ready non-created root: ${JSON.stringify(review.evidence)}`);
}
if (review.governance?.canCreateDirectory !== false
  || review.governance?.canWriteLedger !== false
  || review.governance?.durableStorageWritten !== false
  || review.governance?.createsTask !== false
  || review.governance?.executesCommand !== false
  || review.governance?.hostMutation !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`storage root route review must not create or write: ${JSON.stringify(review.governance)}`);
}
const directoryTask = review.candidates?.find((candidate) => candidate.id === "ledger-directory-creation-task");
if (!directoryTask || directoryTask.recommended !== true || directoryTask.firstSlice !== "openclaw-body-evidence-ledger-directory-task") {
  throw new Error(`storage root route review should recommend directory task shell: ${JSON.stringify(review.candidates)}`);
}
const directWrite = review.candidates?.find((candidate) => candidate.id === "direct-ledger-record-write");
if (!directWrite || directWrite.recommended !== false || directWrite.durableWrite !== true) {
  throw new Error(`storage root route review should keep direct record writes deferred: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-body-evidence-ledger-directory-task") {
  throw new Error(`storage root route review should route to directory task shell: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerStorageRootRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    root: review.evidence.selectedDisplayPath,
    directoryCreated: review.evidence.directoryCreated,
    durableStorageWritten: review.governance.durableStorageWritten,
    next: review.next.recommendedSlice,
  },
}, null, 2));
EOF
