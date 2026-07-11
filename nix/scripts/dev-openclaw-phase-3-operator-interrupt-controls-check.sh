#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6710}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6711}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6712}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6713}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6714}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6715}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6716}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6717}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6718}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-3-operator-interrupt-controls-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-3-operator-interrupt-controls-check.json}"
export OPENCLAW_SESSION_MANAGER_STATE_FILE="${OPENCLAW_SESSION_MANAGER_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-session-manager-phase-3-operator-interrupt-controls-check.json}"
export OPENCLAW_BROWSER_RUNTIME_STATE_FILE="${OPENCLAW_BROWSER_RUNTIME_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-browser-runtime-phase-3-operator-interrupt-controls-check.json}"
export OPENCLAW_TRUSTED_SIDECAR_LAUNCHER_MODE="systemd-user"
export OPENCLAW_TRUSTED_SIDECAR_UNIT_INSTANCE="primary"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
BROWSER_RUNTIME_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
CORE_PID_FILE="$REPO_ROOT/.artifacts/openclaw-core.pid"
CORE_LOG_FILE="$REPO_ROOT/.artifacts/openclaw-core.log"
SESSION_MANAGER_PID_FILE="$REPO_ROOT/.artifacts/openclaw-session-manager.pid"
SESSION_MANAGER_LOG_FILE="$REPO_ROOT/.artifacts/openclaw-session-manager.log"
BROWSER_RUNTIME_PID_FILE="$REPO_ROOT/.artifacts/openclaw-browser-runtime.pid"
BROWSER_RUNTIME_LOG_FILE="$REPO_ROOT/.artifacts/openclaw-browser-runtime.log"
SIDECAR_UNIT_NAME="openclaw-trusted-sidecar@${OPENCLAW_TRUSTED_SIDECAR_UNIT_INSTANCE}.service"
SIDECAR_UNIT_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required for the user-unit milestone}/systemd/user"
SIDECAR_UNIT_FILE="$SIDECAR_UNIT_DIR/openclaw-trusted-sidecar@.service"
SIDECAR_ENV_FILE="$XDG_RUNTIME_DIR/openclaw-sidecars/${OPENCLAW_TRUSTED_SIDECAR_UNIT_INSTANCE}.env"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp" \
  "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$OPENCLAW_SESSION_MANAGER_STATE_FILE.tmp"
rm -f "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"*
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${CONTROLS_FILE:-}" "${START_PROBE_FILE:-}" "${APPROVED_START_PROBE_FILE:-}" "${CONTROLS_AFTER_PROBE_FILE:-}" \
    "${SUSPENDED_STATE_FILE:-}" "${OLD_BROWSER_ACTION_FILE:-}" "${RESUMED_STATE_FILE:-}" "${RESUMED_BROWSER_ACTION_FILE:-}"
  rm -f "${STOP_SIDECAR_FILE:-}" "${CONTROLS_AFTER_STOP_FILE:-}"
  rm -f "${RECOVERY_REQUIRED_STATE_FILE:-}" "${RECOVERY_BROWSER_ACTION_FILE:-}" "${RESTART_SIDECAR_FILE:-}" "${RESTARTED_STATE_FILE:-}"
  rm -f "${CAPTURE_REFRESH_STATE_FILE:-}"
  rm -f "${FRESH_CAPTURE_ACTION_FILE:-}"
  rm -f "${BROWSER_FAILURE_STATE_FILE:-}" "${BROWSER_FAILURE_ACTION_FILE:-}" \
    "${BROWSER_RECOVERED_STATE_FILE:-}" "${BROWSER_RECOVERED_ACTION_FILE:-}" \
    "${BROWSER_BEFORE_RESTART_STATE_FILE:-}" "${BROWSER_RESTORED_STATE_FILE:-}" "${BROWSER_REBOUND_STATE_FILE:-}"
  rm -f "${NEW_TAB_ACTION_FILE:-}" "${NEW_TAB_BROWSER_STATE_FILE:-}" "${NEW_TAB_CAPTURE_STATE_FILE:-}"
  rm -f "${AUTONOMOUS_NEW_TAB_RESULT_FILE:-}"
  rm -f "${AUTHORITY_INTERRUPTED_TASK_FILE:-}" "${AUTHORITY_RECOVERED_TASK_FILE:-}" \
    "${AUTHORITY_RECOVERED_EXECUTION_FILE:-}"
  rm -f "${SIDECAR_FAILURE_STATE_FILE:-}" "${SIDECAR_FAILURE_ACTION_FILE:-}" \
    "${REPLACE_SIDECAR_FILE:-}" "${REPLACED_STATE_FILE:-}" "${REPLACED_ACTION_FILE:-}"
  rm -f "${CORE_RESTART_TASK_FILE:-}" "${CORE_RESTART_PHASE_FILE:-}" \
    "${CORE_RESTART_INTERRUPTED_FILE:-}" "${CORE_RESTART_RECOVERED_FILE:-}" \
    "${CORE_RESTART_EXECUTION_FILE:-}"
  if [[ -n "${RESTARTED_CORE_PID:-}" ]]; then
    kill -TERM "$RESTARTED_CORE_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${RESTARTED_SESSION_MANAGER_PID:-}" ]]; then
    kill -TERM "$RESTARTED_SESSION_MANAGER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${RESTARTED_BROWSER_RUNTIME_PID:-}" ]]; then
    kill -TERM "$RESTARTED_BROWSER_RUNTIME_PID" >/dev/null 2>&1 || true
  fi
  systemctl --user stop "$SIDECAR_UNIT_NAME" >/dev/null 2>&1 || true
  rm -f "$SIDECAR_UNIT_FILE" "$SIDECAR_ENV_FILE"
  systemctl --user daemon-reload >/dev/null 2>&1 || true
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  rm -f "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$OPENCLAW_SESSION_MANAGER_STATE_FILE.tmp"
  rm -f "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"*
}
trap cleanup EXIT

if [[ -e "$SIDECAR_UNIT_FILE" ]]; then
  echo "Refusing to replace an existing runtime trusted-sidecar user unit: $SIDECAR_UNIT_FILE" >&2
  exit 1
fi
mkdir -p "$SIDECAR_UNIT_DIR"
cat > "$SIDECAR_UNIT_FILE" <<EOF
[Unit]
Description=OpenClaw trusted work-view sidecar instance %i (milestone runtime unit)

[Service]
Type=simple
WorkingDirectory=$REPO_ROOT/services/openclaw-session-manager
Environment=NODE_NO_WARNINGS=1
EnvironmentFile=%t/openclaw-sidecars/%i.env
ExecStart=$(command -v node) src/trusted-work-view-sidecar.mjs
Restart=no
KillMode=process
TimeoutStopSec=5s
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=%t/openclaw-sidecars
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
EOF
systemctl --user daemon-reload

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-controls"}' >/dev/null

created_task="$(post_json "$CORE_URL/tasks" '{"goal":"Phase 3 operator takeover demo","type":"browser_task","targetUrl":"https://example.com/phase-3-controls","workViewStrategy":"ai-work-view"}')"
task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_task")"
prepared_state="$(curl --silent --fail "$SESSION_MANAGER_URL/work-view/state")"
attach_body="$(node -e 'const data=JSON.parse(process.argv[1]); const workView=data.workView??{}; process.stdout.write(JSON.stringify({sessionId:data.session?.sessionId??null,status:"ready",visibility:workView.visibility??"hidden",mode:workView.mode??"background",helperStatus:workView.helperStatus??"active",displayTarget:workView.displayTarget??"workspace-2",activeUrl:workView.activeUrl??"https://example.com/phase-3-controls"}));' "$prepared_state")"
post_json "$CORE_URL/tasks/$task_id/attach-work-view" "$attach_body" >/dev/null
takeover="$(post_json "$CORE_URL/control/takeover" '{}')"
SUSPENDED_STATE_FILE="$(mktemp)"
OLD_BROWSER_ACTION_FILE="$(mktemp)"
curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$SUSPENDED_STATE_FILE"
old_browser_action_body="$(node -e 'const data=JSON.parse(process.argv[1]); const r=data.workView?.helperRuntime??{}; const trustedHelperLease={registry:"openclaw-trusted-work-view-helper-lease-v0",owner:r.owner,mode:r.mode,scope:r.scope,leaseId:r.leaseId,sessionId:r.sessionId,workViewId:r.workViewId,heartbeatAt:r.heartbeatAt,actionAuthority:r.actionAuthority}; process.stdout.write(JSON.stringify({text:"must-stay-blocked",trustedHelperLease}));' "$prepared_state")"
old_browser_action_status="$(curl --silent --output "$OLD_BROWSER_ACTION_FILE" --write-out "%{http_code}" \
  -X POST "$BROWSER_RUNTIME_URL/browser/input" \
  -H 'content-type: application/json' \
  --data "$old_browser_action_body")"
CONTROLS_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_FILE"
resume="$(post_json "$CORE_URL/control/resume" '{}')"
RESUMED_STATE_FILE="$(mktemp)"
RESUMED_BROWSER_ACTION_FILE="$(mktemp)"
curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$RESUMED_STATE_FILE"
resumed_browser_action_body="$(node -e 'const data=JSON.parse(process.argv[1]); const r=data.workView?.helperRuntime??{}; const trustedHelperLease={registry:"openclaw-trusted-work-view-helper-lease-v0",owner:r.owner,mode:r.mode,scope:r.scope,leaseId:r.leaseId,sessionId:r.sessionId,workViewId:r.workViewId,heartbeatAt:r.heartbeatAt,actionAuthority:r.actionAuthority}; process.stdout.write(JSON.stringify({text:"allowed-after-explicit-resume",trustedHelperLease}));' "$(cat "$RESUMED_STATE_FILE")")"
curl --silent --fail \
  -X POST "$BROWSER_RUNTIME_URL/browser/input" \
  -H 'content-type: application/json' \
  --data "$resumed_browser_action_body" > "$RESUMED_BROWSER_ACTION_FILE"
sidecar_task="$(post_json "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks" '{"confirm":true}')"
sidecar_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$sidecar_task")"
sidecar_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$sidecar_task")"

START_PROBE_FILE="$(mktemp)"
APPROVED_START_PROBE_FILE="$(mktemp)"
CONTROLS_AFTER_PROBE_FILE="$(mktemp)"
start_probe_status="$(curl --silent --output "$START_PROBE_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$sidecar_task_id/start-probe" \
  -H 'content-type: application/json' \
  --data '{}')"
approved_sidecar="$(post_json "$CORE_URL/approvals/$sidecar_approval_id/approve" '{"approvedBy":"phase-3-operator-controls-check","reason":"approve trusted sidecar lifecycle probe while keeping process start deferred"}')"
approved_start_probe_status="$(curl --silent --output "$APPROVED_START_PROBE_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$sidecar_task_id/start-probe" \
  -H 'content-type: application/json' \
  --data '{}')"
systemctl --user is-active --quiet "$SIDECAR_UNIT_NAME"
test -f "$SIDECAR_ENV_FILE"
if grep -Eq '^OPENCLAW_.*(SESSION|LEASE|CREDENTIAL|PROVIDER|BROWSER_RUNTIME)' "$SIDECAR_ENV_FILE"; then
  echo "trusted sidecar environment file persisted forbidden authority or provider fields" >&2
  exit 1
fi
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_AFTER_PROBE_FILE"
initial_capture_sequence="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String(data.readback.execution.captureObservation.sequence));' "$APPROVED_START_PROBE_FILE")"
FRESH_CAPTURE_ACTION_FILE="$(mktemp)"
curl --silent --fail -X POST "$SCREEN_ACT_URL/act/keyboard/type" \
  -H 'content-type: application/json' --data '{"text":"fresh sidecar capture mediated action"}' > "$FRESH_CAPTURE_ACTION_FILE"
node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const mediation=data.action?.mediation??{}; const grounding=mediation.visualGrounding??{}; if(data.action?.result!=="executed-browser-runtime" || mediation.accepted!==true || mediation.leaseMatched!==true || mediation.transport!=="trusted-sidecar-ipc" || grounding.registry!=="openclaw-trusted-work-view-visual-action-grounding-v0" || grounding.required!==false || grounding.status!=="simulated_not_required" || grounding.imageDataRetained!==false || JSON.stringify(grounding).includes("data:image/")){throw new Error(`fresh capture action was not compactly sidecar mediated: ${JSON.stringify(data)}`);}' "$FRESH_CAPTURE_ACTION_FILE"
CAPTURE_REFRESH_STATE_FILE="$(mktemp)"
for _ in $(seq 1 40); do
  curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$CAPTURE_REFRESH_STATE_FILE"
  if node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.exit((data.workView?.helperRuntime?.sidecar?.captureObservation?.sequence??0)>Number(process.argv[2]) ? 0 : 1);' "$CAPTURE_REFRESH_STATE_FILE" "$initial_capture_sequence"; then
    break
  fi
  sleep 0.1
done
sidecar_pid="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String(data.readback.execution.pid));' "$APPROVED_START_PROBE_FILE")"
node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); if(data.sidecarLifecycleIntent?.taskId!==process.argv[2] || data.sidecarLifecycleIntent?.status!=="running" || data.sidecarLifecycleIntent?.automaticRestart!==false){throw new Error(`missing persisted running intent: ${JSON.stringify(data)}`);}' "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$sidecar_task_id"
CORE_RESTART_NEW_TAB_URL="https://example.com/phase-3-core-restart-recovered-new-tab"
CORE_RESTART_TASK_FILE="$(mktemp)"
post_json "$CORE_URL/tasks" "{\"goal\":\"Continue a persisted browser task after core restart\",\"type\":\"browser_task\",\"targetUrl\":\"https://example.com/phase-3-core-restart-origin\",\"workViewStrategy\":\"ai-work-view\",\"planStrategy\":\"rule-v1\",\"actions\":[{\"kind\":\"browser.new_tab\",\"params\":{\"url\":\"$CORE_RESTART_NEW_TAB_URL\"}}]}" > "$CORE_RESTART_TASK_FILE"
core_restart_task_id="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(data.task.id);' "$CORE_RESTART_TASK_FILE")"
CORE_RESTART_PHASE_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/$core_restart_task_id/phase" '{"phase":"preparing_work_view","status":"running","details":{"source":"core_restart_continuity_milestone"}}' > "$CORE_RESTART_PHASE_FILE"
for _ in $(seq 1 50); do
  if [[ -f "$OPENCLAW_CORE_STATE_FILE" ]] && node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const task=data.tasks?.find((item)=>item.id===process.argv[2]); process.exit(task?.status==="running" ? 0 : 1);' "$OPENCLAW_CORE_STATE_FILE" "$core_restart_task_id"; then
    break
  fi
  sleep 0.1
done
node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const task=data.tasks?.find((item)=>item.id===process.argv[2]); if(task?.status!=="running"){throw new Error(`active task was not persisted before core restart: ${JSON.stringify(task)}`);}' "$OPENCLAW_CORE_STATE_FILE" "$core_restart_task_id"
old_core_pid="$(cat "$CORE_PID_FILE")"
kill -TERM "$old_core_pid"
for _ in $(seq 1 50); do
  if ! kill -0 "$old_core_pid" >/dev/null 2>&1 && ! curl --silent --fail "$CORE_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
if kill -0 "$old_core_pid" >/dev/null 2>&1; then
  echo "openclaw-core did not stop during active-task continuity check" >&2
  exit 1
fi
(
  cd "$REPO_ROOT/services/openclaw-core"
  nohup env OPENCLAW_CORE_HOST=0.0.0.0 node src/server.mjs >> "$CORE_LOG_FILE" 2>&1 &
  echo $! > "$CORE_PID_FILE"
)
RESTARTED_CORE_PID="$(cat "$CORE_PID_FILE")"
for _ in $(seq 1 50); do
  if curl --silent --fail "$CORE_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
curl --silent --fail "$CORE_URL/health" >/dev/null
CORE_RESTART_INTERRUPTED_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/tasks/$core_restart_task_id" > "$CORE_RESTART_INTERRUPTED_FILE"
CORE_RESTART_RECOVERED_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/$core_restart_task_id/recover" '{}' > "$CORE_RESTART_RECOVERED_FILE"
core_restart_recovered_task_id="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(data.task.id);' "$CORE_RESTART_RECOVERED_FILE")"
CORE_RESTART_EXECUTION_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/$core_restart_recovered_task_id/execute" "{\"expectedUrl\":\"$CORE_RESTART_NEW_TAB_URL\",\"hideOnComplete\":false}" > "$CORE_RESTART_EXECUTION_FILE"
node - <<'EOF' "$CORE_RESTART_INTERRUPTED_FILE" "$CORE_RESTART_RECOVERED_FILE" "$CORE_RESTART_EXECUTION_FILE" "$CORE_RESTART_NEW_TAB_URL"
const fs = require("node:fs");
const interrupted = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recovered = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const execution = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const expectedUrl = process.argv[5];
const interruption = interrupted.task?.outcome?.details?.coreRuntimeInterruption ?? {};
const recoveryEvidence = interrupted.task?.outcome?.details?.recoveryEvidence ?? {};
const plannedAction = recovered.task?.plan?.steps?.find((step) => step.phase === "acting_on_target");
const evidence = execution.execution?.actionEvidence;
const action = evidence?.actions?.[0] ?? {};
if (interrupted.task?.status !== "failed"
  || interruption.code !== "core_runtime_interruption"
  || interruption.stage !== "preparing_work_view"
  || interruption.automaticRestart !== false
  || recoveryEvidence.kind !== "core-runtime-recovery-evidence"
  || recoveryEvidence.recommendation?.strategy !== "recover_persisted_task_after_core_restart"
  || recovered.task?.recovery?.recoveredFromTaskId !== interrupted.task?.id
  || plannedAction?.kind !== "browser.new_tab"
  || plannedAction?.status !== "pending"
  || execution.task?.status !== "completed"
  || action.kind !== "browser.new_tab"
  || action.mediation?.accepted !== true
  || action.mediation?.transport !== "trusted-sidecar-ipc"
  || action.mediation?.effect?.url !== expectedUrl
  || evidence?.observedAfterActions?.url !== expectedUrl) {
  throw new Error(`core restart should reconcile and recover only unfinished browser work: ${JSON.stringify({ interrupted, recovered, execution })}`);
}
console.log(JSON.stringify({
  coreRestartContinuity: {
    sourceTaskId: interrupted.task.id,
    recoveredTaskId: recovered.task.id,
    evidence: recoveryEvidence.kind,
    transport: action.mediation.transport,
    effectUrl: action.mediation.effect.url,
  },
}, null, 2));
EOF
old_session_manager_pid="$(cat "$SESSION_MANAGER_PID_FILE")"
kill -TERM "$old_session_manager_pid"
for _ in $(seq 1 50); do
  if ! kill -0 "$old_session_manager_pid" >/dev/null 2>&1 && ! curl --silent --fail "$SESSION_MANAGER_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
if kill -0 "$old_session_manager_pid" >/dev/null 2>&1; then
  echo "session-manager did not stop during restart recovery check" >&2
  exit 1
fi
if ! kill -0 "$sidecar_pid" >/dev/null 2>&1; then
  echo "user-session sidecar did not survive session-manager authority loss" >&2
  exit 1
fi
AUTHORITY_INTERRUPTED_NEW_TAB_URL="https://example.com/phase-3-authority-recovered-new-tab"
AUTHORITY_INTERRUPTED_TASK_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Preserve an active browser task across work-view authority interruption\",\"type\":\"browser_task\",\"targetUrl\":\"https://example.com/phase-3-authority-interrupted-origin\",\"workViewStrategy\":\"ai-work-view\",\"planStrategy\":\"rule-v1\",\"actions\":[{\"kind\":\"browser.new_tab\",\"params\":{\"url\":\"$AUTHORITY_INTERRUPTED_NEW_TAB_URL\"}}]}" > "$AUTHORITY_INTERRUPTED_TASK_FILE"
authority_interrupted_task_id="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(data.task.id);' "$AUTHORITY_INTERRUPTED_TASK_FILE")"
(
  cd "$REPO_ROOT/services/openclaw-session-manager"
  nohup env \
    OPENCLAW_SESSION_MANAGER_HOST=0.0.0.0 \
    OPENCLAW_SESSION_MANAGER_PORT="$OPENCLAW_SESSION_MANAGER_PORT" \
    OPENCLAW_EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT" \
    OPENCLAW_BROWSER_RUNTIME_URL="$BROWSER_RUNTIME_URL" \
    OPENCLAW_SESSION_MANAGER_STATE_FILE="$OPENCLAW_SESSION_MANAGER_STATE_FILE" \
    node src/server.mjs >> "$SESSION_MANAGER_LOG_FILE" 2>&1 &
  echo $! > "$SESSION_MANAGER_PID_FILE"
)
RESTARTED_SESSION_MANAGER_PID="$(cat "$SESSION_MANAGER_PID_FILE")"
for _ in $(seq 1 50); do
  if curl --silent --fail "$SESSION_MANAGER_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
curl --silent --fail "$SESSION_MANAGER_URL/health" >/dev/null
RECOVERY_REQUIRED_STATE_FILE="$(mktemp)"
curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$RECOVERY_REQUIRED_STATE_FILE"
recovery_action_body="$(node -e 'const data=JSON.parse(process.argv[1]); const r=data.workView?.helperRuntime??{}; const trustedHelperLease={registry:"openclaw-trusted-work-view-helper-lease-v0",owner:r.owner,mode:r.mode,scope:r.scope,leaseId:r.leaseId,sessionId:r.sessionId,workViewId:r.workViewId,heartbeatAt:r.heartbeatAt,actionAuthority:"active"}; process.stdout.write(JSON.stringify({text:"blocked-after-session-manager-restart",trustedHelperLease}));' "$(cat "$RESUMED_STATE_FILE")")"
RECOVERY_BROWSER_ACTION_FILE="$(mktemp)"
recovery_action_status="$(curl --silent --output "$RECOVERY_BROWSER_ACTION_FILE" --write-out "%{http_code}" \
  -X POST "$BROWSER_RUNTIME_URL/browser/input" -H 'content-type: application/json' --data "$recovery_action_body")"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-controls-recovered"}' >/dev/null
RESTART_SIDECAR_FILE="$(mktemp)"
RESTARTED_STATE_FILE="$(mktemp)"
curl --silent --fail -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$sidecar_task_id/start-probe" \
  -H 'content-type: application/json' --data '{}' > "$RESTART_SIDECAR_FILE"
curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$RESTARTED_STATE_FILE"
AUTHORITY_RECOVERED_TASK_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/$authority_interrupted_task_id/recover" '{}' > "$AUTHORITY_RECOVERED_TASK_FILE"
authority_recovered_task_id="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(data.task.id);' "$AUTHORITY_RECOVERED_TASK_FILE")"
AUTHORITY_RECOVERED_EXECUTION_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/$authority_recovered_task_id/execute" "{\"expectedUrl\":\"$AUTHORITY_INTERRUPTED_NEW_TAB_URL\",\"hideOnComplete\":false}" > "$AUTHORITY_RECOVERED_EXECUTION_FILE"
reconnected_sidecar_pid="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String(data.workView.helperRuntime.sidecar.pid));' "$RESTARTED_STATE_FILE")"
kill -TERM "$reconnected_sidecar_pid"
for _ in $(seq 1 50); do
  if ! kill -0 "$reconnected_sidecar_pid" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
if kill -0 "$reconnected_sidecar_pid" >/dev/null 2>&1; then
  echo "trusted user-session sidecar did not exit during replacement check" >&2
  exit 1
fi
SIDECAR_FAILURE_STATE_FILE="$(mktemp)"
for _ in $(seq 1 50); do
  curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$SIDECAR_FAILURE_STATE_FILE"
  if node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const r=data.workView?.helperRuntime??{}; process.exit(r.sidecar?.recoveryRequired===true && r.actionAuthority==="suspended" ? 0 : 1);' "$SIDECAR_FAILURE_STATE_FILE"; then
    break
  fi
  sleep 0.1
done
SIDECAR_FAILURE_ACTION_FILE="$(mktemp)"
curl --silent --fail -X POST "$SCREEN_ACT_URL/act/keyboard/type" \
  -H 'content-type: application/json' --data '{"text":"must-block-after-sidecar-process-exit"}' > "$SIDECAR_FAILURE_ACTION_FILE"
REPLACE_SIDECAR_FILE="$(mktemp)"
curl --silent --fail -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$sidecar_task_id/start-probe" \
  -H 'content-type: application/json' --data '{}' > "$REPLACE_SIDECAR_FILE"
REPLACED_STATE_FILE="$(mktemp)"
curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$REPLACED_STATE_FILE"
REPLACED_ACTION_FILE="$(mktemp)"
curl --silent --fail -X POST "$SCREEN_ACT_URL/act/keyboard/type" \
  -H 'content-type: application/json' --data '{"text":"allowed-after-explicit-sidecar-replacement"}' > "$REPLACED_ACTION_FILE"
node - <<'EOF' "$SIDECAR_FAILURE_STATE_FILE" "$SIDECAR_FAILURE_ACTION_FILE" "$REPLACE_SIDECAR_FILE" "$REPLACED_STATE_FILE" "$REPLACED_ACTION_FILE" "$reconnected_sidecar_pid"
const fs = require("node:fs");
const failureState = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const failureAction = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const replacement = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const replacedState = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const replacedAction = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const oldPid = Number(process.argv[7]);
const failedRuntime = failureState.workView?.helperRuntime ?? {};
const replacementExecution = replacement.readback?.execution ?? {};
const replacedRuntime = replacedState.workView?.helperRuntime ?? {};
const blockedMediation = failureAction.action?.mediation ?? {};
const replacedMediation = replacedAction.action?.mediation ?? {};
if (failedRuntime.sidecar?.recoveryRequired !== true
  || failedRuntime.sidecar?.automaticRestart !== false
  || failedRuntime.sidecar?.running !== false
  || failedRuntime.actionAuthority !== "suspended"
  || failureState.workView?.trustedSession?.recoveryRecommendation?.action !== "restart_approved_trusted_sidecar"
  || blockedMediation.accepted !== false
  || replacementExecution.pid === oldPid
  || replacementExecution.userSessionOwned !== true
  || replacementExecution.authorityConnected !== true
  || replacementExecution.reconnected !== false
  || replacedRuntime.sidecar?.pid !== replacementExecution.pid
  || replacedRuntime.actionAuthority !== "active"
  || replacedRuntime.leaseMatched !== true
  || replacedAction.action?.result !== "executed-browser-runtime"
  || replacedMediation.accepted !== true
  || replacedMediation.transport !== "trusted-sidecar-ipc") {
  throw new Error(`sidecar process failure should stay blocked until explicit approved replacement: ${JSON.stringify({ failureState, failureAction, replacement, replacedState, replacedAction })}`);
}
console.log(JSON.stringify({
  sidecarProcessReplacement: {
    failedPid: oldPid,
    replacementPid: replacementExecution.pid,
    automaticRestart: failedRuntime.sidecar.automaticRestart,
    transport: replacedMediation.transport,
  },
}, null, 2));
EOF
restarted_capture_sequence="$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String(data.workView.helperRuntime.sidecar.captureObservation.sequence));' "$REPLACED_STATE_FILE")"
BROWSER_BEFORE_RESTART_STATE_FILE="$(mktemp)"
curl --silent --fail "$BROWSER_RUNTIME_URL/browser/state" > "$BROWSER_BEFORE_RESTART_STATE_FILE"
old_browser_runtime_pid="$(cat "$BROWSER_RUNTIME_PID_FILE")"
kill -TERM "$old_browser_runtime_pid"
for _ in $(seq 1 50); do
  if ! kill -0 "$old_browser_runtime_pid" >/dev/null 2>&1 && ! curl --silent --fail "$BROWSER_RUNTIME_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
if kill -0 "$old_browser_runtime_pid" >/dev/null 2>&1; then
  echo "browser-runtime did not stop during capture recovery check" >&2
  exit 1
fi
(
  cd "$REPO_ROOT/services/openclaw-browser-runtime"
  nohup env \
    OPENCLAW_BROWSER_RUNTIME_HOST=0.0.0.0 \
    OPENCLAW_BROWSER_RUNTIME_PORT="$OPENCLAW_BROWSER_RUNTIME_PORT" \
    OPENCLAW_EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT" \
    OPENCLAW_SESSION_MANAGER_URL="$SESSION_MANAGER_URL" \
    OPENCLAW_BROWSER_RUNTIME_STATE_FILE="$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" \
    node src/server.mjs >> "$BROWSER_RUNTIME_LOG_FILE" 2>&1 &
  echo $! > "$BROWSER_RUNTIME_PID_FILE"
)
RESTARTED_BROWSER_RUNTIME_PID="$(cat "$BROWSER_RUNTIME_PID_FILE")"
for _ in $(seq 1 50); do
  if curl --silent --fail "$BROWSER_RUNTIME_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
curl --silent --fail "$BROWSER_RUNTIME_URL/health" >/dev/null
BROWSER_RESTORED_STATE_FILE="$(mktemp)"
curl --silent --fail "$BROWSER_RUNTIME_URL/browser/state" > "$BROWSER_RESTORED_STATE_FILE"
node - <<'EOF' "$BROWSER_BEFORE_RESTART_STATE_FILE" "$BROWSER_RESTORED_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE"
const fs = require("node:fs");
const before = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).browser ?? {};
const restored = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).browser ?? {};
const persistedText = fs.readFileSync(process.argv[4], "utf8");
const persisted = JSON.parse(persistedText);
const beforeIds = new Set((before.tabs ?? []).map((tab) => tab.id));
if (beforeIds.size < 1
  || restored.running !== false
  || restored.browserPid !== null
  || restored.trustedHelperLease !== null
  || restored.lastInput !== null
  || restored.lastClick !== null
  || restored.workspaceRecovery?.restored !== true
  || restored.workspaceRecovery?.status !== "restored_requires_explicit_prepare"
  || restored.workspaceRecovery?.restoredTabCount !== beforeIds.size
  || restored.workspaceRecovery?.freshAuthorityBound !== false
  || restored.workspaceRecovery?.automaticActionReplay !== false
  || (restored.tabs ?? []).length !== beforeIds.size
  || !restored.tabs.every((tab) => beforeIds.has(tab.id))
  || persisted.safety?.trustedHelperLeasePersisted !== false
  || persisted.safety?.inputPersisted !== false
  || persisted.safety?.clickPersisted !== false
  || persisted.safety?.capturePersisted !== false
  || ["trustedHelperLease", "lastInput", "lastClick", "browserPid", "capture"].some((field) => Object.hasOwn(persisted.workspace ?? {}, field))
  || persistedText.includes("allowed-after-explicit-sidecar-replacement")) {
  throw new Error(`browser workspace should restore bounded intent without action authority: ${JSON.stringify({ before, restored, persisted })}`);
}
console.log(JSON.stringify({
  browserWorkspaceRestore: {
    status: restored.workspaceRecovery.status,
    restoredTabs: restored.tabs.length,
    running: restored.running,
    leaseRestored: restored.trustedHelperLease !== null,
    automaticActionReplay: restored.workspaceRecovery.automaticActionReplay,
  },
}, null, 2));
EOF
BROWSER_FAILURE_STATE_FILE="$(mktemp)"
for _ in $(seq 1 50); do
  curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$BROWSER_FAILURE_STATE_FILE"
  if node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const s=data.workView?.helperRuntime?.sidecar??{}; process.exit(s.captureSourceStatus==="recovery_required" && s.captureFailure==="browser_runtime_not_running" ? 0 : 1);' "$BROWSER_FAILURE_STATE_FILE"; then
    break
  fi
  sleep 0.1
done
BROWSER_FAILURE_ACTION_FILE="$(mktemp)"
curl --silent --fail -X POST "$SCREEN_ACT_URL/act/keyboard/type" \
  -H 'content-type: application/json' --data '{"text":"must-block-during-browser-restart"}' > "$BROWSER_FAILURE_ACTION_FILE"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-browser-recovered","operatorActionSource":"trusted_session_recovery_recommendation","recommendedAction":"prepare_work_view"}' >/dev/null
BROWSER_RECOVERED_STATE_FILE="$(mktemp)"
for _ in $(seq 1 50); do
  curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$BROWSER_RECOVERED_STATE_FILE"
  if node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const s=data.workView?.helperRuntime?.sidecar??{}; process.exit(s.captureSourceStatus==="ready" && s.captureRecoveryRequired===false && s.captureFreshness==="fresh" && (s.captureObservation?.sequence??0)>Number(process.argv[2]) ? 0 : 1);' "$BROWSER_RECOVERED_STATE_FILE" "$restarted_capture_sequence"; then
    break
  fi
  sleep 0.1
done
BROWSER_REBOUND_STATE_FILE="$(mktemp)"
curl --silent --fail "$BROWSER_RUNTIME_URL/browser/state" > "$BROWSER_REBOUND_STATE_FILE"
node - <<'EOF' "$BROWSER_BEFORE_RESTART_STATE_FILE" "$BROWSER_REBOUND_STATE_FILE" "$BROWSER_RECOVERED_STATE_FILE"
const fs = require("node:fs");
const before = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).browser ?? {};
const rebound = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).browser ?? {};
const observed = JSON.parse(fs.readFileSync(process.argv[4], "utf8")).workView?.helperRuntime?.sidecar?.captureObservation ?? {};
const restoredIds = new Set((rebound.tabs ?? []).map((tab) => tab.id));
if (rebound.running !== true
  || rebound.trustedHelperLease?.actionAuthority !== "active"
  || rebound.workspaceRecovery?.status !== "rebound_after_explicit_prepare"
  || rebound.workspaceRecovery?.freshAuthorityBound !== true
  || rebound.workspaceRecovery?.actionAuthorityRestored !== false
  || rebound.workspaceRecovery?.automaticActionReplay !== false
  || !(before.tabs ?? []).every((tab) => restoredIds.has(tab.id))
  || observed.workspaceRecoveryStatus !== "rebound_after_explicit_prepare"
  || observed.restoredTabCount !== before.tabs.length
  || observed.freshAuthorityBound !== true
  || observed.automaticActionReplay !== false) {
  throw new Error(`explicit prepare should rebind restored browser workspace without replay: ${JSON.stringify({ before, rebound, observed })}`);
}
console.log(JSON.stringify({
  browserWorkspaceRebind: {
    status: rebound.workspaceRecovery.status,
    restoredTabs: rebound.workspaceRecovery.restoredTabCount,
    currentTabs: rebound.tabs.length,
    freshAuthorityBound: rebound.workspaceRecovery.freshAuthorityBound,
  },
}, null, 2));
EOF
BROWSER_RECOVERED_ACTION_FILE="$(mktemp)"
curl --silent --fail -X POST "$SCREEN_ACT_URL/act/keyboard/type" \
  -H 'content-type: application/json' --data '{"text":"allowed-after-explicit-browser-prepare"}' > "$BROWSER_RECOVERED_ACTION_FILE"
NEW_TAB_URL="https://example.com/phase-3-sidecar-new-tab"
NEW_TAB_ACTION_FILE="$(mktemp)"
curl --silent --fail -X POST "$SCREEN_ACT_URL/act/browser/new-tab" \
  -H 'content-type: application/json' --data "{\"url\":\"$NEW_TAB_URL\"}" > "$NEW_TAB_ACTION_FILE"
NEW_TAB_BROWSER_STATE_FILE="$(mktemp)"
curl --silent --fail "$BROWSER_RUNTIME_URL/browser/state" > "$NEW_TAB_BROWSER_STATE_FILE"
NEW_TAB_CAPTURE_STATE_FILE="$(mktemp)"
for _ in $(seq 1 50); do
  curl --silent --fail "$SESSION_MANAGER_URL/work-view/state" > "$NEW_TAB_CAPTURE_STATE_FILE"
  if node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); const s=data.workView?.helperRuntime?.sidecar??{}; process.exit(s.captureObservation?.activeUrl===process.argv[2] && (s.captureObservation?.sequence??0)>Number(process.argv[3]) ? 0 : 1);' "$NEW_TAB_CAPTURE_STATE_FILE" "$NEW_TAB_URL" "$(node -e 'const data=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String(data.workView.helperRuntime.sidecar.captureObservation.sequence));' "$BROWSER_RECOVERED_STATE_FILE")"; then
    break
  fi
  sleep 0.1
done
AUTONOMOUS_NEW_TAB_URL="https://example.com/phase-3-autonomous-new-tab"
AUTONOMOUS_NEW_TAB_RESULT_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Open a bounded autonomous browser tab\",\"type\":\"browser_task\",\"targetUrl\":\"https://example.com/phase-3-autonomous-origin\",\"expectedUrl\":\"$AUTONOMOUS_NEW_TAB_URL\",\"workViewStrategy\":\"ai-work-view\",\"planStrategy\":\"rule-v1\",\"actions\":[{\"kind\":\"browser.new_tab\",\"params\":{\"url\":\"$AUTONOMOUS_NEW_TAB_URL\"}}]}" > "$AUTONOMOUS_NEW_TAB_RESULT_FILE"
STOP_SIDECAR_FILE="$(mktemp)"
CONTROLS_AFTER_STOP_FILE="$(mktemp)"
curl --silent --fail \
  -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$sidecar_task_id/stop" \
  -H 'content-type: application/json' \
  --data '{}' > "$STOP_SIDECAR_FILE"
if systemctl --user is-active --quiet "$SIDECAR_UNIT_NAME"; then
  echo "explicit lifecycle stop did not stop $SIDECAR_UNIT_NAME" >&2
  exit 1
fi
if [[ -e "$SIDECAR_ENV_FILE" ]]; then
  echo "explicit lifecycle stop did not remove $SIDECAR_ENV_FILE" >&2
  exit 1
fi
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_AFTER_STOP_FILE"

node - <<'EOF' "$CONTROLS_FILE" "$takeover" "$sidecar_task" "$start_probe_status" "$START_PROBE_FILE" "$approved_sidecar" "$approved_start_probe_status" "$APPROVED_START_PROBE_FILE" "$CONTROLS_AFTER_PROBE_FILE" "$SUSPENDED_STATE_FILE" "$old_browser_action_status" "$OLD_BROWSER_ACTION_FILE" "$resume" "$RESUMED_STATE_FILE" "$RESUMED_BROWSER_ACTION_FILE" "$STOP_SIDECAR_FILE" "$CONTROLS_AFTER_STOP_FILE" "$RECOVERY_REQUIRED_STATE_FILE" "$recovery_action_status" "$RECOVERY_BROWSER_ACTION_FILE" "$RESTART_SIDECAR_FILE" "$RESTARTED_STATE_FILE" "$CAPTURE_REFRESH_STATE_FILE" "$BROWSER_FAILURE_STATE_FILE" "$BROWSER_FAILURE_ACTION_FILE" "$BROWSER_RECOVERED_STATE_FILE" "$BROWSER_RECOVERED_ACTION_FILE" "$NEW_TAB_ACTION_FILE" "$NEW_TAB_BROWSER_STATE_FILE" "$NEW_TAB_CAPTURE_STATE_FILE" "$NEW_TAB_URL" "$AUTONOMOUS_NEW_TAB_RESULT_FILE" "$AUTONOMOUS_NEW_TAB_URL" "$AUTHORITY_INTERRUPTED_TASK_FILE" "$AUTHORITY_RECOVERED_TASK_FILE" "$AUTHORITY_RECOVERED_EXECUTION_FILE" "$AUTHORITY_INTERRUPTED_NEW_TAB_URL" "$REPLACED_STATE_FILE"
const fs = require("node:fs");
const controls = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const takeover = JSON.parse(process.argv[3]);
const sidecarTask = JSON.parse(process.argv[4]);
const startProbeStatus = process.argv[5];
const startProbe = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const approvedSidecar = JSON.parse(process.argv[7]);
const approvedStartProbeStatus = process.argv[8];
const approvedStartProbe = JSON.parse(fs.readFileSync(process.argv[9], "utf8"));
const controlsAfterProbe = JSON.parse(fs.readFileSync(process.argv[10], "utf8"));
const suspendedState = JSON.parse(fs.readFileSync(process.argv[11], "utf8"));
const oldBrowserActionStatus = process.argv[12];
const oldBrowserAction = JSON.parse(fs.readFileSync(process.argv[13], "utf8"));
const resume = JSON.parse(process.argv[14]);
const resumedState = JSON.parse(fs.readFileSync(process.argv[15], "utf8"));
const resumedBrowserAction = JSON.parse(fs.readFileSync(process.argv[16], "utf8"));
const stoppedSidecar = JSON.parse(fs.readFileSync(process.argv[17], "utf8"));
const controlsAfterStop = JSON.parse(fs.readFileSync(process.argv[18], "utf8"));
const recoveryState = JSON.parse(fs.readFileSync(process.argv[19], "utf8"));
const recoveryActionStatus = process.argv[20];
const recoveryAction = JSON.parse(fs.readFileSync(process.argv[21], "utf8"));
const restartedSidecar = JSON.parse(fs.readFileSync(process.argv[22], "utf8"));
const restartedState = JSON.parse(fs.readFileSync(process.argv[23], "utf8"));
const captureRefreshState = JSON.parse(fs.readFileSync(process.argv[24], "utf8"));
const browserFailureState = JSON.parse(fs.readFileSync(process.argv[25], "utf8"));
const browserFailureAction = JSON.parse(fs.readFileSync(process.argv[26], "utf8"));
const browserRecoveredState = JSON.parse(fs.readFileSync(process.argv[27], "utf8"));
const browserRecoveredAction = JSON.parse(fs.readFileSync(process.argv[28], "utf8"));
const newTabAction = JSON.parse(fs.readFileSync(process.argv[29], "utf8"));
const newTabBrowserState = JSON.parse(fs.readFileSync(process.argv[30], "utf8"));
const newTabCaptureState = JSON.parse(fs.readFileSync(process.argv[31], "utf8"));
const newTabUrl = process.argv[32];
const autonomousNewTabResult = JSON.parse(fs.readFileSync(process.argv[33], "utf8"));
const autonomousNewTabUrl = process.argv[34];
const authorityInterruptedTask = JSON.parse(fs.readFileSync(process.argv[35], "utf8"));
const authorityRecoveredTask = JSON.parse(fs.readFileSync(process.argv[36], "utf8"));
const authorityRecoveredExecution = JSON.parse(fs.readFileSync(process.argv[37], "utf8"));
const authorityInterruptedNewTabUrl = process.argv[38];
const replacedState = JSON.parse(fs.readFileSync(process.argv[39], "utf8"));

if (!controls.ok
  || controls.registry !== "openclaw-phase-3-operator-interrupt-controls-v0"
  || controls.status !== "operator_interrupt_controls_ready"
  || controls.summary?.ready !== true
  || controls.summary?.takeoverSupported !== true
  || controls.summary?.hiddenAutomation !== false) {
  throw new Error(`operator interrupt controls should be ready: ${JSON.stringify(controls.summary)}`);
}
for (const id of ["pause", "resume", "stop", "takeover"]) {
  if (!controls.controls?.some((control) => control.id === id && control.available === true)) {
    throw new Error(`missing operator control ${id}: ${JSON.stringify(controls.controls)}`);
  }
}
if (!takeover.ok
  || takeover.task?.status !== "paused"
  || takeover.task?.operatorTakeover?.status !== "operator_controlled"
  || takeover.task?.workView?.mode !== "operator-takeover"
  || takeover.workViewAuthority?.workView?.helperRuntime?.status !== "suspended"
  || takeover.workViewAuthority?.workView?.helperRuntime?.actionAuthority !== "suspended") {
  throw new Error(`takeover should pause task and mark operator control: ${JSON.stringify(takeover.task)}`);
}
const suspendedRuntime = suspendedState.workView?.helperRuntime ?? {};
if (suspendedRuntime.status !== "suspended"
  || suspendedRuntime.actionAuthority !== "suspended"
  || suspendedRuntime.leaseMatched !== true
  || controls.helperRuntime?.status !== "suspended"
  || controls.summary?.actionAuthoritySuspended !== true
  || controls.summary?.actionAuthority !== "suspended") {
  throw new Error(`takeover should suspend trusted helper action authority visibly: ${JSON.stringify({ suspendedRuntime, controls: controls.summary })}`);
}
if (oldBrowserActionStatus !== "409"
  || oldBrowserAction.ok !== false
  || oldBrowserAction.mediation?.accepted !== false
  || oldBrowserAction.mediation?.reason !== "trusted_helper_action_authority_suspended") {
  throw new Error(`browser should reject the pre-takeover lease while authority is suspended: ${oldBrowserActionStatus} ${JSON.stringify(oldBrowserAction)}`);
}
const resumedRuntime = resumedState.workView?.helperRuntime ?? {};
if (!resume.ok
  || resume.task?.status !== "queued"
  || resume.task?.operatorTakeover?.status !== "resumed"
  || resume.workViewAuthority?.authority?.rebound !== true
  || resumedRuntime.status !== "active"
  || resumedRuntime.actionAuthority !== "active"
  || resumedRuntime.leaseMatched !== true
  || resumedRuntime.leaseId === suspendedRuntime.leaseId
  || resumedBrowserAction.ok !== true
  || resumedBrowserAction.mediation?.accepted !== true
  || resumedBrowserAction.mediation?.leaseMatched !== true) {
  throw new Error(`explicit resume should rebind a fresh lease before browser actions continue: ${JSON.stringify({ resume, resumedRuntime, resumedBrowserAction })}`);
}
if (!sidecarTask.ok
  || sidecarTask.registry !== "openclaw-work-view-trusted-sidecar-lifecycle-task-v0"
  || sidecarTask.task?.type !== "work_view_trusted_sidecar_lifecycle"
  || sidecarTask.approval?.status !== "pending"
  || sidecarTask.governance?.processStartEnabled !== false
  || sidecarTask.governance?.processStartEnabledAfterApproval !== true
  || sidecarTask.task?.workViewTrustedSidecarLifecycle?.execution !== null) {
  throw new Error(`sidecar lifecycle task should be approval-gated and non-executing: ${JSON.stringify(sidecarTask)}`);
}
if (startProbeStatus !== "409"
  || startProbe.ok !== false
  || startProbe.mode !== "trusted-sidecar-start-probe-blocked"
  || startProbe.readback?.status !== "blocked_before_approval"
  || startProbe.readback?.approvalStatus !== "pending"
  || startProbe.readback?.reason !== "approval_required_before_sidecar_start_probe"
  || startProbe.readback?.execution?.processStarted !== false
  || startProbe.readback?.execution?.processStartEnabled !== false
  || startProbe.readback?.execution?.rootRequired !== false
  || startProbe.readback?.execution?.systemDaemonRequired !== false
  || startProbe.readback?.execution?.desktopWideCapture !== false
  || startProbe.readback?.execution?.hostMutation !== false
  || startProbe.readback?.execution?.providerEgress !== false) {
  throw new Error(`sidecar start probe should be blocked before approval without execution: ${startProbeStatus} ${JSON.stringify(startProbe)}`);
}
if (!approvedSidecar.ok || approvedSidecar.approval?.status !== "approved") {
  throw new Error(`sidecar lifecycle approval should be approved: ${JSON.stringify(approvedSidecar)}`);
}
if (approvedStartProbeStatus !== "200"
  || approvedStartProbe.ok !== true
  || approvedStartProbe.mode !== "trusted-sidecar-start-probe-running-after-approval"
  || approvedStartProbe.readback?.status !== "running_after_approval"
  || approvedStartProbe.readback?.approvalStatus !== "approved"
  || approvedStartProbe.readback?.reason !== "bounded_user_space_sidecar_heartbeat_running"
  || approvedStartProbe.readback?.execution?.processStarted !== true
  || approvedStartProbe.readback?.execution?.processStartEnabled !== true
  || !Number.isInteger(approvedStartProbe.readback?.execution?.pid)
  || approvedStartProbe.readback?.execution?.supervisorStatus !== "running"
  || approvedStartProbe.readback?.execution?.heartbeatCount < 1
  || approvedStartProbe.readback?.execution?.launcherMode !== "systemd-user"
  || approvedStartProbe.readback?.execution?.unitInstance !== "primary"
  || approvedStartProbe.readback?.execution?.unitName !== "openclaw-trusted-sidecar@primary.service"
  || approvedStartProbe.readback?.execution?.userManagerOwned !== true
  || approvedStartProbe.readback?.execution?.directSpawnFallback !== false
  || approvedStartProbe.readback?.execution?.persistentAuthorityValues !== false
  || approvedStartProbe.readback?.execution?.sessionManagerOwned !== false
  || approvedStartProbe.readback?.execution?.userSessionOwned !== true
  || approvedStartProbe.readback?.execution?.authorityConnected !== true
  || approvedStartProbe.readback?.execution?.reconnectable !== true
  || approvedStartProbe.readback?.execution?.boundedProcess !== true
  || approvedStartProbe.readback?.execution?.credentialEnvironmentInherited !== false
  || approvedStartProbe.readback?.execution?.networkAccessRequired !== true
  || approvedStartProbe.readback?.execution?.networkScope !== "loopback_browser_runtime_only"
  || approvedStartProbe.readback?.execution?.filesystemAccessRequired !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.registry !== "openclaw-trusted-work-view-sidecar-capture-observation-v0"
  || approvedStartProbe.readback?.execution?.captureObservation?.sessionId !== resumedRuntime.sessionId
  || approvedStartProbe.readback?.execution?.captureObservation?.activeUrl !== "https://example.com/phase-3-controls"
  || approvedStartProbe.readback?.execution?.captureObservation?.visualFrame?.available !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.visualFrame?.reason !== "simulated_engine"
  || approvedStartProbe.readback?.execution?.captureObservation?.visualFrame?.dataExposed !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.visualGroundingReady !== true
  || approvedStartProbe.readback?.execution?.captureObservation?.semanticTargets?.available !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.semanticTargets?.itemCount !== 0
  || approvedStartProbe.readback?.execution?.captureObservation?.semanticTargets?.itemsRetained !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.semanticTargets?.inputValuesExposed !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.semanticTargets?.selectorsExposed !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.fullPayloadRetained !== false
  || approvedStartProbe.readback?.execution?.captureObservation?.desktopWideCapture !== false
  || approvedStartProbe.readback?.execution?.captureFreshness !== "fresh"
  || approvedStartProbe.readback?.execution?.rootRequired !== false
  || approvedStartProbe.readback?.execution?.systemDaemonRequired !== false
  || approvedStartProbe.readback?.execution?.desktopWideCapture !== false
  || approvedStartProbe.readback?.execution?.hostMutation !== false
  || approvedStartProbe.readback?.execution?.providerEgress !== false) {
  throw new Error(`approved sidecar start probe should run one bounded heartbeat process: ${approvedStartProbeStatus} ${JSON.stringify(approvedStartProbe)}`);
}
const refreshedCapture = captureRefreshState.workView?.helperRuntime?.sidecar ?? {};
if (refreshedCapture.captureFreshness !== "fresh"
  || refreshedCapture.captureObservation?.sequence <= approvedStartProbe.readback.execution.captureObservation.sequence
  || refreshedCapture.captureObservation?.fullPayloadRetained !== false) {
  throw new Error(`sidecar should refresh bounded capture without retaining full payload: ${JSON.stringify(refreshedCapture)}`);
}
if (!approvedStartProbe.task?.workViewTrustedSidecarLifecycle?.execution
  || approvedStartProbe.task.workViewTrustedSidecarLifecycle.execution.status !== "running_after_approval"
  || approvedStartProbe.task.workViewTrustedSidecarLifecycle.execution.execution?.processStarted !== true) {
  throw new Error(`approved sidecar start probe should be recorded on the task: ${JSON.stringify(approvedStartProbe.task?.workViewTrustedSidecarLifecycle)}`);
}
if (controlsAfterProbe.sidecarLifecycle?.taskId !== sidecarTask.task.id
  || controlsAfterProbe.sidecarLifecycle?.approvalStatus !== "approved"
  || controlsAfterProbe.sidecarLifecycle?.latestProbe?.status !== "running_after_approval"
  || controlsAfterProbe.sidecarLifecycle?.safety?.processStarted !== true
  || controlsAfterProbe.sidecarLifecycle?.safety?.boundedProcess !== true
  || controlsAfterProbe.sidecarLifecycle?.safety?.launcherMode !== "systemd-user"
  || controlsAfterProbe.sidecarLifecycle?.safety?.unitInstance !== "primary"
  || controlsAfterProbe.summary?.sidecarLauncherMode !== "systemd-user"
  || controlsAfterProbe.summary?.sidecarUnitInstance !== "primary"
  || controlsAfterProbe.summary?.sidecarStartProbeStatus !== "running_after_approval"
  || controlsAfterProbe.summary?.sidecarProcessStarted !== true
  || controlsAfterProbe.summary?.sidecarSupervisorStatus !== "running") {
  throw new Error(`operator controls should consolidate sidecar lifecycle readback: ${JSON.stringify(controlsAfterProbe.sidecarLifecycle)}`);
}
const recoveryRuntime = recoveryState.workView?.helperRuntime ?? {};
const authorityInterruption = authorityInterruptedTask.task?.outcome?.details?.authorityInterruption ?? {};
const authorityRecoveryEvidence = authorityInterruptedTask.task?.outcome?.details?.recoveryEvidence ?? {};
if (authorityInterruptedTask.task?.status !== "failed"
  || authorityInterruption.stage !== "prepare"
  || authorityInterruption.recoverable !== true
  || authorityInterruption.automaticRestart !== false
  || authorityRecoveryEvidence.kind !== "work-view-authority-recovery-evidence"
  || authorityRecoveryEvidence.recommendation?.strategy !== "restore_trusted_work_view_then_recover_task"
  || authorityRecoveryEvidence.recommendation?.automaticRestart !== false) {
  throw new Error(`active browser task should persist recoverable authority interruption evidence: ${JSON.stringify(authorityInterruptedTask)}`);
}
if (recoveryRuntime.sidecar?.status !== "recovery_required"
  || recoveryRuntime.sidecar?.taskId !== sidecarTask.task.id
  || recoveryRuntime.sidecar?.approvalId !== sidecarTask.approval.id
  || recoveryRuntime.sidecar?.recoveryRequired !== true
  || recoveryRuntime.sidecar?.automaticRestart !== false
  || recoveryRuntime.sidecar?.running !== false
  || recoveryRuntime.sidecar?.pid !== null
  || recoveryActionStatus !== "409"
  || recoveryAction.mediation?.reason !== "trusted_helper_action_authority_suspended") {
  throw new Error(`session-manager restart should require explicit recovery and revoke the old browser lease: ${JSON.stringify({ recoveryRuntime, recoveryActionStatus, recoveryAction })}`);
}
const restartedRuntime = restartedState.workView?.helperRuntime ?? {};
const replacementRuntime = replacedState.workView?.helperRuntime ?? {};
if (!restartedSidecar.ok
  || restartedSidecar.readback?.status !== "running_after_approval"
  || restartedSidecar.readback?.execution?.pid !== approvedStartProbe.readback.execution.pid
  || restartedSidecar.readback?.execution?.userSessionOwned !== true
  || restartedSidecar.readback?.execution?.authorityConnected !== true
  || restartedSidecar.readback?.execution?.reconnected !== true
  || restartedRuntime.sidecar?.status !== "running"
  || restartedRuntime.sidecar?.pid !== approvedStartProbe.readback.execution.pid
  || restartedRuntime.actionAuthority !== "active"
  || restartedRuntime.leaseMatched !== true
  || restartedRuntime.leaseId === resumedRuntime.leaseId) {
  throw new Error(`explicit approved recovery should reconnect the surviving user-session process under a new session lease: ${JSON.stringify({ restartedSidecar, restartedRuntime, resumedRuntime })}`);
}
const recoveredPlanStep = authorityRecoveredTask.task?.plan?.steps?.find((step) => step.phase === "acting_on_target");
const recoveredExecutionPlanStep = authorityRecoveredExecution.task?.plan?.steps?.find((step) => step.phase === "acting_on_target");
const recoveredActionEvidence = authorityRecoveredExecution.execution?.actionEvidence;
const recoveredAction = recoveredActionEvidence?.actions?.[0] ?? {};
if (authorityRecoveredTask.task?.status !== "queued"
  || recoveredPlanStep?.kind !== "browser.new_tab"
  || recoveredPlanStep?.params?.url !== authorityInterruptedNewTabUrl
  || recoveredPlanStep?.status !== "pending"
  || authorityRecoveredTask.task?.recovery?.recoveredFromTaskId !== authorityInterruptedTask.task?.id
  || authorityRecoveredTask.recoveredFromTask?.recoveredByTaskId !== authorityRecoveredTask.task?.id
  || authorityRecoveredExecution.task?.status !== "completed"
  || recoveredExecutionPlanStep?.kind !== "browser.new_tab"
  || recoveredExecutionPlanStep?.status !== "completed"
  || authorityRecoveredExecution.task?.recovery?.recoveredFromTaskId !== authorityInterruptedTask.task?.id
  || recoveredActionEvidence?.kind !== "eye-hand-action-evidence"
  || recoveredAction.kind !== "browser.new_tab"
  || recoveredAction.mediation?.accepted !== true
  || recoveredAction.mediation?.transport !== "trusted-sidecar-ipc"
  || recoveredAction.mediation?.effect?.url !== authorityInterruptedNewTabUrl
  || recoveredActionEvidence.observedAfterActions?.url !== authorityInterruptedNewTabUrl) {
  throw new Error(`explicit authority restoration should recover and execute the preserved browser plan: ${JSON.stringify({ authorityRecoveredTask, authorityRecoveredExecution })}`);
}
const browserFailureSidecar = browserFailureState.workView?.helperRuntime?.sidecar ?? {};
const blockedBrowserRecoveryMediation = browserFailureAction.action?.mediation ?? {};
if (browserFailureSidecar.status !== "running"
  || browserFailureSidecar.captureSourceStatus !== "recovery_required"
  || browserFailureSidecar.captureRecoveryRequired !== true
  || browserFailureSidecar.captureFailure !== "browser_runtime_not_running"
  || browserFailureSidecar.running !== true
  || browserFailureState.workView?.trustedSession?.recoveryRecommendation?.action !== "prepare_work_view"
  || browserFailureState.workView?.trustedSession?.recoveryRecommendation?.reason !== "trusted_sidecar_capture_source_unavailable"
  || blockedBrowserRecoveryMediation.accepted !== false
  || blockedBrowserRecoveryMediation.attempted !== false
  || blockedBrowserRecoveryMediation.reason !== "trusted_sidecar_capture_source_unavailable") {
  throw new Error(`browser-runtime restart should fail closed at the sidecar capture gate: ${JSON.stringify({ browserFailureSidecar, browserFailureAction })}`);
}
const browserRecoveredSidecar = browserRecoveredState.workView?.helperRuntime?.sidecar ?? {};
const recoveredBrowserMediation = browserRecoveredAction.action?.mediation ?? {};
if (browserRecoveredSidecar.status !== "running"
  || browserRecoveredSidecar.captureSourceStatus !== "ready"
  || browserRecoveredSidecar.captureRecoveryRequired !== false
  || browserRecoveredSidecar.captureFailure !== null
  || browserRecoveredSidecar.captureFreshness !== "fresh"
  || browserRecoveredSidecar.captureObservation?.sequence <= replacementRuntime.sidecar.captureObservation.sequence
  || browserRecoveredSidecar.pid !== replacementRuntime.sidecar.pid
  || browserRecoveredState.workView?.lastOperatorAction?.source !== "trusted_session_recovery_recommendation"
  || browserRecoveredState.workView?.lastOperatorAction?.recommendedAction !== "prepare_work_view"
  || browserRecoveredAction.action?.result !== "executed-browser-runtime"
  || recoveredBrowserMediation.accepted !== true
  || recoveredBrowserMediation.transport !== "trusted-sidecar-ipc") {
  throw new Error(`explicit work-view prepare should recover capture and actions without restarting the sidecar: ${JSON.stringify({ browserRecoveredSidecar, browserRecoveredAction })}`);
}
const newTabMediation = newTabAction.action?.mediation ?? {};
const newTabCapture = newTabCaptureState.workView?.helperRuntime?.sidecar?.captureObservation ?? {};
if (newTabAction.action?.kind !== "browser.new_tab"
  || newTabAction.action?.result !== "executed-browser-runtime"
  || newTabMediation.accepted !== true
  || newTabMediation.leaseMatched !== true
  || newTabMediation.transport !== "trusted-sidecar-ipc"
  || newTabMediation.visualGrounding?.status !== "simulated_not_required"
  || newTabMediation.visualGrounding?.imageDataRetained !== false
  || newTabMediation.effect?.url !== newTabUrl
  || newTabMediation.effect?.tabCount !== newTabBrowserState.browser?.tabs?.length
  || newTabBrowserState.browser?.activeUrl !== newTabUrl
  || newTabBrowserState.browser?.tabs?.length < 2
  || !newTabBrowserState.browser.tabs.some((tab) => tab.url === newTabUrl)
  || newTabCapture.activeUrl !== newTabUrl
  || newTabCapture.tabCount !== newTabBrowserState.browser.tabs.length
  || newTabCapture.sequence <= browserRecoveredSidecar.captureObservation.sequence
  || JSON.stringify(newTabMediation.visualGrounding).includes("data:image/")) {
  throw new Error(`bounded new-tab action should mutate only the trusted AI browser and refresh capture: ${JSON.stringify({ newTabAction, browser: newTabBrowserState.browser, newTabCapture })}`);
}
const autonomousPlanStep = autonomousNewTabResult.task?.plan?.steps?.find((step) => step.kind === "browser.new_tab");
const autonomousEvidence = autonomousNewTabResult.execution?.actionEvidence;
const autonomousAction = autonomousEvidence?.actions?.[0] ?? {};
if (autonomousNewTabResult.task?.status !== "completed"
  || autonomousPlanStep?.capabilityId !== "act.browser.open"
  || autonomousEvidence?.kind !== "eye-hand-action-evidence"
  || autonomousEvidence?.actionCount !== 1
  || autonomousEvidence?.degradedCount !== 0
  || autonomousAction.kind !== "browser.new_tab"
  || autonomousAction.mediation?.accepted !== true
  || autonomousAction.mediation?.transport !== "trusted-sidecar-ipc"
  || autonomousAction.mediation?.effect?.url !== autonomousNewTabUrl
  || autonomousEvidence.observedAfterActions?.url !== autonomousNewTabUrl) {
  throw new Error(`autonomous browser task should plan, execute, and observe bounded new-tab evidence: ${JSON.stringify(autonomousNewTabResult)}`);
}
if (!stoppedSidecar.ok
  || stoppedSidecar.mode !== "trusted-sidecar-stopped-after-operator-action"
  || stoppedSidecar.readback?.status !== "stopped_after_operator_action"
  || stoppedSidecar.readback?.execution?.processStarted !== false
  || stoppedSidecar.readback?.execution?.supervisorStatus !== "stopped"
  || controlsAfterStop.sidecarLifecycle?.latestProbe?.status !== "stopped_after_operator_action"
  || controlsAfterStop.sidecarLifecycle?.safety?.processStarted !== false
  || controlsAfterStop.summary?.sidecarProcessStarted !== false
  || controlsAfterStop.summary?.sidecarSupervisorStatus !== "stopped") {
  throw new Error(`explicit sidecar stop should terminate the bounded process and remain visible: ${JSON.stringify({ stoppedSidecar, controls: controlsAfterStop.sidecarLifecycle })}`);
}

console.log(JSON.stringify({
  openclawPhase3OperatorInterruptControls: {
    status: "passed",
    registry: controls.registry,
    controls: controls.controls.map((control) => control.id),
    takeoverTaskStatus: takeover.task.status,
    suspendedLease: suspendedRuntime.leaseId,
    oldLeaseActionStatus: oldBrowserActionStatus,
    resumedLease: resumedRuntime.leaseId,
    resumedActionAccepted: resumedBrowserAction.mediation.accepted,
    sidecarTask: sidecarTask.task.id,
    approval: sidecarTask.approval.id,
    startProbeBeforeApproval: startProbe.readback.status,
    startProbeAfterApproval: approvedStartProbe.readback.status,
    sidecarPid: approvedStartProbe.readback.execution.pid,
    heartbeatCount: approvedStartProbe.readback.execution.heartbeatCount,
    launcherMode: approvedStartProbe.readback.execution.launcherMode,
    unitInstance: approvedStartProbe.readback.execution.unitInstance,
    captureRefreshSequence: refreshedCapture.captureObservation.sequence,
    controlsSidecarProbe: controlsAfterProbe.sidecarLifecycle.latestProbe.status,
    restartRecoveryStatus: recoveryRuntime.sidecar.status,
    staleLeaseActionStatus: recoveryActionStatus,
    restartPid: restartedSidecar.readback.execution.pid,
    replacementPid: replacementRuntime.sidecar.pid,
    browserCaptureFailure: browserFailureSidecar.captureFailure,
    browserRecoveredSequence: browserRecoveredSidecar.captureObservation.sequence,
    browserRecoveryTransport: recoveredBrowserMediation.transport,
    newTabUrl,
    newTabCount: newTabMediation.effect.tabCount,
    newTabCaptureSequence: newTabCapture.sequence,
    autonomousNewTabTask: autonomousNewTabResult.task.id,
    autonomousNewTabCapability: autonomousPlanStep.capabilityId,
    authorityInterruptedTask: authorityInterruptedTask.task.id,
    authorityRecoveryEvidence: authorityRecoveryEvidence.kind,
    authorityRecoveredTask: authorityRecoveredTask.task.id,
    authorityRecoveredTransport: recoveredAction.mediation.transport,
    stoppedSidecar: stoppedSidecar.readback.status,
  },
}, null, 2));
EOF
