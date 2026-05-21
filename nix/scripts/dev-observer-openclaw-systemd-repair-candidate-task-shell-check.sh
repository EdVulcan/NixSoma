#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6280}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6281}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6282}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6283}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6284}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6285}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6286}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6287}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6350}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-candidate-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-candidate-task-shell-check.json}"

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

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
route_gate="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-task-route")"
created="$(post_json "$CORE_URL/system/systemd/repair-candidate-tasks" '{"confirm":true}')"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$route_gate" "$created"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const routeGate = JSON.parse(process.argv[4]);
const created = JSON.parse(process.argv[5]);

const requiredHtml = [
  "Repair Candidate Task Shell",
  "systemd-repair-candidate-task-shell-panel",
  "systemd-repair-candidate-task-shell-ready",
  "systemd-repair-candidate-task-shell-target",
  "systemd-repair-candidate-task-shell-approval",
  "systemd-repair-candidate-task-shell-mutation",
  "create-systemd-repair-candidate-task-shell-button",
  "systemd-repair-candidate-task-shell-json",
];
const requiredClient = [
  "/system/systemd/repair-candidate-tasks",
  "refreshSystemdRepairCandidateTaskShell",
  "createSystemdRepairCandidateTaskShell",
  "systemdRepairCandidateTaskShellReady",
  "systemdRepairCandidateTaskShellTarget",
  "systemdRepairCandidateTaskShellApproval",
  "systemdRepairCandidateTaskShellMutation",
  "systemdRepairCandidateTaskShellJson",
  "pending-after-create",
  "openclaw-systemd-repair-candidate-task-shell-v0",
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
if (!routeGate.ok || routeGate.routeDecision?.existingRouteAvailable !== true) {
  throw new Error(`Observer candidate task shell route should be ready: ${JSON.stringify(routeGate)}`);
}
if (!created.ok || created.registry !== "openclaw-systemd-repair-candidate-task-shell-v0") {
  throw new Error(`Observer candidate task shell source should expose registry: ${JSON.stringify(created)}`);
}
if (created.task?.status !== "queued"
  || created.approval?.status !== "pending"
  || created.task?.systemdRepairCandidate?.routeRegistry !== "openclaw-systemd-repair-candidate-task-route-v0") {
  throw new Error(`Observer candidate task shell should expose queued task and pending approval: ${JSON.stringify(created)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.executed !== false
  || created.governance?.hostMutation !== false
  || created.governance?.realExecutionEnabled !== false) {
  throw new Error(`Observer candidate task shell must stop before execution: ${JSON.stringify(created.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairCandidateTaskShell: {
    status: "passed",
    panel: "Repair Candidate Task Shell",
    registry: created.registry,
    taskId: created.task?.id,
    approvalId: created.approval?.id,
    targetUnit: created.task?.systemdRepair?.target?.unit,
    hostMutation: created.governance?.hostMutation,
  },
}, null, 2));
EOF
