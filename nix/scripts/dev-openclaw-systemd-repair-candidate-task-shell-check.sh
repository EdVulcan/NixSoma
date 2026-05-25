#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6270}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6271}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6272}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6273}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6274}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6275}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6276}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6277}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6340}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-task-shell-check.json}"

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

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
route_gate="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-task-route")"
created="$(post_json "$CORE_URL/system/systemd/repair-candidate-tasks" '{"confirm":true}')"
blocked_step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$PLAN_FILE" "$route_gate" "$created" "$blocked_step"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const routeGate = JSON.parse(process.argv[3]);
const created = JSON.parse(process.argv[4]);
const blockedStep = JSON.parse(process.argv[5]);

for (const token of [
  "openclaw-systemd-repair-candidate-task-shell",
  "Systemd repair candidate task shell checkpoint",
  "Creates a queued task and pending approval",
  "Must remain limited to `openclaw-browser-runtime.service`",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing candidate task shell token: ${token}`);
  }
}

if (!routeGate.ok || routeGate.registry !== "openclaw-systemd-repair-candidate-task-route-v0") {
  throw new Error(`candidate route gate should be available: ${JSON.stringify(routeGate)}`);
}
if (routeGate.routeDecision?.targetUnit !== "openclaw-browser-runtime.service"
  || routeGate.routeDecision?.existingRouteAvailable !== true) {
  throw new Error(`candidate route gate should stay on browser-runtime existing route: ${JSON.stringify(routeGate.routeDecision)}`);
}
if (!created.ok || created.registry !== "openclaw-systemd-repair-candidate-task-shell-v0") {
  throw new Error(`candidate task shell should expose expected registry: ${JSON.stringify(created)}`);
}
if (created.mode !== "approval-gated-candidate-task-shell") {
  throw new Error(`candidate task shell should be approval-gated: ${JSON.stringify(created.mode)}`);
}
if (created.sourceRegistry !== "openclaw-systemd-repair-candidate-task-route-v0") {
  throw new Error(`candidate task shell should cite route gate: ${JSON.stringify(created.sourceRegistry)}`);
}
if (created.task?.status !== "queued"
  || created.task?.type !== "systemd_repair_execution_task"
  || created.task?.systemdRepair?.target?.unit !== "openclaw-browser-runtime.service") {
  throw new Error(`candidate task shell should queue browser-runtime repair task: ${JSON.stringify(created.task)}`);
}
if (created.approval?.status !== "pending" || created.approval?.risk !== "high") {
  throw new Error(`candidate task shell should create pending high-risk approval: ${JSON.stringify(created.approval)}`);
}
if (created.task?.systemdRepairCandidate?.registry !== "openclaw-systemd-repair-candidate-task-shell-v0"
  || created.task?.systemdRepairCandidate?.routeRegistry !== "openclaw-systemd-repair-candidate-task-route-v0") {
  throw new Error(`candidate task should carry candidate route metadata: ${JSON.stringify(created.task?.systemdRepairCandidate)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.executed !== false
  || created.governance?.hostMutation !== false
  || created.governance?.canExecuteWithoutApproval !== false
  || created.governance?.realExecutionEnabled !== false) {
  throw new Error(`candidate task shell governance should stop before execution: ${JSON.stringify(created.governance)}`);
}
if (!blockedStep.ok || blockedStep.ran !== false || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`candidate task shell should block operator before approval: ${JSON.stringify(blockedStep)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidateTaskShell: {
    status: "passed",
    registry: created.registry,
    taskId: created.task.id,
    approvalId: created.approval.id,
    target: created.task.systemdRepair.target.unit,
    blockedReason: blockedStep.reason,
    hostMutation: created.governance.hostMutation,
  },
}, null, 2));
EOF
