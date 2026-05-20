#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6140}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6141}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6142}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6143}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6144}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6145}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6146}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6147}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6210}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-2-demo-control-room-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-2-demo-control-room-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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
control_room="$(curl --silent --fail "$CORE_URL/phase-2/demo-control-room")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$control_room"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const controlRoom = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Phase 2 Demo Control Room",
  "phase2-demo-control-room-panel",
  "phase2-demo-control-room-status",
  "phase2-demo-control-room-panels",
  "phase2-demo-control-room-slice",
  "phase2-demo-control-room-mutation",
  "phase2-demo-control-room-json",
];
const requiredClient = [
  "/phase-2/demo-control-room",
  "refreshPhase2DemoControlRoom",
  "phase2DemoControlRoomStatus",
  "phase2DemoControlRoomPanels",
  "phase2DemoControlRoomSlice",
  "phase2DemoControlRoomMutation",
  "phase2DemoControlRoomJson",
  "operatorScript",
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
if (!controlRoom.ok || controlRoom.registry !== "openclaw-phase-2-demo-control-room-v0") {
  throw new Error(`Observer source should expose demo control room registry: ${JSON.stringify(controlRoom)}`);
}
if (controlRoom.summary?.ready !== true || controlRoom.summary?.selectedSlice !== "openclaw-phase-2-demo-control-room") {
  throw new Error(`Observer-facing demo control room should be ready: ${JSON.stringify(controlRoom.summary)}`);
}
if (controlRoom.governance?.createsTask !== false
  || controlRoom.governance?.mutatesHost !== false
  || controlRoom.governance?.executesCommand !== false
  || controlRoom.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing demo control room must not execute or recover: ${JSON.stringify(controlRoom.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase2DemoControlRoom: {
    status: "passed",
    panel: "Phase 2 Demo Control Room",
    registry: controlRoom.registry,
    ready: controlRoom.summary?.ready,
    panels: `${controlRoom.summary?.availablePanels}/${controlRoom.summary?.totalPanels}`,
    mutatesHost: controlRoom.governance?.mutatesHost,
  },
}, null, 2));
EOF
