#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-write-approval-bridge-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
NEW_SECRET="ENGINEERING_WRITE_APPROVAL_BRIDGE_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10320}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10321}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10322}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10323}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10324}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10325}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10326}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10327}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10328}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-write-approval-bridge-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-write-approval-bridge-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "ENGINEERING_WRITE_APPROVAL_BRIDGE"
cat > "$WORKSPACE_DIR/src/existing-bridge.txt" <<'TXT'
existing bridge target
TXT
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${NO_CONFIRM_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${TASK_FILE:-}" \
    "${STEP_FILE:-}" \
    "${SUMMARY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

NO_CONFIRM_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"

NO_CONFIRM_STATUS="$(curl --silent --output "$NO_CONFIRM_FILE" --write-out "%{http_code}" \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"src/bridge-new.txt\",\"content\":\"$NEW_SECRET\\n\",\"overwrite\":false,\"confirm\":false}" \
  "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks")"
BLOCKED_STATUS="$(curl --silent --output "$BLOCKED_FILE" --write-out "%{http_code}" \
  -H "content-type: application/json" \
  -d "{\"relativePath\":\"src/existing-bridge.txt\",\"content\":\"$NEW_SECRET\\n\",\"overwrite\":false,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks")"
post_json "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks" "{\"relativePath\":\"src/bridge-new.txt\",\"content\":\"$NEW_SECRET\\n\",\"overwrite\":false,\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$SUMMARY_FILE"

node - <<'EOF' "$NO_CONFIRM_FILE" "$NO_CONFIRM_STATUS" "$BLOCKED_FILE" "$BLOCKED_STATUS" "$TASK_FILE" "$STEP_FILE" "$SUMMARY_FILE" "$WORKSPACE_DIR" "$NEW_SECRET"
const fs = require("node:fs");
const path = require("node:path");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const noConfirm = readJson(2);
const noConfirmStatus = process.argv[3];
const blocked = readJson(4);
const blockedStatus = process.argv[5];
const task = readJson(6);
const step = readJson(7);
const summary = readJson(8);
const workspaceDir = process.argv[9];
const secret = process.argv[10];
const targetPath = path.join(workspaceDir, "src", "bridge-new.txt");
const raw = JSON.stringify({ noConfirm, blocked, task, step, summary });

if (noConfirmStatus !== "400" || noConfirm.ok !== false || !String(noConfirm.error ?? "").includes("confirm=true")) {
  throw new Error(`bridge without confirm should be rejected: status=${noConfirmStatus} body=${JSON.stringify(noConfirm)}`);
}
if (blockedStatus !== "400" || blocked.ok !== false || !String(blocked.error ?? "").includes("blocked proposal")) {
  throw new Error(`blocked proposal should be rejected: status=${blockedStatus} body=${JSON.stringify(blocked)}`);
}
if (fs.existsSync(targetPath)) {
  throw new Error(`approval bridge must not write ${targetPath}`);
}
if (
  !task.ok
  || task.registry !== "openclaw-native-engineering-write-proposal-task-v0"
  || task.mode !== "approval-gated-write-proposal-bridge"
  || task.sourceRegistry !== "openclaw-native-engineering-write-proposal-v0"
  || task.capability?.id !== "act.openclaw.engineering_tool.write_proposal"
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.engineeringWriteProposal?.registry !== "openclaw-native-engineering-write-proposal-v0"
  || task.engineeringWriteProposal?.contentExposed !== false
  || task.workspaceTextWrite?.registry !== "openclaw-native-workspace-text-write-task-v0"
  || task.workspaceTextWrite?.contentExposed !== false
  || task.governance?.createsTask !== true
  || task.governance?.createsApproval !== true
  || task.governance?.canExecuteWithoutApproval !== false
  || task.governance?.executed !== false
  || task.governance?.canMutateBeforeApproval !== false
) {
  throw new Error(`write approval bridge response mismatch: ${JSON.stringify(task)}`);
}
if (!step.ok || step.ran !== false || step.blocked !== true || step.reason !== "policy_requires_approval") {
  throw new Error(`operator step should remain blocked before approval: ${JSON.stringify(step)}`);
}
if (summary.summary?.counts?.total !== 1 || summary.summary?.counts?.queued !== 1) {
  throw new Error(`task summary should contain one queued bridge task: ${JSON.stringify(summary)}`);
}
if (raw.includes(secret)) {
  throw new Error("write approval bridge response leaked proposed content secret");
}

console.log(JSON.stringify({
  openclawNativeEngineeringWriteApprovalBridge: {
    registry: task.registry,
    taskId: task.task.id,
    approvalId: task.approval.id,
    operatorBlocked: step.blocked,
    targetWritten: fs.existsSync(targetPath),
  },
}, null, 2));
EOF
