#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
OBSERVER_URL="${OPENCLAW_INSTALLED_OBSERVER_URL:-http://127.0.0.1:4170}"

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
systemctl is-active --quiet openclaw-core.service openclaw-system-sense.service observer-ui.service
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
created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true,"execute":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve Observer-visible next real systemd repair execution attempt."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created" "$approved" "$step"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const approved = JSON.parse(process.argv[5]);
const step = JSON.parse(process.argv[6]);

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
if (created.task?.systemdNextRepair?.target?.unit !== "openclaw-system-sense.service"
  || created.approval?.status !== "pending") {
  throw new Error(`Observer source should expose next real execution approval: ${JSON.stringify(created)}`);
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
  || transcript?.command !== "systemctl restart openclaw-system-sense.service"
  || transcript?.exitCode !== 0
  || transcript?.transport !== "dbus_native"
  || transcript?.method !== "org.freedesktop.systemd1.Manager.RestartUnit"
  || !String(transcript?.jobPath).startsWith("/org/freedesktop/systemd1/job/")
  || !Number.isInteger(transcript?.beforeMainPid)
  || !Number.isInteger(transcript?.afterMainPid)
  || transcript?.beforeMainPid === transcript?.afterMainPid
  || transcript?.authDelegation?.mode !== "polkit-dbus-fixed-unit"
  || transcript?.authDelegation?.sudo !== null) {
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
    exitCode: transcript.exitCode,
    transport: transcript.transport,
    method: transcript.method,
    beforeMainPid: transcript.beforeMainPid,
    afterMainPid: transcript.afterMainPid,
    hostMutationAttempted: details.hostMutationAttempted,
  },
}, null, 2));
EOF
