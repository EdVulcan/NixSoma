#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md"
CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
TARGET_UNIT="${OPENCLAW_SYSTEMD_NEXT_REPAIR_TARGET_UNIT:-openclaw-system-sense.service}"

case "$TARGET_UNIT" in
  openclaw-system-sense.service)
    TARGET_OPERATION="restart_system_sense"
    TARGET_CAPABILITY_ID="hostd.restart_system_sense"
    ;;
  openclaw-event-hub.service)
    TARGET_OPERATION="restart_event_hub"
    TARGET_CAPABILITY_ID="hostd.restart_event_hub"
    ;;
  openclaw-system-heal.service)
    TARGET_OPERATION="restart_system_heal"
    TARGET_CAPABILITY_ID="hostd.restart_system_heal"
    ;;
  *)
    echo "Unsupported fixed next-repair target: $TARGET_UNIT" >&2
    exit 64
    ;;
esac

core_user="$(systemctl show openclaw-core.service --property=User --value)"
hostd_user="$(systemctl show openclaw-hostd.service --property=User --value)"
core_environment="$(systemctl show openclaw-core.service --property=Environment --value)"
hostd_environment="$(systemctl show openclaw-hostd.service --property=Environment --value)"
if [[ "$core_user" != "openclaw-service"
  || "$hostd_user" != "openclaw-hostd"
  || "$core_environment" != *"OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION=polkit-dbus-fixed-unit"*
  || "$core_environment" != *"OPENCLAW_HOSTD_SOCKET_PATH=/run/openclaw/hostd.sock"*
  || "$hostd_environment" != *"OPENCLAW_HOSTD_PEER_CREDENTIAL_HELPER=/nix/store/"*
  || "$hostd_environment" != *"OPENCLAW_HOSTD_PEER_EXPECTED_USER=openclaw-service"*
  || "$hostd_environment" != *"OPENCLAW_HOSTD_PEER_EXPECTED_GROUP=openclaw"*
  || "$core_environment" == *"sudo-nopasswd-fixed-helper"* ]]; then
  echo "installed OpenClaw core has not loaded the native Polkit D-Bus generation" >&2
  exit 65
fi
systemctl is-active --quiet openclaw-core.service openclaw-system-sense.service openclaw-hostd.service "$TARGET_UNIT"
curl --silent --fail "$CORE_URL/health" >/dev/null

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

created_payload='{"confirm":true,"execute":true}'
if [[ -n "${OPENCLAW_SYSTEMD_NEXT_REPAIR_TARGET_UNIT:-}" ]]; then
  created_payload="$(node -e 'process.stdout.write(JSON.stringify({confirm:true,execute:true,targetUnit:process.argv[1]}))' "$TARGET_UNIT")"
fi
created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" "$created_payload")"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approval_payload="$(node -e 'process.stdout.write(JSON.stringify({approvedBy:"milestone-check",reason:`Approve one real OpenClaw ${process.argv[1]} repair execution attempt.`}))' "$TARGET_UNIT")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" "$approval_payload")"
step="$(post_json "$CORE_URL/operator/step" '{}')"
task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created")"
task_state="$(curl --silent --fail "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$PLAN_FILE" "$created" "$approved" "$step" "$task_state" "$TARGET_UNIT" "$TARGET_OPERATION" "$TARGET_CAPABILITY_ID"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const approved = JSON.parse(process.argv[4]);
const step = JSON.parse(process.argv[5]);
const taskState = JSON.parse(process.argv[6]);
const targetUnit = process.argv[7];
const targetOperation = process.argv[8];
const targetCapabilityId = process.argv[9];
const targetHealthServiceKey = {
  "openclaw-system-sense.service": "systemSense",
  "openclaw-event-hub.service": "eventHub",
  "openclaw-system-heal.service": "systemHeal",
}[targetUnit];

for (const token of [
  "Second Slice: Fixed Native Restart",
  "org.freedesktop.systemd1.Manager.RestartUnit",
  "There is no direct",
  "changed positive main PIDs",
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
  || created.task?.systemdNextRepair?.target?.unit !== targetUnit
  || created.task?.systemdNextRepair?.execution?.realExecutionEnabled !== true) {
  throw new Error(`next real execution task should target the selected fixed unit: ${JSON.stringify(created.task)}`);
}
if (created.task?.systemdNextRepair?.command?.command !== "systemctl"
  || created.task?.systemdNextRepair?.command?.args?.join(" ") !== `restart ${targetUnit}`
  || created.task?.systemdNextRepair?.command?.wouldExecute !== true) {
  throw new Error(`next real execution task should carry exact restart command: ${JSON.stringify(created.task?.systemdNextRepair?.command)}`);
}
if (created.task?.systemdNextRepair?.capability?.operation !== targetOperation
  || created.task?.systemdNextRepair?.capability?.capabilityId !== targetCapabilityId) {
  throw new Error(`next real execution task should carry the selected fixed capability: ${JSON.stringify(created.task?.systemdNextRepair?.capability)}`);
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
if (!transcript || transcript.command !== `systemctl restart ${targetUnit}`) {
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
  || transcript.peerIdentity?.boundary !== "kernel_so_peercred"
  || transcript.peerIdentity?.verified !== true
  || transcript.peerIdentity?.matched !== true
  || transcript.nativeCapability?.operation !== targetOperation
  || transcript.nativeCapability?.capabilityId !== targetCapabilityId
  || details.executionSucceeded !== true
  || details.repairSucceeded !== true) {
  throw new Error(`next real execution transcript should prove native Polkit-authorized restart: ${JSON.stringify(transcript)}`);
}
if (typeof details.rollbackNote !== "string" || !details.rollbackNote.includes("verify health")) {
  throw new Error(`next real execution should carry rollback note: ${JSON.stringify(details.rollbackNote)}`);
}
if (details.postExecutionVerification?.targetHealthServiceKey !== targetHealthServiceKey
  || details.postExecutionVerification?.summary?.targetUnitHealthy !== true
  || details.postExecutionVerification?.summary?.targetServiceHealthy !== true
  || details.postExecutionVerification?.summary?.targetHealthy !== true
  || details.postExecutionVerification?.summary?.nativeMutationVerified !== true
  || details.postExecutionVerification?.summary?.restoredHealthy !== true
  || details.postExecutionVerification?.recoveryRecommendation !== null
  || details.postExecutionVerification?.governance?.triggersRecovery !== false) {
  throw new Error(`next real execution should carry verification evidence without recovery: ${JSON.stringify(details.postExecutionVerification)}`);
}
const diagnosis = details.incidentDiagnosis;
const receipt = details.incidentReceipt;
if (diagnosis?.registry !== "openclaw-systemd-repair-incident-diagnosis-v0"
  || diagnosis?.task?.id !== finalTask.id
  || diagnosis?.task?.stepId !== "execute-next-systemd-restart"
  || diagnosis?.target?.unit !== targetUnit
  || diagnosis?.target?.healthServiceKey !== targetHealthServiceKey
  || diagnosis?.journalEvidence?.registry !== "openclaw-systemd-journal-evidence-v0"
  || diagnosis?.journalEvidence?.available !== true
  || !Number.isInteger(diagnosis?.journalEvidence?.returned)
  || diagnosis?.journalEvidence?.messagesPersisted !== false) {
  throw new Error(`next real execution should bind bounded pre-repair diagnosis: ${JSON.stringify(diagnosis)}`);
}
if (receipt?.registry !== "openclaw-systemd-repair-incident-receipt-v0"
  || receipt?.task?.id !== finalTask.id
  || receipt?.task?.stepId !== "execute-next-systemd-restart"
  || receipt?.target?.unit !== targetUnit
  || receipt?.target?.healthServiceKey !== targetHealthServiceKey
  || receipt?.hostdReceipt?.transport !== "dbus_native"
  || receipt?.hostdReceipt?.jobPath !== transcript.jobPath
  || receipt?.postHealth?.service?.ok !== true
  || receipt?.restoredHealthy !== true
  || receipt?.governance?.singleRestartAttempt !== true
  || receipt?.governance?.automaticRecovery !== false
  || !/^sha256:[a-f0-9]{64}$/u.test(receipt?.receiptHash ?? "")) {
  throw new Error(`next real execution should persist a compact incident receipt: ${JSON.stringify(receipt)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairRealExecution: {
    status: "passed",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    outcome: outcomeKind,
    command: transcript.command,
    actualCommand: transcript.actualCommand,
    targetUnit,
    capability: transcript.nativeCapability,
    transport: transcript.transport,
    method: transcript.method,
    jobPath: transcript.jobPath,
    beforeMainPid: transcript.beforeMainPid,
    afterMainPid: transcript.afterMainPid,
    exitCode: transcript.exitCode,
    hostMutationAttempted: details.hostMutationAttempted,
    executionSucceeded: details.executionSucceeded,
    repairSucceeded: details.repairSucceeded,
    targetHealthServiceKey,
    journalEntries: diagnosis.journalEvidence.returned,
    incidentReceiptHash: receipt.receiptHash,
  },
}, null, 2));
EOF
