#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-search-web-adapter-task-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="OBSERVER_SEARCH_WEB_TASK_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10020}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10021}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10022}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10023}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10024}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10025}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10026}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10027}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10028}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-search-web-adapter-task-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-plugin-search-web-adapter-task-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' -d "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$SDK_SOURCE_DIR" \
  "$EXTENSIONS_DIR/web" \
  "$EXTENSIONS_DIR/brave" \
  "$EXTENSIONS_DIR/memory"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface ObserverSearchWebAdapterTaskContract {
  adapterId: string;
  requiresApproval: boolean;
}
export function createObserverSearchWebAdapterTaskContract(): ObserverSearchWebAdapterTaskContract {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    requiresApproval: true,
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverSearchWebAdapterTaskManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverSearchWebAdapterTaskSourceContract {
  adapterId: string;
  networkDeferred: boolean;
}
export function defineObserverSearchWebAdapterTaskSourceContract(): ObserverSearchWebAdapterTaskSourceContract {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    networkDeferred: true,
  };
}
TS

cat > "$EXTENSIONS_DIR/web/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.web-search",
  "providers": ["exa"],
  "providerEndpoints": [
    {
      "name": "exa",
      "hosts": ["OBSERVER_SEARCH_WEB_TASK_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/brave/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.brave",
  "providers": ["brave"],
  "syntheticAuthRefs": ["brave-key"],
  "contracts": {
    "webSearchProviders": ["brave"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["OBSERVER_SEARCH_WEB_TASK_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${PENDING_FILE:-}" "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
PENDING_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$PENDING_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASK_FILE" "$PENDING_FILE" "$HISTORY_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const taskResponse = readJson(4);
const pending = readJson(5);
const history = readJson(6);
const querySecret = process.argv[7];
const raw = JSON.stringify({ html, client, taskResponse, pending, history });

for (const token of [
  "plugin-search-web-task-button",
  "Create Search/Web Approval Task",
  "OpenClaw Search/Web Adapter Contract",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/plugin-search-web-adapter-tasks",
  "createPluginSearchWebApprovalTask",
  "pluginSearchWebTaskButton",
  "network execution remains deferred",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-plugin-search-web-adapter-task-v0"
  || taskResponse.mode !== "approval-gated-search-web-task"
  || taskResponse.providerContract?.manifestId !== "openclaw.web-search"
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canUseNetwork !== false
  || taskResponse.governance?.canExecutePluginCode !== false
  || taskResponse.governance?.canActivateRuntime !== false
) {
  throw new Error(`Observer search/web adapter task response mismatch: ${JSON.stringify(taskResponse)}`);
}
const task = taskResponse.task ?? {};
if (
  task.status !== "queued"
  || task.policy?.decision?.decision !== "require_approval"
  || task.approval?.required !== true
  || !taskResponse.approval?.id
  || taskResponse.approval?.status !== "pending"
) {
  throw new Error(`Observer search/web adapter task should be queued behind approval: ${JSON.stringify(taskResponse)}`);
}
if (pending.items?.length !== 1 || pending.items[0].id !== taskResponse.approval.id) {
  throw new Error(`Observer approval inbox should contain search/web approval: ${JSON.stringify(pending.items)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer search/web adapter task must not invoke capabilities or network providers: ${JSON.stringify(history.items)}`);
}
for (const secret of [
  querySecret,
  "OBSERVER_SEARCH_WEB_TASK_SECRET_ENDPOINT_TOKEN",
  "OBSERVER_SEARCH_WEB_TASK_SECRET_AUTH_ENV",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer search/web adapter task leaked query, manifest body, auth env var name, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawSearchWebAdapterTask: {
    html: "control-visible",
    registry: taskResponse.registry,
    provider: taskResponse.providerContract.manifestId,
    task: task.id,
    approval: taskResponse.approval.id,
    network: taskResponse.governance.canUseNetwork,
  },
}, null, 2));
EOF
