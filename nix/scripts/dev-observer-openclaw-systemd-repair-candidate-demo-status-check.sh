#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6340}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6341}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6342}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6343}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6344}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6345}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6346}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6347}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6410}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-candidate-demo-status-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-candidate-demo-status-check.json}"

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
status="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-demo-status")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$status"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const status = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Repair Candidate Demo Status",
  "systemd-repair-candidate-demo-status-panel",
  "systemd-repair-candidate-demo-status-ready",
  "systemd-repair-candidate-demo-status-checks",
  "systemd-repair-candidate-demo-status-target",
  "systemd-repair-candidate-demo-status-mutation",
  "systemd-repair-candidate-demo-status-json",
];
const requiredClient = [
  "/system/systemd/repair-candidate-demo-status",
  "refreshSystemdRepairCandidateDemoStatus",
  "systemdRepairCandidateDemoStatusReady",
  "systemdRepairCandidateDemoStatusChecks",
  "systemdRepairCandidateDemoStatusTarget",
  "systemdRepairCandidateDemoStatusMutation",
  "systemdRepairCandidateDemoStatusJson",
  "openclaw-phase-2-next-capability-route-review",
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
if (!status.ok || status.registry !== "openclaw-systemd-repair-candidate-demo-status-v0") {
  throw new Error(`Observer source should expose candidate demo status registry: ${JSON.stringify(status)}`);
}
if (status.summary?.demoReady !== true || status.summary?.selectedUnit !== "openclaw-browser-runtime.service") {
  throw new Error(`Observer candidate demo status should be demo-ready for browser-runtime: ${JSON.stringify(status.summary)}`);
}
if (status.governance?.createsTask !== false
  || status.governance?.createsApproval !== false
  || status.governance?.executesCommand !== false
  || status.governance?.hostMutation !== false) {
  throw new Error(`Observer candidate demo status must remain read-only: ${JSON.stringify(status.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairCandidateDemoStatus: {
    status: "passed",
    panel: "Repair Candidate Demo Status",
    registry: status.registry,
    demoReady: status.summary?.demoReady,
    target: status.summary?.selectedUnit,
    hostMutation: status.governance?.hostMutation,
  },
}, null, 2));
EOF
