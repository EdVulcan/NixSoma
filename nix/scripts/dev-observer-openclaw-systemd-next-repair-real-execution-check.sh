#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
OBSERVER_URL="${OPENCLAW_INSTALLED_OBSERVER_URL:-http://127.0.0.1:4170}"
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
systemctl is-active --quiet openclaw-core.service openclaw-system-sense.service openclaw-hostd.service observer-ui.service
curl --silent --fail "$CORE_URL/health" >/dev/null
curl --silent --fail "$OBSERVER_URL/health" >/dev/null

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
created_payload='{"confirm":true,"execute":true}'
if [[ -n "${OPENCLAW_SYSTEMD_NEXT_REPAIR_TARGET_UNIT:-}" ]]; then
  created_payload="$(node -e 'process.stdout.write(JSON.stringify({confirm:true,execute:true,targetUnit:process.argv[1]}))' "$TARGET_UNIT")"
fi
created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" "$created_payload")"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approval_payload="$(node -e 'process.stdout.write(JSON.stringify({approvedBy:"observer-milestone-check",reason:`Approve Observer-visible ${process.argv[1]} repair execution attempt.`}))' "$TARGET_UNIT")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" "$approval_payload")"
step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created" "$approved" "$step" "$TARGET_UNIT" "$TARGET_OPERATION" "$TARGET_CAPABILITY_ID"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const approved = JSON.parse(process.argv[5]);
const step = JSON.parse(process.argv[6]);
const targetUnit = process.argv[7];
const targetOperation = process.argv[8];
const targetCapabilityId = process.argv[9];

for (const token of [
  "Create Next Repair Real Execution Task",
  "create-systemd-next-repair-real-execution-button",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "createSystemdNextRepairRealExecutionTask",
  "execute: true",
  "realExecutionEnabled=",
  "systemd.next_repair.execution_completed",
  "systemd.next_repair.execution_failed",
  "openclaw-systemd-next-repair-real-execution-v0",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!created.ok || created.registry !== "openclaw-systemd-next-repair-real-execution-v0" || created.governance?.realExecutionEnabled !== true) {
  throw new Error(`Observer source should create explicit next real execution task: ${JSON.stringify(created)}`);
}
if (created.task?.systemdNextRepair?.target?.unit !== targetUnit
  || created.approval?.status !== "pending") {
  throw new Error(`Observer source should expose next real execution approval: ${JSON.stringify(created)}`);
}
if (created.task?.systemdNextRepair?.command?.args?.join(" ") !== `restart ${targetUnit}`
  || created.task?.systemdNextRepair?.capability?.operation !== targetOperation
  || created.task?.systemdNextRepair?.capability?.capabilityId !== targetCapabilityId) {
  throw new Error(`Observer source should bind the selected fixed capability: ${JSON.stringify(created.task?.systemdNextRepair)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`Observer source should approve next real execution task: ${JSON.stringify(approved)}`);
}
const finalTask = step.task;
if (!step.ok || step.ran !== true || finalTask?.outcome?.kind !== "systemd_next_repair_execution_completed") {
  throw new Error(`Observer source should expose next real execution operator result: ${JSON.stringify(step)}`);
}
const details = finalTask.outcome?.details ?? {};
const transcript = details.commandTranscript?.[0];
if (details.hostMutationAttempted !== true
  || details.executed !== true
  || details.executionSucceeded !== true
  || transcript?.command !== `systemctl restart ${targetUnit}`
  || transcript?.exitCode !== 0
  || transcript?.transport !== "dbus_native"
  || transcript?.method !== "org.freedesktop.systemd1.Manager.RestartUnit"
  || !String(transcript?.jobPath).startsWith("/org/freedesktop/systemd1/job/")
  || !Number.isInteger(transcript?.beforeMainPid)
  || !Number.isInteger(transcript?.afterMainPid)
  || transcript?.beforeMainPid === transcript?.afterMainPid
  || transcript?.authDelegation?.mode !== "polkit-dbus-fixed-unit"
  || transcript?.authDelegation?.sudo !== null
  || transcript?.peerIdentity?.boundary !== "kernel_so_peercred"
  || transcript?.peerIdentity?.verified !== true
  || transcript?.peerIdentity?.matched !== true
  || transcript?.nativeCapability?.operation !== targetOperation
  || transcript?.nativeCapability?.capabilityId !== targetCapabilityId
  || details.postExecutionVerification?.summary?.restoredHealthy !== true
  || details.postExecutionVerification?.recoveryRecommendation !== null) {
  throw new Error(`Observer source should expose next real execution evidence: ${JSON.stringify(details)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdNextRepairRealExecution: {
    status: "passed",
    panel: "Next Repair Task Shell",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    outcome: finalTask.outcome.kind,
    command: transcript.command,
    actualCommand: transcript.actualCommand,
    targetUnit,
    capability: transcript.nativeCapability,
    exitCode: transcript.exitCode,
    transport: transcript.transport,
    method: transcript.method,
    beforeMainPid: transcript.beforeMainPid,
    afterMainPid: transcript.afterMainPid,
    hostMutationAttempted: details.hostMutationAttempted,
  },
}, null, 2));
EOF
