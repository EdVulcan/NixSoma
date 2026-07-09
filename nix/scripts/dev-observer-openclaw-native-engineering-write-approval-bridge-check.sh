#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-write-approval-bridge-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
NEW_SECRET="OBSERVER_ENGINEERING_WRITE_APPROVAL_BRIDGE_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10340}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10341}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10342}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10343}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10344}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10345}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10346}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10347}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10348}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-write-approval-bridge-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-write-approval-bridge-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "OBSERVER_ENGINEERING_WRITE_APPROVAL_BRIDGE"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${TASK_FILE:-}" \
    "${STEP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks" "{\"relativePath\":\"src/observer-bridge-new.txt\",\"content\":\"$NEW_SECRET\\n\",\"overwrite\":false,\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASK_FILE" "$STEP_FILE" "$WORKSPACE_DIR" "$NEW_SECRET"
const fs = require("node:fs");
const path = require("node:path");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const task = readJson(4);
const step = readJson(5);
const workspaceDir = process.argv[6];
const secret = process.argv[7];
const targetPath = path.join(workspaceDir, "src", "observer-bridge-new.txt");
const raw = JSON.stringify({ task, step });

for (const token of [
  "OpenClaw Engineering Write Proposal",
  "engineering-write-proposal-registry",
  "engineering-write-proposal-mutation",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing write proposal bridge-adjacent token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-write-proposal-tasks",
  "Approval-gated task bridge",
  "workspace_text_write task only with explicit confirmation",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing write approval bridge token: ${token}`);
  }
}
if (fs.existsSync(targetPath)) {
  throw new Error(`Observer write approval bridge must not write ${targetPath}`);
}
if (
  !task.ok
  || task.registry !== "openclaw-native-engineering-write-proposal-task-v0"
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.governance?.createsTask !== true
  || task.governance?.createsApproval !== true
  || task.governance?.canExecuteWithoutApproval !== false
) {
  throw new Error(`Observer write approval bridge response mismatch: ${JSON.stringify(task)}`);
}
if (!step.ok || step.ran !== false || step.blocked !== true || step.reason !== "policy_requires_approval") {
  throw new Error(`Observer operator step should remain blocked before approval: ${JSON.stringify(step)}`);
}
if (raw.includes(secret)) {
  throw new Error("Observer write approval bridge response leaked proposed content secret");
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringWriteApprovalBridge: {
    html: "visible",
    client: "visible",
    registry: task.registry,
    taskId: task.task.id,
    approvalId: task.approval.id,
    targetWritten: fs.existsSync(targetPath),
  },
}, null, 2));
EOF
