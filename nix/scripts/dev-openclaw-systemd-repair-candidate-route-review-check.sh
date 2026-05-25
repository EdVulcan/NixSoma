#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6310}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6311}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6312}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6313}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6314}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6315}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6316}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6317}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6380}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-route-review-check.json}"

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
review="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-route-review")"

node - <<'EOF' "$PLAN_FILE" "$review"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const review = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-systemd-repair-candidate-route-review",
  "Systemd repair candidate route review checkpoint",
  "openclaw-systemd-repair-candidate-demo-status",
  "candidate-specific approval replay",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing candidate route review token: ${token}`);
  }
}

if (!review.ok || review.registry !== "openclaw-systemd-repair-candidate-route-review-v0") {
  throw new Error(`candidate route review should expose expected registry: ${JSON.stringify(review)}`);
}
if (review.mode !== "read_only_candidate_route_selection") {
  throw new Error(`candidate route review should be read-only: ${JSON.stringify(review.mode)}`);
}
if (review.decision?.selectedSlice !== "openclaw-systemd-repair-candidate-demo-status"
  || review.decision?.status !== "selected") {
  throw new Error(`candidate route review should select read-only demo status: ${JSON.stringify(review.decision)}`);
}
if (!review.decision?.notSelected?.includes("no candidate-specific approval replay")
  || !review.decision?.notSelected?.includes("no broader systemd mutation")) {
  throw new Error(`candidate route review should reject duplicate approval and broader mutation: ${JSON.stringify(review.decision?.notSelected)}`);
}
if (review.governance?.createsTask !== false
  || review.governance?.createsApproval !== false
  || review.governance?.executesCommand !== false
  || review.governance?.hostMutation !== false
  || review.governance?.triggersRecovery !== false
  || review.governance?.schedulesFollowUp !== false) {
  throw new Error(`candidate route review must not execute or schedule work: ${JSON.stringify(review.governance)}`);
}
if (review.evidence?.candidateReady !== true
  || review.evidence?.selectedUnit !== "openclaw-browser-runtime.service") {
  throw new Error(`candidate route review should cite ready browser-runtime candidate evidence: ${JSON.stringify(review.evidence)}`);
}
if (review.next?.recommendedSlice !== "openclaw-systemd-repair-candidate-demo-status") {
  throw new Error(`candidate route review should route to demo status: ${JSON.stringify(review.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidateRouteReview: {
    status: "passed",
    registry: review.registry,
    selectedSlice: review.decision.selectedSlice,
    selectedUnit: review.evidence.selectedUnit,
    candidateChecks: review.evidence.candidateChecks,
    hostMutation: review.governance.hostMutation,
  },
}, null, 2));
EOF
