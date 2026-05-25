#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6110}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6111}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6112}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6113}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6114}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6115}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6116}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6117}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6180}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-route-review-check.json}"

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

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
curl --silent --fail "$SYSTEM_URL/system/route/body-governance-readiness" >/dev/null
review="$(curl --silent --fail "$SYSTEM_URL/system/route/phase-2-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-phase-2-route-review",
  "Phase 2 route review checkpoint",
  "openclaw-phase-2-demo-control-room",
  "Select Track B",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing route review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-phase-2-route-review-v0") {
  throw new Error(`route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_route_selection") {
  throw new Error(`route review should be read-only route selection: ${JSON.stringify(review.mode)}`);
}
if (review.governance?.hostMutation !== false
  || review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.triggersRecovery !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`route review governance must remain non-executing: ${JSON.stringify(review.governance)}`);
}
if (review.source?.bodyGovernanceReadinessRegistry !== "openclaw-body-governance-readiness-v0") {
  throw new Error(`route review should cite body governance readiness: ${JSON.stringify(review.source)}`);
}
if (review.decision?.selectedTrack !== "Track B: Operator/Observer Demo Experience"
  || review.decision?.selectedSlice !== "openclaw-phase-2-demo-control-room") {
  throw new Error(`route review should select Track B demo control room: ${JSON.stringify(review.decision)}`);
}
for (const forbidden of ["persistence hardening", "denial recovery", "duplicate-click", "plugin/runtime adapter", "broader host mutation"]) {
  if (!review.decision?.notSelected?.some((item) => item.includes(forbidden))) {
    throw new Error(`route review should explicitly avoid ${forbidden}: ${JSON.stringify(review.decision)}`);
  }
}
const selected = review.candidates?.find((candidate) => candidate.recommended === true);
if (!selected || selected.track !== "Track B" || selected.firstSlice !== "openclaw-phase-2-demo-control-room" || selected.mutation !== false) {
  throw new Error(`route review should recommend non-mutating Track B candidate: ${JSON.stringify(review.candidates)}`);
}
if (review.next?.recommendedSlice !== "openclaw-phase-2-demo-control-room") {
  throw new Error(`route review should point to demo control room next: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2RouteReview: {
    status: "passed",
    registry: review.registry,
    selectedTrack: review.decision.selectedTrack,
    selectedSlice: review.decision.selectedSlice,
    createsTask: review.governance.createsTask,
    hostMutation: review.governance.hostMutation,
  },
}, null, 2));
EOF
