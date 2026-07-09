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

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${CONTROLS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

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
sidecar_task="$(post_json "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks" '{"confirm":true}')"

CONTROLS_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/operator-interrupt-controls" > "$CONTROLS_FILE"

node - <<'EOF' "$CONTROLS_FILE" "$takeover" "$sidecar_task"
const fs = require("node:fs");
const controls = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const takeover = JSON.parse(process.argv[3]);
const sidecarTask = JSON.parse(process.argv[4]);

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
  || takeover.task?.workView?.mode !== "operator-takeover") {
  throw new Error(`takeover should pause task and mark operator control: ${JSON.stringify(takeover.task)}`);
}
if (!sidecarTask.ok
  || sidecarTask.registry !== "openclaw-work-view-trusted-sidecar-lifecycle-task-v0"
  || sidecarTask.task?.type !== "work_view_trusted_sidecar_lifecycle"
  || sidecarTask.approval?.status !== "pending"
  || sidecarTask.governance?.processStartEnabled !== false
  || sidecarTask.task?.workViewTrustedSidecarLifecycle?.execution !== null) {
  throw new Error(`sidecar lifecycle task should be approval-gated and non-executing: ${JSON.stringify(sidecarTask)}`);
}

console.log(JSON.stringify({
  openclawPhase3OperatorInterruptControls: {
    status: "passed",
    registry: controls.registry,
    controls: controls.controls.map((control) => control.id),
    takeoverTaskStatus: takeover.task.status,
    sidecarTask: sidecarTask.task.id,
    approval: sidecarTask.approval.id,
  },
}, null, 2));
EOF
