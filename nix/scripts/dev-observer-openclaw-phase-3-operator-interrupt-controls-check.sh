#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6760}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6761}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6762}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6763}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6764}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6765}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6766}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6767}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6768}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-3-operator-interrupt-controls-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-3-operator-interrupt-controls-check.json}"
export OPENCLAW_SESSION_MANAGER_STATE_FILE="${OPENCLAW_SESSION_MANAGER_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-session-manager-observer-phase-3-operator-interrupt-controls-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp" \
  "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$OPENCLAW_SESSION_MANAGER_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${CONTROLS_FILE:-}" "${START_PROBE_FILE:-}" "${APPROVED_START_PROBE_FILE:-}" "${CONTROLS_AFTER_PROBE_FILE:-}" "${STOP_SIDECAR_FILE:-}" "${CONTROLS_AFTER_STOP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  rm -f "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$OPENCLAW_SESSION_MANAGER_STATE_FILE.tmp"
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
curl --silent --fail -X POST "$SESSION_MANAGER_URL/work-view/prepare" \
  -H 'content-type: application/json' \
  --data '{"displayTarget":"workspace-2","entryUrl":"https://example.com/observer-phase-3-controls"}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
CONTROLS_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_FILE"
SIDECAR_TASK="$(curl --silent --fail -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks" \
  -H 'content-type: application/json' \
  --data '{"confirm":true}')"
SIDECAR_TASK_ID="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$SIDECAR_TASK")"
SIDECAR_APPROVAL_ID="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$SIDECAR_TASK")"
START_PROBE_FILE="$(mktemp)"
APPROVED_START_PROBE_FILE="$(mktemp)"
CONTROLS_AFTER_PROBE_FILE="$(mktemp)"
START_PROBE_STATUS="$(curl --silent --output "$START_PROBE_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$SIDECAR_TASK_ID/start-probe" \
  -H 'content-type: application/json' \
  --data '{}')"
APPROVED_SIDECAR="$(curl --silent --fail -X POST "$CORE_URL/approvals/$SIDECAR_APPROVAL_ID/approve" \
  -H 'content-type: application/json' \
  --data '{"approvedBy":"observer-phase-3-operator-controls-check","reason":"approve trusted sidecar lifecycle probe while keeping process start deferred"}')"
APPROVED_START_PROBE_STATUS="$(curl --silent --output "$APPROVED_START_PROBE_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$SIDECAR_TASK_ID/start-probe" \
  -H 'content-type: application/json' \
  --data '{}')"
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_AFTER_PROBE_FILE"
STOP_SIDECAR_FILE="$(mktemp)"
CONTROLS_AFTER_STOP_FILE="$(mktemp)"
curl --silent --fail -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$SIDECAR_TASK_ID/stop" \
  -H 'content-type: application/json' --data '{}' > "$STOP_SIDECAR_FILE"
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_AFTER_STOP_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$CONTROLS_FILE" "$SIDECAR_TASK" "$START_PROBE_STATUS" "$START_PROBE_FILE" "$APPROVED_SIDECAR" "$APPROVED_START_PROBE_STATUS" "$APPROVED_START_PROBE_FILE" "$CONTROLS_AFTER_PROBE_FILE" "$STOP_SIDECAR_FILE" "$CONTROLS_AFTER_STOP_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const controls = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const sidecarTask = JSON.parse(process.argv[5]);
const startProbeStatus = process.argv[6];
const startProbe = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const approvedSidecar = JSON.parse(process.argv[8]);
const approvedStartProbeStatus = process.argv[9];
const approvedStartProbe = JSON.parse(fs.readFileSync(process.argv[10], "utf8"));
const controlsAfterProbe = JSON.parse(fs.readFileSync(process.argv[11], "utf8"));
const stoppedSidecar = JSON.parse(fs.readFileSync(process.argv[12], "utf8"));
const controlsAfterStop = JSON.parse(fs.readFileSync(process.argv[13], "utf8"));

for (const token of ["Phase 3 Operator Interrupt Controls", "phase3-operator-interrupt-controls-panel", "phase3-controls-takeover", "create-trusted-sidecar-lifecycle-task-button", "start-trusted-sidecar-probe-button", "stop-trusted-sidecar-button", "new-tab-action-button", "Open New Tab"]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of ["/phase-3/operator-interrupt-controls", "refreshPhase3OperatorInterruptControls", "openclaw-phase-3-operator-interrupt-controls-v0", "/control/takeover", "/control/resume", "/work-view/trusted-sidecar/lifecycle-tasks", "/start-probe", "/stop", "/act/browser/new-tab", "newTabActionButton", "createTrustedSidecarLifecycleTask", "startTrustedSidecarLifecycleProbe", "stopTrustedSidecarLifecycle", "sidecarLifecycle", "latestProbe", "workViewRecoveryAction", "trustedSession.helperReadiness", "Action Authority", "actionAuthoritySuspended", "helperRuntime.actionAuthority", "safety.supervisorStatus", "safety.heartbeatCount", "Sidecar Failure", "Sidecar Recovery", "Capture Source", "captureRecoveryRequired", "recoveryRequired", "lastSidecarFailure", "automaticRestart"]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!controls.ok || controls.summary?.ready !== true || controls.summary?.takeoverSupported !== true) {
  throw new Error(`Observer Phase 3 operator controls should be ready: ${JSON.stringify(controls.summary)}`);
}
if (!sidecarTask.ok
  || sidecarTask.task?.type !== "work_view_trusted_sidecar_lifecycle"
  || sidecarTask.approval?.status !== "pending"
  || sidecarTask.governance?.processStartEnabled !== false
  || sidecarTask.governance?.processStartEnabledAfterApproval !== true
  || sidecarTask.governance?.rootRequired !== false) {
  throw new Error(`Observer sidecar lifecycle task should be approval-gated and non-executing: ${JSON.stringify(sidecarTask)}`);
}
if (startProbeStatus !== "409"
  || startProbe.ok !== false
  || startProbe.mode !== "trusted-sidecar-start-probe-blocked"
  || startProbe.readback?.status !== "blocked_before_approval"
  || startProbe.readback?.approvalStatus !== "pending"
  || startProbe.readback?.execution?.processStarted !== false
  || startProbe.readback?.execution?.processStartEnabled !== false
  || startProbe.readback?.execution?.rootRequired !== false
  || startProbe.readback?.execution?.systemDaemonRequired !== false
  || startProbe.readback?.execution?.desktopWideCapture !== false
  || startProbe.readback?.execution?.hostMutation !== false
  || startProbe.readback?.execution?.providerEgress !== false) {
  throw new Error(`Observer sidecar start probe should be blocked before approval without execution: ${startProbeStatus} ${JSON.stringify(startProbe)}`);
}
if (!approvedSidecar.ok || approvedSidecar.approval?.status !== "approved") {
  throw new Error(`Observer sidecar lifecycle approval should be approved: ${JSON.stringify(approvedSidecar)}`);
}
if (approvedStartProbeStatus !== "200"
  || approvedStartProbe.ok !== true
  || approvedStartProbe.mode !== "trusted-sidecar-start-probe-running-after-approval"
  || approvedStartProbe.readback?.status !== "running_after_approval"
  || approvedStartProbe.readback?.approvalStatus !== "approved"
  || approvedStartProbe.readback?.execution?.processStarted !== true
  || approvedStartProbe.readback?.execution?.processStartEnabled !== true
  || !Number.isInteger(approvedStartProbe.readback?.execution?.pid)
  || approvedStartProbe.readback?.execution?.supervisorStatus !== "running"
  || approvedStartProbe.readback?.execution?.heartbeatCount < 1
  || approvedStartProbe.readback?.execution?.sessionManagerOwned !== true
  || approvedStartProbe.readback?.execution?.boundedProcess !== true
  || approvedStartProbe.readback?.execution?.credentialEnvironmentInherited !== false
  || approvedStartProbe.readback?.execution?.networkAccessRequired !== true
  || approvedStartProbe.readback?.execution?.networkScope !== "loopback_browser_runtime_only"
  || approvedStartProbe.readback?.execution?.captureObservation?.registry !== "openclaw-trusted-work-view-sidecar-capture-observation-v0"
  || approvedStartProbe.readback?.execution?.captureObservation?.fullPayloadRetained !== false
  || approvedStartProbe.readback?.execution?.captureFreshness !== "fresh"
  || approvedStartProbe.readback?.execution?.rootRequired !== false
  || approvedStartProbe.readback?.execution?.systemDaemonRequired !== false
  || approvedStartProbe.readback?.execution?.desktopWideCapture !== false
  || approvedStartProbe.readback?.execution?.hostMutation !== false
  || approvedStartProbe.readback?.execution?.providerEgress !== false) {
  throw new Error(`Observer approved sidecar start should run one bounded heartbeat process: ${approvedStartProbeStatus} ${JSON.stringify(approvedStartProbe)}`);
}
if (!approvedStartProbe.task?.workViewTrustedSidecarLifecycle?.execution
  || approvedStartProbe.task.workViewTrustedSidecarLifecycle.execution.status !== "running_after_approval"
  || approvedStartProbe.task.workViewTrustedSidecarLifecycle.execution.execution?.processStarted !== true) {
  throw new Error(`Observer approved sidecar start probe should be recorded on the task: ${JSON.stringify(approvedStartProbe.task?.workViewTrustedSidecarLifecycle)}`);
}
if (controlsAfterProbe.sidecarLifecycle?.taskId !== sidecarTask.task.id
  || controlsAfterProbe.sidecarLifecycle?.approvalStatus !== "approved"
  || controlsAfterProbe.sidecarLifecycle?.latestProbe?.status !== "running_after_approval"
  || controlsAfterProbe.sidecarLifecycle?.safety?.processStarted !== true
  || controlsAfterProbe.sidecarLifecycle?.safety?.boundedProcess !== true
  || controlsAfterProbe.summary?.sidecarStartProbeStatus !== "running_after_approval"
  || controlsAfterProbe.summary?.sidecarProcessStarted !== true
  || controlsAfterProbe.summary?.sidecarSupervisorStatus !== "running") {
  throw new Error(`Observer controls should consolidate sidecar lifecycle readback: ${JSON.stringify(controlsAfterProbe.sidecarLifecycle)}`);
}
if (!stoppedSidecar.ok
  || stoppedSidecar.readback?.status !== "stopped_after_operator_action"
  || stoppedSidecar.readback?.execution?.processStarted !== false
  || stoppedSidecar.readback?.execution?.supervisorStatus !== "stopped"
  || controlsAfterStop.sidecarLifecycle?.latestProbe?.status !== "stopped_after_operator_action"
  || controlsAfterStop.summary?.sidecarProcessStarted !== false
  || controlsAfterStop.summary?.sidecarSupervisorStatus !== "stopped") {
  throw new Error(`Observer should retain explicit sidecar stop readback: ${JSON.stringify({ stoppedSidecar, controls: controlsAfterStop.sidecarLifecycle })}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase3OperatorInterruptControls: {
    status: "passed",
    panel: "Phase 3 Operator Interrupt Controls",
    controls: controls.controls.map((control) => control.id),
    sidecarTask: sidecarTask.task.id,
    approval: sidecarTask.approval.id,
    startProbeBeforeApproval: startProbe.readback.status,
    startProbeAfterApproval: approvedStartProbe.readback.status,
    sidecarPid: approvedStartProbe.readback.execution.pid,
    heartbeatCount: approvedStartProbe.readback.execution.heartbeatCount,
    controlsSidecarProbe: controlsAfterProbe.sidecarLifecycle.latestProbe.status,
    stoppedSidecar: stoppedSidecar.readback.status,
  },
}, null, 2));
EOF
