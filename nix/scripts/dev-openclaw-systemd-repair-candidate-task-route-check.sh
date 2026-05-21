#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6250}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6251}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6252}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6253}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6254}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6255}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6256}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6257}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6320}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-task-route-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-task-route-check.json}"

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
route_gate="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-task-route")"

node - <<'EOF' "$PLAN_FILE" "$route_gate"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const routeGate = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-systemd-repair-candidate-task-route",
  "Systemd repair candidate task route checkpoint",
  "existing-route availability",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing repair candidate task route token: ${token}`);
  }
}

if (!routeGate.ok || routeGate.registry !== "openclaw-systemd-repair-candidate-task-route-v0") {
  throw new Error(`candidate task route should expose expected registry: ${JSON.stringify(routeGate)}`);
}
if (routeGate.mode !== "read_only_task_route_gate") {
  throw new Error(`candidate task route should be read-only route gate: ${JSON.stringify(routeGate.mode)}`);
}
if (routeGate.governance?.hostMutation !== false
  || routeGate.governance?.canMutate !== false
  || routeGate.governance?.canRestart !== false
  || routeGate.governance?.createsTask !== false
  || routeGate.governance?.createsApproval !== false
  || routeGate.governance?.executesCommand !== false
  || routeGate.governance?.triggersRecovery !== false) {
  throw new Error(`candidate task route governance must remain non-executing: ${JSON.stringify(routeGate.governance)}`);
}
if (routeGate.source?.candidatePlanRegistry !== "openclaw-systemd-repair-candidate-plan-v0") {
  throw new Error(`candidate task route should cite candidate plan: ${JSON.stringify(routeGate.source)}`);
}
if (!routeGate.routeDecision?.targetUnit || !routeGate.routeDecision?.status) {
  throw new Error(`candidate task route should expose route decision: ${JSON.stringify(routeGate.routeDecision)}`);
}
if (!routeGate.requiredBeforeTaskCreation?.includes("explicit approval gate")) {
  throw new Error(`candidate task route should list approval prerequisite: ${JSON.stringify(routeGate.requiredBeforeTaskCreation)}`);
}
if (routeGate.allowedNextActions?.some((action) => action.id === "create-candidate-task-shell" && action.allowedNow !== false) !== false) {
  throw new Error(`candidate task shell creation should remain future milestone only: ${JSON.stringify(routeGate.allowedNextActions)}`);
}
if (routeGate.next?.recommendedSlice !== "openclaw-systemd-repair-candidate-task-shell") {
  throw new Error(`candidate task route should point to task shell next: ${JSON.stringify(routeGate.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidateTaskRoute: {
    status: "passed",
    registry: routeGate.registry,
    targetUnit: routeGate.routeDecision.targetUnit,
    routeStatus: routeGate.routeDecision.status,
    createsTask: routeGate.governance.createsTask,
    hostMutation: routeGate.governance.hostMutation,
  },
}, null, 2));
EOF
