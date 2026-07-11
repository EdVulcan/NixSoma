#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md"
CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"

core_user="$(systemctl show openclaw-core.service --property=User --value)"
core_environment="$(systemctl show openclaw-core.service --property=Environment --value)"
if [[ "$core_user" != "openclaw-service"
  || "$core_environment" != *"OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION=polkit-dbus-fixed-unit"*
  || "$core_environment" != *"OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER=/nix/store/"*
  || "$core_environment" == *"OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER_SUDO"*
  || "$core_environment" == *"sudo-nopasswd-fixed-helper"* ]]; then
  echo "installed OpenClaw core has not loaded the native Polkit D-Bus generation" >&2
  exit 65
fi
systemctl is-active --quiet openclaw-core.service openclaw-system-sense.service
curl --silent --fail "$CORE_URL/health" >/dev/null

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true,"execute":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one real OpenClaw system-sense repair execution attempt."}')"
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
  "Second Slice: Fixed Native Restart",
  "org.freedesktop.systemd1.Manager.RestartUnit",
  "There is no direct",
  "changed PID",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing next real-execution token: ${token}`);
  }
}

if (!created.ok || created.registry !== "openclaw-systemd-next-repair-real-execution-v0") {
  throw new Error(`next real execution task should expose expected registry: ${JSON.stringify(created)}`);
}
if (created.mode !== "operator-reviewed-next-systemd-repair-real-execution-task"
  || created.governance?.realExecutionEnabled !== true
  || created.governance?.hostMutation !== false) {
  throw new Error(`next real execution task should be explicit and not mutate before approval: ${JSON.stringify(created.governance)}`);
}
if (created.task?.status !== "queued"
  || created.task?.type !== "systemd_next_repair_task"
  || created.task?.systemdNextRepair?.target?.unit !== "openclaw-system-sense.service"
  || created.task?.systemdNextRepair?.execution?.realExecutionEnabled !== true) {
  throw new Error(`next real execution task should target system-sense only: ${JSON.stringify(created.task)}`);
}
if (created.task?.systemdNextRepair?.command?.command !== "systemctl"
  || created.task?.systemdNextRepair?.command?.args?.join(" ") !== "restart openclaw-system-sense.service"
  || created.task?.systemdNextRepair?.command?.wouldExecute !== true) {
  throw new Error(`next real execution task should carry exact restart command: ${JSON.stringify(created.task?.systemdNextRepair?.command)}`);
}
if (created.approval?.status !== "pending" || created.approval?.risk !== "high") {
  throw new Error(`next real execution task should require high-risk approval: ${JSON.stringify(created.approval)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`next real execution approval should be approved: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run the approved next real execution task: ${JSON.stringify(step)}`);
}

const finalTask = step.task ?? taskState.task;
const outcomeKind = finalTask?.outcome?.kind;
if (outcomeKind !== "systemd_next_repair_execution_completed") {
  throw new Error(`next real execution task should complete through native D-Bus: ${JSON.stringify(finalTask)}`);
}
const details = finalTask.outcome?.details ?? {};
if (details.hostMutation !== true || details.hostMutationAttempted !== true || details.executed !== true) {
  throw new Error(`next real execution should mark explicit host mutation attempt: ${JSON.stringify(details)}`);
}
const transcript = details.commandTranscript?.[0];
if (!transcript || transcript.command !== "systemctl restart openclaw-system-sense.service") {
  throw new Error(`next real execution should record command transcript: ${JSON.stringify(details.commandTranscript)}`);
}
if (transcript.exitCode !== 0
  || transcript.skipped === true
  || transcript.transport !== "dbus_native"
  || transcript.method !== "org.freedesktop.systemd1.Manager.RestartUnit"
  || !String(transcript.jobPath).startsWith("/org/freedesktop/systemd1/job/")
  || !Number.isInteger(transcript.beforeMainPid)
  || !Number.isInteger(transcript.afterMainPid)
  || transcript.beforeMainPid === transcript.afterMainPid
  || transcript.authDelegation?.mode !== "polkit-dbus-fixed-unit"
  || transcript.authDelegation?.sudo !== null
  || details.executionSucceeded !== true) {
  throw new Error(`next real execution transcript should prove native Polkit-authorized restart: ${JSON.stringify(transcript)}`);
}
if (typeof details.rollbackNote !== "string" || !details.rollbackNote.includes("verify health")) {
  throw new Error(`next real execution should carry rollback note: ${JSON.stringify(details.rollbackNote)}`);
}
if (!details.postExecutionVerification?.summary || details.postExecutionVerification?.governance?.triggersRecovery !== false) {
  throw new Error(`next real execution should carry verification evidence without recovery: ${JSON.stringify(details.postExecutionVerification)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairRealExecution: {
    status: "passed",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    outcome: outcomeKind,
    command: transcript.command,
    actualCommand: transcript.actualCommand,
    transport: transcript.transport,
    method: transcript.method,
    jobPath: transcript.jobPath,
    beforeMainPid: transcript.beforeMainPid,
    afterMainPid: transcript.afterMainPid,
    exitCode: transcript.exitCode,
    hostMutationAttempted: details.hostMutationAttempted,
    executionSucceeded: details.executionSucceeded,
  },
}, null, 2));
EOF
