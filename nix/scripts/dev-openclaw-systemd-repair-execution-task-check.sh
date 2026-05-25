#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5890}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5891}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5892}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5893}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5894}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5895}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5896}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5897}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5960}"
export OPENCLAW_AUTONOMY_MODE="guardian"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-execution-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-execution-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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

draft="$(curl --silent --fail "$CORE_URL/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service")"
created="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true}')"
blocked_step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$draft" "$created" "$blocked_step"
const draft = JSON.parse(process.argv[2]);
const created = JSON.parse(process.argv[3]);
const blockedStep = JSON.parse(process.argv[4]);

if (!draft.ok || draft.registry !== "openclaw-systemd-repair-execution-task-v0") {
  throw new Error(`execution task draft should expose registry: ${JSON.stringify(draft)}`);
}
if (draft.mode !== "operator-reviewed-execution-task-draft") {
  throw new Error(`execution task draft should be operator-reviewed: ${JSON.stringify(draft)}`);
}
if (draft.draft?.policy?.decision?.decision !== "require_approval" || draft.draft?.policy?.decision?.risk !== "high") {
  throw new Error(`execution task draft should require high-risk approval: ${JSON.stringify(draft.draft?.policy)}`);
}
if (draft.draft?.systemdRepair?.execution?.hostMutation !== false || draft.draft?.systemdRepair?.execution?.executed !== false) {
  throw new Error(`execution task draft should not mutate host: ${JSON.stringify(draft.draft?.systemdRepair?.execution)}`);
}
if (draft.draft?.systemdRepair?.inventoryRegistry !== "openclaw-systemd-unit-inventory-v0") {
  throw new Error(`execution task draft should link inventory evidence: ${JSON.stringify(draft.draft?.systemdRepair)}`);
}
if (draft.draft?.systemdRepair?.planRegistry !== "openclaw-systemd-repair-plan-v0") {
  throw new Error(`execution task draft should link repair-plan evidence: ${JSON.stringify(draft.draft?.systemdRepair)}`);
}
if (draft.draft?.systemdRepair?.sourceRegistry !== "openclaw-systemd-repair-dry-run-v0") {
  throw new Error(`execution task draft should link dry-run evidence: ${JSON.stringify(draft.draft?.systemdRepair)}`);
}

if (!created.ok || created.registry !== "openclaw-systemd-repair-execution-task-v0") {
  throw new Error(`execution task creation should expose registry: ${JSON.stringify(created)}`);
}
if (created.mode !== "operator-reviewed-execution-task") {
  throw new Error(`execution task should use operator-reviewed mode: ${JSON.stringify(created)}`);
}
if (created.task?.type !== "systemd_repair_execution_task" || created.task?.status !== "queued") {
  throw new Error(`execution task should be queued systemd repair task: ${JSON.stringify(created.task)}`);
}
if (created.task?.systemdRepair?.target?.unit !== "openclaw-browser-runtime.service") {
  throw new Error(`execution task should target browser runtime unit: ${JSON.stringify(created.task?.systemdRepair)}`);
}
if (created.approval?.status !== "pending" || created.approval?.risk !== "high") {
  throw new Error(`execution task should create pending high-risk approval: ${JSON.stringify(created.approval)}`);
}
if (created.governance?.createsTask !== true || created.governance?.createsApproval !== true) {
  throw new Error(`execution task should materialize task and approval: ${JSON.stringify(created.governance)}`);
}
if (created.governance?.executed !== false || created.governance?.hostMutation !== false || created.governance?.canExecuteWithoutApproval !== false) {
  throw new Error(`execution task should not execute or mutate host: ${JSON.stringify(created.governance)}`);
}

if (!blockedStep.ok || blockedStep.ran !== false || blockedStep.blocked !== true || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`operator step should block execution before approval: ${JSON.stringify(blockedStep)}`);
}
if (blockedStep.task?.id !== created.task.id || blockedStep.approval?.id !== created.approval.id) {
  throw new Error(`blocked step should reference created task approval: ${JSON.stringify(blockedStep)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairExecutionTask: {
    status: "passed",
    registry: created.registry,
    taskId: created.task.id,
    approvalId: created.approval.id,
    target: created.task.systemdRepair.target.unit,
    blockedReason: blockedStep.reason,
    executed: created.governance.executed,
    hostMutation: created.governance.hostMutation,
  },
}, null, 2));
EOF
