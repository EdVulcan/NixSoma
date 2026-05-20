#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6160}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6161}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6162}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6163}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6164}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6165}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6166}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6167}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6230}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-2-demo-walkthrough-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-2-demo-walkthrough-check.json}"

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
walkthrough="$(curl --silent --fail "$CORE_URL/phase-2/demo-walkthrough")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$walkthrough"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const walkthrough = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Phase 2 Demo Walkthrough",
  "phase2-demo-walkthrough-panel",
  "phase2-demo-walkthrough-status",
  "phase2-demo-walkthrough-steps",
  "phase2-demo-walkthrough-control-room",
  "phase2-demo-walkthrough-mutation",
  "phase2-demo-walkthrough-json",
];
const requiredClient = [
  "/phase-2/demo-walkthrough",
  "refreshPhase2DemoWalkthrough",
  "phase2DemoWalkthroughStatus",
  "phase2DemoWalkthroughSteps",
  "phase2DemoWalkthroughControlRoom",
  "phase2DemoWalkthroughMutation",
  "phase2DemoWalkthroughJson",
  "script",
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
if (!walkthrough.ok || walkthrough.registry !== "openclaw-phase-2-demo-walkthrough-v0") {
  throw new Error(`Observer source should expose demo walkthrough registry: ${JSON.stringify(walkthrough)}`);
}
if (walkthrough.summary?.ready !== true || walkthrough.summary?.controlRoomReady !== true) {
  throw new Error(`Observer-facing demo walkthrough should be ready: ${JSON.stringify(walkthrough.summary)}`);
}
if (walkthrough.governance?.createsTask !== false
  || walkthrough.governance?.mutatesHost !== false
  || walkthrough.governance?.executesCommand !== false
  || walkthrough.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing demo walkthrough must not execute or recover: ${JSON.stringify(walkthrough.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase2DemoWalkthrough: {
    status: "passed",
    panel: "Phase 2 Demo Walkthrough",
    registry: walkthrough.registry,
    ready: walkthrough.summary?.ready,
    steps: `${walkthrough.summary?.readySteps}/${walkthrough.summary?.totalSteps}`,
    mutatesHost: walkthrough.governance?.mutatesHost,
  },
}, null, 2));
EOF
