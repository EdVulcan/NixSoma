#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5900}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5901}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5902}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5903}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5904}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5905}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5906}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5907}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5970}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-execution-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-execution-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
draft="$(curl --silent --fail "$CORE_URL/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service")"
created="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true}')"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$draft" "$created"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const draft = JSON.parse(process.argv[4]);
const created = JSON.parse(process.argv[5]);

const requiredHtml = [
  "Systemd Repair Execution Task",
  "systemd-repair-execution-task-panel",
  "systemd-repair-execution-task-registry",
  "systemd-repair-execution-task-target",
  "systemd-repair-execution-task-approval",
  "systemd-repair-execution-task-executed",
  "create-systemd-repair-execution-task-button",
  "systemd-repair-execution-task-json",
];
const requiredClient = [
  "/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service",
  "/system/systemd/repair-execution-tasks",
  "refreshSystemdRepairExecutionTaskDraft",
  "createSystemdRepairExecutionTask",
  "systemdRepairExecutionTaskRegistry",
  "systemdRepairExecutionTaskApproval",
  "systemdRepairExecutionTaskExecuted",
  "openclaw-systemd-repair-execution-task-v0",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!draft.ok || draft.registry !== "openclaw-systemd-repair-execution-task-v0") {
  throw new Error(`Observer execution task draft source should expose registry: ${JSON.stringify(draft)}`);
}
if (!created.ok || created.approval?.status !== "pending" || created.task?.systemdRepair?.execution?.executed !== false) {
  throw new Error(`Observer execution task source should expose pending approval without execution: ${JSON.stringify(created)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairExecutionTask: {
    status: "passed",
    panel: "Systemd Repair Execution Task",
    registry: created.registry,
    taskId: created.task?.id,
    approvalId: created.approval?.id,
    executed: created.task?.systemdRepair?.execution?.executed,
  },
}, null, 2));
EOF
