#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6260}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6261}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6262}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6263}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6264}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6265}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6266}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6267}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6330}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-candidate-task-route-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-candidate-task-route-check.json}"

SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
route_gate="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-task-route")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$route_gate"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const routeGate = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Repair Candidate Route",
  "systemd-repair-candidate-task-route-panel",
  "systemd-repair-candidate-route-status",
  "systemd-repair-candidate-route-target",
  "systemd-repair-candidate-route-creates-task",
  "systemd-repair-candidate-route-mutation",
  "systemd-repair-candidate-route-json",
];
const requiredClient = [
  "/system/systemd/repair-candidate-task-route",
  "refreshSystemdRepairCandidateRoute",
  "systemdRepairCandidateRouteStatus",
  "systemdRepairCandidateRouteTarget",
  "systemdRepairCandidateRouteCreatesTask",
  "systemdRepairCandidateRouteMutation",
  "systemdRepairCandidateRouteJson",
  "requiredBeforeTaskCreation",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!routeGate.ok || routeGate.registry !== "openclaw-systemd-repair-candidate-task-route-v0") {
  throw new Error(`Observer source should expose candidate task route registry: ${JSON.stringify(routeGate)}`);
}
if (!routeGate.routeDecision?.targetUnit || !routeGate.routeDecision?.status) {
  throw new Error(`Observer-facing route gate should expose decision: ${JSON.stringify(routeGate.routeDecision)}`);
}
if (routeGate.governance?.createsTask !== false
  || routeGate.governance?.hostMutation !== false
  || routeGate.governance?.executesCommand !== false
  || routeGate.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing route gate must not execute or recover: ${JSON.stringify(routeGate.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairCandidateTaskRoute: {
    status: "passed",
    panel: "Repair Candidate Route",
    registry: routeGate.registry,
    targetUnit: routeGate.routeDecision?.targetUnit,
    routeStatus: routeGate.routeDecision?.status,
    createsTask: routeGate.governance?.createsTask,
  },
}, null, 2));
EOF
