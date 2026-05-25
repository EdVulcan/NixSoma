#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5930}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5931}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5932}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5933}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5934}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5935}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5936}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5937}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6000}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-real-execution-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-real-execution-check.json}"

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

draft="$(curl --silent --fail "$CORE_URL/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service&execute=true")"
created="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one real OpenClaw-owned systemd repair execution attempt."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created")"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$PLAN_FILE" "$draft" "$created" "$approved" "$step" "$task_state"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const draft = JSON.parse(process.argv[3]);
const created = JSON.parse(process.argv[4]);
const approved = JSON.parse(process.argv[5]);
const step = JSON.parse(process.argv[6]);
const taskState = JSON.parse(process.argv[7]);

for (const token of [
  "openclaw-systemd-repair-real-execution",
  "Executes only `systemctl restart openclaw-browser-runtime.service`",
  "Records command, target, exit code, stdout/stderr, result, and rollback note in task evidence",
  "Must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or any automatic repair loop",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing real-execution route token: ${token}`);
  }
}

if (!draft.ok || draft.mode !== "operator-reviewed-real-execution-task-draft") {
  throw new Error(`real execution draft should be explicit: ${JSON.stringify(draft)}`);
}
if (draft.draft?.systemdRepair?.execution?.realExecutionEnabled !== true) {
  throw new Error(`real execution draft should enable real execution: ${JSON.stringify(draft.draft?.systemdRepair?.execution)}`);
}
if (draft.draft?.systemdRepair?.command?.command !== "systemctl"
  || draft.draft?.systemdRepair?.command?.args?.join(" ") !== "restart openclaw-browser-runtime.service") {
  throw new Error(`real execution draft should expose the selected restart command: ${JSON.stringify(draft.draft?.systemdRepair?.command)}`);
}
if (!created.ok || created.mode !== "operator-reviewed-real-execution-task" || created.governance?.realExecutionEnabled !== true) {
  throw new Error(`real execution task should be materialized explicitly: ${JSON.stringify(created)}`);
}
if (created.task?.systemdRepair?.target?.unit !== "openclaw-browser-runtime.service") {
  throw new Error(`real execution task should target browser runtime only: ${JSON.stringify(created.task?.systemdRepair?.target)}`);
}
if (created.approval?.status !== "pending" || created.approval?.risk !== "high") {
  throw new Error(`real execution task should require high-risk approval: ${JSON.stringify(created.approval)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`real execution approval should be approved: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run the approved real execution task: ${JSON.stringify(step)}`);
}

const finalTask = step.task ?? taskState.task;
const outcomeKind = finalTask?.outcome?.kind;
if (!["systemd_repair_execution_completed", "systemd_repair_execution_failed"].includes(outcomeKind)) {
  throw new Error(`real execution task should finish with systemd execution evidence: ${JSON.stringify(finalTask)}`);
}
const details = finalTask.outcome?.details ?? {};
if (details.hostMutation !== true || details.hostMutationAttempted !== true || details.executed !== true) {
  throw new Error(`real execution should mark explicit host mutation attempt: ${JSON.stringify(details)}`);
}
const transcript = details.commandTranscript?.[0];
if (!transcript || transcript.command !== "systemctl restart openclaw-browser-runtime.service") {
  throw new Error(`real execution should record command transcript: ${JSON.stringify(details.commandTranscript)}`);
}
if (!Number.isInteger(transcript.exitCode) || transcript.skipped === true) {
  throw new Error(`real execution transcript should include a real exit code: ${JSON.stringify(transcript)}`);
}
if (typeof details.rollbackNote !== "string" || !details.rollbackNote.includes("verify health")) {
  throw new Error(`real execution should carry rollback note: ${JSON.stringify(details.rollbackNote)}`);
}
const attempt = (step.execution?.attempts ?? []).find((item) =>
  item.taskId === finalTask.id
    && ["systemd_repair_execution_completed", "systemd_repair_execution_failed"].includes(item.phase)
);
if (!attempt) {
  throw new Error(`operator execution summary should include real execution attempt: ${JSON.stringify(step.execution)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairRealExecution: {
    status: "passed",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    outcome: outcomeKind,
    command: transcript.command,
    exitCode: transcript.exitCode,
    hostMutationAttempted: details.hostMutationAttempted,
    executionSucceeded: details.executionSucceeded,
  },
}, null, 2));
EOF
