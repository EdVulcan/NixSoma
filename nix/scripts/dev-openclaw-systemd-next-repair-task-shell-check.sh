#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-task-shell-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-task-shell-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before next repair task shell."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair task shell."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair task shell."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

route_gate="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-task-route")"
created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true}')"
blocked_step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$PLAN_FILE" "$route_gate" "$created" "$blocked_step"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const routeGate = JSON.parse(process.argv[3]);
const created = JSON.parse(process.argv[4]);
const blockedStep = JSON.parse(process.argv[5]);

for (const token of [
  "Systemd next repair task shell checkpoint",
  "openclaw-systemd-next-repair-task-shell",
  "Creates one queued `systemd_next_repair_task` with pending high-risk approval",
  "Must not approve the task, execute `systemctl`",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair task shell token: ${token}`);
  }
}

if (!routeGate.ok || routeGate.registry !== "openclaw-systemd-next-repair-task-route-v0") {
  throw new Error(`next repair task route should be available: ${JSON.stringify(routeGate)}`);
}
if (routeGate.routeDecision?.targetUnit !== "openclaw-system-sense.service"
  || routeGate.routeDecision?.selectedSlice !== "openclaw-systemd-next-repair-task-shell"
  || routeGate.routeDecision?.taskShellAllowed !== true) {
  throw new Error(`next repair route should allow task shell only: ${JSON.stringify(routeGate.routeDecision)}`);
}
if (!created.ok || created.registry !== "openclaw-systemd-next-repair-task-shell-v0") {
  throw new Error(`next repair task shell should expose expected registry: ${JSON.stringify(created)}`);
}
if (created.mode !== "approval-gated-next-systemd-repair-task-shell") {
  throw new Error(`next repair task shell should be approval-gated: ${JSON.stringify(created.mode)}`);
}
if (created.sourceRegistry !== "openclaw-systemd-next-repair-task-route-v0") {
  throw new Error(`next repair task shell should cite task route: ${JSON.stringify(created.sourceRegistry)}`);
}
if (created.task?.status !== "queued"
  || created.task?.type !== "systemd_next_repair_task"
  || created.task?.workViewStrategy !== "systemd-next-repair-task"
  || created.task?.systemdNextRepair?.target?.unit !== "openclaw-system-sense.service") {
  throw new Error(`next repair task shell should queue system-sense task: ${JSON.stringify(created.task)}`);
}
if (created.task?.systemdNextRepair?.registry !== "openclaw-systemd-next-repair-task-shell-v0"
  || created.task?.systemdNextRepair?.sourceRegistry !== "openclaw-systemd-next-repair-task-route-v0"
  || created.task?.systemdNextRepair?.command?.command !== "systemctl"
  || !created.task?.systemdNextRepair?.command?.args?.includes("openclaw-system-sense.service")
  || created.task?.systemdNextRepair?.command?.wouldExecute !== false) {
  throw new Error(`next repair task should carry route and dry-run command metadata: ${JSON.stringify(created.task?.systemdNextRepair)}`);
}
if (created.approval?.status !== "pending"
  || created.approval?.risk !== "high"
  || created.approval?.intent !== "systemd.next_repair.execute") {
  throw new Error(`next repair task shell should create pending high-risk approval: ${JSON.stringify(created.approval)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.canExecuteWithoutApproval !== false
  || created.governance?.executed !== false
  || created.governance?.hostMutation !== false
  || created.governance?.realExecutionEnabled !== false
  || created.governance?.futureExecutionRequiresSeparateMilestone !== true) {
  throw new Error(`next repair task shell governance should stop before execution: ${JSON.stringify(created.governance)}`);
}
if (!blockedStep.ok || blockedStep.ran !== false || blockedStep.blocked !== true || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`next repair task shell should block operator before approval: ${JSON.stringify(blockedStep)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairTaskShell: {
    status: "passed",
    registry: created.registry,
    taskId: created.task.id,
    approvalId: created.approval.id,
    target: created.task.systemdNextRepair.target.unit,
    blockedReason: blockedStep.reason,
    hostMutation: created.governance.hostMutation,
  },
}, null, 2));
EOF
