#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-plugin-runtime-refresh-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10200}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10201}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10202}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10203}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10204}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10205}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10206}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10207}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10208}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-plugin-runtime-refresh-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-native-plugin-runtime-refresh-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-runtime-refresh-evidence-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_RUNTIME_REFRESH_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "extensions/*"
  - "packages/*"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-observer-runtime-refresh-evidence-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_RUNTIME_REFRESH_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_RUNTIME_REFRESH_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${REFRESH_FILE:-}" \
    "${HISTORY_FILE:-}" \
    "${APPROVALS_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
    "${TASK_STATE_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
REFRESH_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
TASK_STATE_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/runtime-refresh-evidence" > "$REFRESH_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$REFRESH_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const refresh = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ html, client, refresh, history, approvals });

for (const token of [
  "OpenClaw Native Runtime Refresh",
  "native-plugin-runtime-refresh-registry",
  "native-plugin-runtime-refresh-state",
  "native-plugin-runtime-refresh-blocked",
  "native-plugin-runtime-refresh-runtime",
  "native-plugin-runtime-refresh-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing runtime refresh token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/runtime-refresh-evidence",
  "refreshNativePluginRuntimeRefreshEvidence",
  "renderNativePluginRuntimeRefreshEvidence",
  "Native plugin runtime refresh evidence",
  "sense.openclaw.plugin_runtime.refresh_evidence",
  "governed-runtime-refresh-evidence-only",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing runtime refresh token: ${token}`);
  }
}
if (
  !refresh.ok
  || refresh.registry !== "openclaw-native-plugin-runtime-refresh-evidence-v0"
  || refresh.summary?.readModelRefreshed !== true
  || refresh.summary?.canImportModule !== false
  || refresh.summary?.canExecutePluginCode !== false
  || refresh.summary?.canActivateRuntime !== false
  || refresh.governance?.canInvalidateModuleCache !== false
) {
  throw new Error(`Observer runtime refresh evidence mismatch: ${JSON.stringify(refresh)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer runtime refresh evidence must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer runtime refresh evidence must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_RUNTIME_REFRESH_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_REFRESH_SDK_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_REFRESH_SDK_SECRET_SOURCE_CONTENT",
  "0.0.0-observer-runtime-refresh-evidence-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer runtime refresh evidence leaked source contents, script bodies, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativePluginRuntimeRefreshEvidence: {
    html: "visible",
    client: "visible",
    registry: refresh.registry,
    readModelRefreshed: refresh.summary.readModelRefreshed,
    activationReady: refresh.summary.activationReady,
  },
}, null, 2));
EOF

post_json "$CORE_URL/plugins/native-adapter/runtime-refresh-tasks" '{"confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-plugin-runtime-refresh-task-v0"
  || taskResponse.task?.type !== "native_plugin_runtime_refresh"
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canRefreshReadModel !== true
  || taskResponse.governance?.canImportModule !== false
  || taskResponse.governance?.canExecutePluginCode !== false
  || taskResponse.governance?.canActivateRuntime !== false
) {
  throw new Error(`observer runtime refresh task response mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  !blocked.ok
  || blocked.ran !== false
  || blocked.blocked !== true
  || blocked.reason !== "policy_requires_approval"
  || blocked.approval?.id !== taskResponse.approval?.id
) {
  throw new Error(`observer runtime refresh task should block before approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

task_id="$(node - <<'EOF' "$TASK_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(taskResponse.task.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-native-plugin-runtime-refresh-evidence-check","reason":"Approve observer-visible read-model-only runtime refresh task."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$task_id" > "$TASK_STATE_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASK_FILE" "$APPROVED_FILE" "$STEP_FILE" "$TASK_STATE_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const taskResponse = readJson(4);
const approved = readJson(5);
const step = readJson(6);
const taskState = readJson(7);
const raw = JSON.stringify({ html, client, taskResponse, approved, step, taskState });

if (!html.includes("OpenClaw Native Runtime Refresh") || !client.includes("/plugins/native-adapter/runtime-refresh-evidence")) {
  throw new Error("Observer runtime refresh panel tokens should remain visible after task bridge.");
}
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`observer runtime refresh approval should be approved and audited: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false || step.task?.status !== "completed") {
  throw new Error(`observer approved runtime refresh task should run to completion: ${JSON.stringify(step)}`);
}
const execution = taskState.task?.nativePluginRuntimeRefresh?.execution;
if (
  taskState.task?.id !== taskResponse.task?.id
  || taskState.task?.status !== "completed"
  || execution?.registry !== "openclaw-native-plugin-runtime-refresh-task-execution-v0"
  || execution.readModelRefreshed !== true
  || execution.governance?.canRefreshReadModel !== true
  || execution.governance?.canInvalidateModuleCache !== false
  || execution.governance?.canImportModule !== false
  || execution.governance?.canExecutePluginCode !== false
  || execution.governance?.canActivateRuntime !== false
  || execution.runtimeRefreshEvidence?.summary?.readModelRefreshed !== true
) {
  throw new Error(`observer runtime refresh task readback mismatch: ${JSON.stringify(taskState)}`);
}
for (const secret of [
  "OBSERVER_RUNTIME_REFRESH_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_REFRESH_SDK_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_REFRESH_SDK_SECRET_SOURCE_CONTENT",
  "0.0.0-observer-runtime-refresh-evidence-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer runtime refresh task leaked source contents, script bodies, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativePluginRuntimeRefreshTask: {
    taskId: taskState.task.id,
    registry: execution.registry,
    readModelRefreshed: execution.readModelRefreshed,
    observerPanel: "visible",
    canImportModule: execution.governance.canImportModule,
    canActivateRuntime: execution.governance.canActivateRuntime,
  },
}, null, 2));
EOF
