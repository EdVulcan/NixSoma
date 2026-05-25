#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5910}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5911}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5912}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5913}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5914}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5915}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5916}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5917}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5980}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-approved-deferred-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-approved-deferred-check.json}"

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

created="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve systemd repair task shell for deferred execution verification."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created")"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$PLAN_FILE" "$created" "$approved" "$step" "$task_state"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const approved = JSON.parse(process.argv[4]);
const step = JSON.parse(process.argv[5]);
const taskState = JSON.parse(process.argv[6]);

for (const token of [
  "openclaw-systemd-repair-approved-deferred",
  "approval unlocks operator flow but still ends in a deferred execution shell",
  "hostMutation=false",
  "executed=false",
  "must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or real `systemctl restart` execution",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing approved-deferred route token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-systemd-repair-execution-task-v0") {
  throw new Error(`created task should be a systemd repair execution task: ${JSON.stringify(created)}`);
}
if (created.approval?.status !== "pending") {
  throw new Error(`created task should start with pending approval: ${JSON.stringify(created.approval)}`);
}
if (!approved.ok || approved.approval?.status !== "approved" || approved.task?.approval?.status !== "approved") {
  throw new Error(`approval should move to approved: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run after approval: ${JSON.stringify(step)}`);
}

const finalTask = step.task ?? taskState.task;
if (finalTask?.id !== created.task?.id) {
  throw new Error(`operator step should complete the approved task: ${JSON.stringify({ stepTask: finalTask?.id, created: created.task?.id })}`);
}
if (finalTask?.status !== "completed" || finalTask?.outcome?.kind !== "systemd_repair_execution_deferred") {
  throw new Error(`approved task should complete as deferred execution: ${JSON.stringify(finalTask)}`);
}
const details = finalTask.outcome?.details ?? {};
if (details.hostMutation !== false || details.executed !== false || details.futureExecutionRequiresSeparateMilestone !== true) {
  throw new Error(`approved deferred task must not mutate or execute: ${JSON.stringify(details)}`);
}
const deferredAttempt = (step.execution?.attempts ?? []).find(
  (attempt) => attempt.taskId === finalTask.id
    && attempt.status === "completed"
    && attempt.phase === "systemd_repair_execution_deferred",
);
if (!deferredAttempt) {
  throw new Error(`operator execution should record a completed deferred execution attempt: ${JSON.stringify(step.execution)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairApprovedDeferred: {
    status: "passed",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    outcome: finalTask.outcome.kind,
    operatorRan: step.ran,
    hostMutation: details.hostMutation,
    executed: details.executed,
  },
}, null, 2));
EOF
