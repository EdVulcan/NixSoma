#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6050}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6051}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6052}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6053}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6054}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6055}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6056}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6057}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6120}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-route-aware-next-action-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-route-aware-next-action-check.json}"

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
curl --silent --fail "$SYSTEM_URL/system/health/trends" >/dev/null
recommendation="$(curl --silent --fail "$SYSTEM_URL/system/route/next-action")"

node - <<'EOF' "$PLAN_FILE" "$recommendation"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const recommendation = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-route-aware-next-action-recommendation",
  "Route-aware next-action recommendation checkpoint",
  "dependency map and health trends",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing route-aware recommendation token: ${token}`);
  }
}

if (!recommendation.ok || recommendation.registry !== "openclaw-route-aware-next-action-v0") {
  throw new Error(`route-aware recommendation should expose expected registry: ${JSON.stringify(recommendation)}`);
}
if (recommendation.mode !== "recommendation_only") {
  throw new Error(`route-aware recommendation should be recommendation-only: ${JSON.stringify(recommendation.mode)}`);
}
if (recommendation.governance?.hostMutation !== false
  || recommendation.governance?.canMutate !== false
  || recommendation.governance?.createsTask !== false
  || recommendation.governance?.createsApproval !== false
  || recommendation.governance?.executesCommand !== false
  || recommendation.governance?.triggersRecovery !== false) {
  throw new Error(`route-aware recommendation governance must remain non-executing: ${JSON.stringify(recommendation.governance)}`);
}
if (recommendation.source?.dependencyMapRegistry !== "openclaw-systemd-dependency-map-v0"
  || recommendation.source?.healthTrendRegistry !== "openclaw-health-trend-summary-v0") {
  throw new Error(`route-aware recommendation should cite dependency and trend evidence: ${JSON.stringify(recommendation.source)}`);
}
if (!["continue-observe-body-governance", "review-degraded-body-services"].includes(recommendation.recommendation?.action)) {
  throw new Error(`route-aware recommendation should choose an allowed action: ${JSON.stringify(recommendation.recommendation)}`);
}
if (recommendation.evidence?.dependency?.nodes < 9 || recommendation.evidence?.health?.samples < 1) {
  throw new Error(`route-aware recommendation should summarize dependency and health evidence: ${JSON.stringify(recommendation.evidence)}`);
}
const repairCandidate = recommendation.candidates?.find((candidate) => candidate.id === "operator-reviewed-repair");
if (!repairCandidate || repairCandidate.allowedNow !== false || repairCandidate.mutation !== true) {
  throw new Error(`operator repair candidate should remain blocked until separate approval route: ${JSON.stringify(recommendation.candidates)}`);
}
if (recommendation.next?.recommendedSlice !== "openclaw-conservative-recovery-policy-explanation") {
  throw new Error(`route-aware recommendation should point to recovery policy explanation next: ${JSON.stringify(recommendation.next)}`);
}

console.log(JSON.stringify({
  openclawRouteAwareNextActionRecommendation: {
    status: "passed",
    registry: recommendation.registry,
    action: recommendation.recommendation.action,
    priority: recommendation.recommendation.priority,
    createsTask: recommendation.governance.createsTask,
    hostMutation: recommendation.governance.hostMutation,
    next: recommendation.next.recommendedSlice,
  },
}, null, 2));
EOF
