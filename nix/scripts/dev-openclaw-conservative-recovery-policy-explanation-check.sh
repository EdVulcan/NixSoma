#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6070}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6071}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6072}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6073}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6074}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6075}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6076}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6077}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6140}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-conservative-recovery-policy-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-conservative-recovery-policy-check.json}"

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
curl --silent --fail "$SYSTEM_URL/system/route/next-action" >/dev/null
policy="$(curl --silent --fail "$SYSTEM_URL/system/route/recovery-policy")"

node - <<'EOF' "$PLAN_FILE" "$policy"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const policy = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-conservative-recovery-policy-explanation",
  "Conservative recovery policy explanation checkpoint",
  "observe-first recovery rules",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing recovery policy token: ${token}`);
  }
}

if (!policy.ok || policy.registry !== "openclaw-conservative-recovery-policy-v0") {
  throw new Error(`recovery policy should expose expected registry: ${JSON.stringify(policy)}`);
}
if (policy.mode !== "read_only_policy_explanation") {
  throw new Error(`recovery policy should be explanation-only: ${JSON.stringify(policy.mode)}`);
}
if (policy.governance?.hostMutation !== false
  || policy.governance?.canMutate !== false
  || policy.governance?.createsTask !== false
  || policy.governance?.createsApproval !== false
  || policy.governance?.executesCommand !== false
  || policy.governance?.triggersRecovery !== false
  || policy.governance?.schedulesFollowUp !== false) {
  throw new Error(`recovery policy governance must remain non-executing: ${JSON.stringify(policy.governance)}`);
}
if (policy.source?.routeAwareRegistry !== "openclaw-route-aware-next-action-v0"
  || policy.source?.dependencyMapRegistry !== "openclaw-systemd-dependency-map-v0"
  || policy.source?.healthTrendRegistry !== "openclaw-health-trend-summary-v0") {
  throw new Error(`recovery policy should cite route, dependency, and trend evidence: ${JSON.stringify(policy.source)}`);
}
if (!policy.policy?.minimumEvidence?.includes("explicit operator approval before real restart")) {
  throw new Error(`recovery policy should explain operator approval minimum evidence: ${JSON.stringify(policy.policy)}`);
}
const repairGate = policy.rules?.find((rule) => rule.id === "repair-proposal-gate");
if (!repairGate || repairGate.mutation !== true || repairGate.createsTask !== false) {
  throw new Error(`repair gate should be explained without task creation: ${JSON.stringify(policy.rules)}`);
}
if (!policy.hardBoundaries?.noAutomaticRepair
  || !policy.hardBoundaries?.noTaskCreation
  || !policy.hardBoundaries?.noCommandExecution
  || !policy.hardBoundaries?.noHostMutation
  || !policy.hardBoundaries?.noScheduler) {
  throw new Error(`recovery policy should carry hard no-execution boundaries: ${JSON.stringify(policy.hardBoundaries)}`);
}
if (policy.next?.recommendedSlice !== "openclaw-body-governance-readiness") {
  throw new Error(`recovery policy should point to body governance readiness next: ${JSON.stringify(policy.next)}`);
}

console.log(JSON.stringify({
  openclawConservativeRecoveryPolicyExplanation: {
    status: "passed",
    registry: policy.registry,
    posture: policy.policy.currentPosture,
    createsTask: policy.governance.createsTask,
    hostMutation: policy.governance.hostMutation,
    next: policy.next.recommendedSlice,
  },
}, null, 2));
EOF
