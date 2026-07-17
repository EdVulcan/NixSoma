#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-search-web-adapter-contract-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9990}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9991}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9992}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9993}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9994}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9995}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9996}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9997}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9998}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-search-web-adapter-contract-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-plugin-search-web-adapter-contract-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

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
export interface ObserverSearchWebAdapterContractShell {
  adapterId: string;
  category: string;
}
export function createObserverSearchWebAdapterContractShell(): ObserverSearchWebAdapterContractShell {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    category: "search_and_web",
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverSearchWebAdapterManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverSearchWebAdapterSourceContract {
  adapterId: string;
  requiresApproval: boolean;
}
export function defineObserverSearchWebAdapterSourceContract(): ObserverSearchWebAdapterSourceContract {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    requiresApproval: true,
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
      "hosts": ["OBSERVER_SEARCH_WEB_ADAPTER_SECRET_ENDPOINT_TOKEN.example.test"]
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
    "lancedb": ["OBSERVER_SEARCH_WEB_ADAPTER_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${ADAPTER_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}" "${INVOKE_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-contract?limit=8" > "$ADAPTER_FILE"
curl --silent --fail --request POST "$CORE_URL/capabilities/invoke" \
  --header 'content-type: application/json' \
  --data '{"capabilityId":"plan.openclaw.plugin_search_web_adapter_contract","intent":"plugin.search_web.contract","params":{"limit":8}}' > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$ADAPTER_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE" "$INVOKE_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const adapterContract = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const tasks = readJson(7);
const invocation = readJson(8);
const raw = JSON.stringify({ html, client, adapterContract, history, approvals, tasks, invocation });

for (const token of [
  "OpenClaw Search/Web Adapter Contract",
  "plugin-search-web-contract-registry",
  "plugin-search-web-contract-providers",
  "plugin-search-web-contract-required",
  "plugin-search-web-contract-network",
  "plugin-search-web-contract-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/capabilities/invoke",
  "plan.openclaw.plugin_search_web_adapter_contract",
  "refreshPluginSearchWebAdapterContract",
  "renderPluginSearchWebAdapterContract",
  "openclaw-plugin-search-web-adapter-contract-v0",
  "Search/Web adapter contract shell",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !adapterContract.ok
  || adapterContract.registry !== "openclaw-plugin-search-web-adapter-contract-v0"
  || adapterContract.summary?.providerContractCount !== 2
  || adapterContract.summary?.requiredChecks !== adapterContract.summary?.passedRequired
  || adapterContract.summary?.adapterContractReady !== true
  || adapterContract.summary?.canUseNetwork !== false
  || adapterContract.summary?.canImportModule !== false
  || adapterContract.summary?.canExecutePluginCode !== false
  || adapterContract.summary?.canActivateRuntime !== false
  || adapterContract.summary?.createsTask !== false
  || adapterContract.summary?.createsApproval !== false
  || adapterContract.governance?.requiresExplicitApprovalBeforeNetworkUse !== true
) {
  throw new Error(`Observer search/web adapter contract response mismatch: ${JSON.stringify(adapterContract)}`);
}
if (
  (history.items ?? []).length !== 1
  || history.items[0]?.capability?.id !== "plan.openclaw.plugin_search_web_adapter_contract"
  || history.items[0]?.summary?.kind !== "plugin.search_web_adapter_contract"
  || history.items[0]?.summary?.noNetwork !== true
  || history.items[0]?.summary?.noPluginExecution !== true
  || history.items[0]?.summary?.noRuntimeActivation !== true
) {
  throw new Error(`Observer search/web adapter contract common capability evidence mismatch: ${JSON.stringify(history.items)}`);
}
if (
  !invocation.ok
  || invocation.invoked !== true
  || invocation.capability?.id !== "plan.openclaw.plugin_search_web_adapter_contract"
  || invocation.result?.registry !== "openclaw-plugin-search-web-adapter-contract-v0"
  || invocation.summary?.kind !== "plugin.search_web_adapter_contract"
  || invocation.summary?.noNetwork !== true
  || invocation.summary?.noTaskCreation !== true
  || invocation.summary?.noApprovalCreation !== true
) {
  throw new Error(`Observer search/web adapter contract capability response mismatch: ${JSON.stringify(invocation)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer search/web adapter contract must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`Observer search/web adapter contract must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "OBSERVER_SEARCH_WEB_ADAPTER_SECRET_ENDPOINT_TOKEN",
  "OBSERVER_SEARCH_WEB_ADAPTER_SECRET_AUTH_ENV",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer search/web adapter contract leaked manifest body, auth env var name, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawSearchWebAdapterContract: {
    html: "visible",
    registry: adapterContract.registry,
    providers: adapterContract.summary.providerContractCount,
    required: `${adapterContract.summary.passedRequired}/${adapterContract.summary.requiredChecks}`,
    network: adapterContract.summary.canUseNetwork,
  },
}, null, 2));
EOF
