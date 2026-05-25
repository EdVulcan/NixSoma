#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6430}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6431}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6432}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6433}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6434}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6435}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6436}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6437}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6500}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-storage-root-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-storage-root-plan-check.json}"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before body evidence ledger storage root plan."

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-storage-root-plan")"

node - <<'EOF' "$PLAN_FILE" "$plan"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-storage-root-plan",
  "Body evidence ledger storage root plan checkpoint",
  "candidate roots",
  "Creates no directory",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing storage root plan token: ${token}`);
  }
}

if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-storage-root-plan-v0") {
  throw new Error(`storage root plan should expose expected registry: ${JSON.stringify(plan)}`);
}
if (plan.mode !== "plan_only_body_evidence_ledger_storage_root") {
  throw new Error(`storage root plan should remain plan-only: ${JSON.stringify(plan.mode)}`);
}
if (plan.summary?.planReady !== true
  || plan.summary?.routeReviewReady !== true
  || plan.summary?.selectedRootId !== "repo-artifacts-body-evidence-ledger"
  || plan.summary?.directoryCreated !== false
  || plan.summary?.durableStorageWritten !== false
  || plan.summary?.hiddenMutation !== false) {
  throw new Error(`storage root plan summary should be ready without writes: ${JSON.stringify(plan.summary)}`);
}
if (plan.governance?.canCreateDirectory !== false
  || plan.governance?.canWriteLedger !== false
  || plan.governance?.durableStorageWritten !== false
  || plan.governance?.createsTask !== false
  || plan.governance?.executesCommand !== false
  || plan.governance?.hostMutation !== false
  || plan.governance?.schedulesFollowUp !== false) {
  throw new Error(`storage root plan must not create or write: ${JSON.stringify(plan.governance)}`);
}
if (plan.plan?.selectedRoot?.displayPath !== ".artifacts/openclaw-body-evidence-ledger"
  || plan.plan?.selectedRoot?.createsDirectoryNow !== false
  || plan.plan?.selectedRoot?.writesRecordsNow !== false) {
  throw new Error(`storage root plan should select artifact path without creating it: ${JSON.stringify(plan.plan?.selectedRoot)}`);
}
if (!Array.isArray(plan.plan?.candidateRoots) || plan.plan.candidateRoots.length < 2) {
  throw new Error(`storage root plan should expose candidate roots: ${JSON.stringify(plan.plan?.candidateRoots)}`);
}
if (plan.plan?.pathPolicy?.mustStayInsideWorkspace !== true
  || plan.plan?.pathPolicy?.mustBeObserverVisible !== true
  || plan.plan?.pathPolicy?.mustNotCreateDirectoryInThisSlice !== true) {
  throw new Error(`storage root path policy should preserve no-write boundary: ${JSON.stringify(plan.plan?.pathPolicy)}`);
}
if (plan.next?.recommendedSlice !== "openclaw-body-evidence-ledger-storage-root-route-review") {
  throw new Error(`storage root plan should route to materialization review: ${JSON.stringify(plan.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerStorageRootPlan: {
    status: "passed",
    registry: plan.registry,
    selectedRoot: plan.summary.selectedDisplayPath,
    directoryCreated: plan.summary.directoryCreated,
    durableStorageWritten: plan.summary.durableStorageWritten,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF
