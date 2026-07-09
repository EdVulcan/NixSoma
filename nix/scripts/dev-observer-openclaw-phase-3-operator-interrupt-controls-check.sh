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

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${CONTROLS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
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

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$CONTROLS_FILE" "$SIDECAR_TASK"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const controls = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const sidecarTask = JSON.parse(process.argv[5]);

for (const token of ["Phase 3 Operator Interrupt Controls", "phase3-operator-interrupt-controls-panel", "phase3-controls-takeover", "create-trusted-sidecar-lifecycle-task-button"]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of ["/phase-3/operator-interrupt-controls", "refreshPhase3OperatorInterruptControls", "openclaw-phase-3-operator-interrupt-controls-v0", "/control/takeover", "/work-view/trusted-sidecar/lifecycle-tasks", "createTrustedSidecarLifecycleTask", "workViewRecoveryAction", "trustedSession.helperReadiness"]) {
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
  || sidecarTask.governance?.rootRequired !== false) {
  throw new Error(`Observer sidecar lifecycle task should be approval-gated and non-executing: ${JSON.stringify(sidecarTask)}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase3OperatorInterruptControls: {
    status: "passed",
    panel: "Phase 3 Operator Interrupt Controls",
    controls: controls.controls.map((control) => control.id),
    sidecarTask: sidecarTask.task.id,
    approval: sidecarTask.approval.id,
  },
}, null, 2));
EOF
