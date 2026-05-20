#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6130}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6131}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6132}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6133}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6134}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6135}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6136}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6137}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6200}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-demo-control-room-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-demo-control-room-check.json}"

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

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
curl --silent --fail "$SYSTEM_URL/system/route/phase-2-review" >/dev/null
control_room="$(curl --silent --fail "$CORE_URL/phase-2/demo-control-room")"

node - <<'EOF' "$PLAN_FILE" "$control_room"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const controlRoom = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-phase-2-demo-control-room",
  "Phase 2 demo control room checkpoint",
  "operator walkthrough script",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing demo control room token: ${token}`);
  }
}

if (!controlRoom.ok || controlRoom.registry !== "openclaw-phase-2-demo-control-room-v0") {
  throw new Error(`demo control room should expose expected registry: ${JSON.stringify(controlRoom)}`);
}
if (controlRoom.mode !== "read_only_demo_control_surface") {
  throw new Error(`demo control room should be read-only: ${JSON.stringify(controlRoom.mode)}`);
}
if (controlRoom.governance?.readOnly !== true
  || controlRoom.governance?.createsTask !== false
  || controlRoom.governance?.createsApproval !== false
  || controlRoom.governance?.executesCommand !== false
  || controlRoom.governance?.mutatesHost !== false
  || controlRoom.governance?.triggersRecovery !== false
  || controlRoom.governance?.schedulesWork !== false) {
  throw new Error(`demo control room governance must remain non-executing: ${JSON.stringify(controlRoom.governance)}`);
}
if (controlRoom.summary?.ready !== true
  || controlRoom.summary?.selectedSlice !== "openclaw-phase-2-demo-control-room"
  || controlRoom.summary?.bodyGovernanceReady !== true
  || controlRoom.summary?.avoidsSafetyBoundaryLoop !== true) {
  throw new Error(`demo control room should be ready from route and governance evidence: ${JSON.stringify(controlRoom.summary)}`);
}
for (const panel of ["service-health", "mvp-route", "phase-2-repair-demo", "phase-2-route-review", "body-governance-readiness"]) {
  if (!controlRoom.panels?.some((item) => item.id === panel && item.status === "available")) {
    throw new Error(`demo control room missing available panel ${panel}: ${JSON.stringify(controlRoom.panels)}`);
  }
}
if (!controlRoom.operatorScript?.some((line) => line.includes("not broader mutation or plugin/runtime work"))) {
  throw new Error(`demo control room should include operator script boundary: ${JSON.stringify(controlRoom.operatorScript)}`);
}
if (controlRoom.next?.recommendedSlice !== "openclaw-phase-2-demo-walkthrough") {
  throw new Error(`demo control room should point to demo walkthrough next: ${JSON.stringify(controlRoom.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2DemoControlRoom: {
    status: "passed",
    registry: controlRoom.registry,
    controlRoomStatus: controlRoom.status,
    panels: `${controlRoom.summary.availablePanels}/${controlRoom.summary.totalPanels}`,
    selectedSlice: controlRoom.summary.selectedSlice,
    createsTask: controlRoom.governance.createsTask,
    mutatesHost: controlRoom.governance.mutatesHost,
  },
}, null, 2));
EOF
