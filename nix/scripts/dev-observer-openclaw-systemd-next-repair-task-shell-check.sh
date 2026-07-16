#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-next-repair-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-next-repair-task-shell-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true}')"
blocked_step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created" "$blocked_step"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const blockedStep = JSON.parse(process.argv[5]);

const requiredHtml = [
  "Next Repair Task Shell",
  "systemd-next-repair-task-shell-panel",
  "systemd-next-repair-task-shell-ready",
  "systemd-next-repair-task-shell-target",
  "systemd-next-repair-target-unit",
  "openclaw-event-hub.service",
  "openclaw-system-heal.service",
  "systemd-next-repair-task-shell-approval",
  "systemd-next-repair-task-shell-mutation",
  "systemd-next-repair-task-shell-json",
  "create-systemd-next-repair-task-shell-button",
  "pending-after-create",
];
const requiredClient = [
  "/system/systemd/next-repair-tasks",
  "refreshSystemdNextRepairTaskShell",
  "createSystemdNextRepairTaskShell",
  "systemdNextRepairTaskShellReady",
  "systemdNextRepairTaskShellTarget",
  "systemdNextRepairTargetUnit",
  "systemdNextRepairTaskShellApproval",
  "systemdNextRepairTaskShellMutation",
  "systemdNextRepairTaskShellJson",
  "openclaw-systemd-next-repair-task-shell-v0",
  "pending-after-create",
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
if (!created.ok || created.registry !== "openclaw-systemd-next-repair-task-shell-v0") {
  throw new Error(`Observer task shell source should create next repair task shell: ${JSON.stringify(created)}`);
}
if (created.task?.type !== "systemd_next_repair_task"
  || created.task?.status !== "queued"
  || created.task?.systemdNextRepair?.target?.unit !== "openclaw-system-sense.service") {
  throw new Error(`Observer task shell should expose queued next repair task details: ${JSON.stringify(created.task)}`);
}
if (created.approval?.status !== "pending"
  || created.approval?.risk !== "high"
  || created.approval?.intent !== "systemd.next_repair.execute") {
  throw new Error(`Observer task shell should expose pending approval: ${JSON.stringify(created.approval)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.executed !== false
  || created.governance?.hostMutation !== false
  || created.governance?.realExecutionEnabled !== false) {
  throw new Error(`Observer task shell governance should stay non-mutating: ${JSON.stringify(created.governance)}`);
}
if (!blockedStep.ok || blockedStep.ran !== false || blockedStep.blocked !== true || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`Observer task shell should block operator before approval: ${JSON.stringify(blockedStep)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdNextRepairTaskShell: {
    status: "passed",
    panel: "Next Repair Task Shell",
    registry: created.registry,
    target: created.task.systemdNextRepair.target.unit,
    approval: created.approval.status,
    blockedReason: blockedStep.reason,
  },
}, null, 2));
EOF
