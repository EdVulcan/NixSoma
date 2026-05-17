#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-contract-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9980}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9981}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9982}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9983}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9984}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9985}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9986}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9987}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9988}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-contract-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-contract-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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
export interface SearchWebAdapterContractShell {
  adapterId: string;
  category: string;
}
export function createSearchWebAdapterContractShell(): SearchWebAdapterContractShell {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    category: "search_and_web",
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebAdapterManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface SearchWebAdapterSourceContract {
  adapterId: string;
  requiresApproval: boolean;
}
export function defineSearchWebAdapterSourceContract(): SearchWebAdapterSourceContract {
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
      "hosts": ["SEARCH_WEB_ADAPTER_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "secretSchemaBody": {
        "type": "string",
        "description": "SEARCH_WEB_ADAPTER_SECRET_SCHEMA_BODY"
      }
    }
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
    "lancedb": ["SEARCH_WEB_ADAPTER_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${ADAPTER_FILE:-}" "${STATUS_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

ADAPTER_FILE="$(mktemp)"
STATUS_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-contract?limit=8" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$STATUS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$ADAPTER_FILE" "$STATUS_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const adapterContract = readJson(2);
const status = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const tasks = readJson(6);
const raw = JSON.stringify({ adapterContract, status, history, approvals, tasks });

if (
  !adapterContract.ok
  || adapterContract.registry !== "openclaw-plugin-search-web-adapter-contract-v0"
  || adapterContract.mode !== "native-search-web-adapter-contract-shell"
  || !adapterContract.sourceRegistries?.includes("openclaw-plugin-candidate-contract-tests-v0")
  || adapterContract.adapter?.id !== "openclaw.search_web.native-adapter"
  || adapterContract.adapter?.status !== "contract_shell_ready_runtime_disabled"
) {
  throw new Error(`search/web adapter contract response mismatch: ${JSON.stringify(adapterContract)}`);
}
if (
  adapterContract.summary?.providerContractCount !== 2
  || adapterContract.summary?.requiredChecks !== adapterContract.summary?.passedRequired
  || adapterContract.summary?.failedRequired !== 0
  || adapterContract.summary?.adapterContractReady !== true
  || adapterContract.summary?.runtimeAdapterImplemented !== false
  || adapterContract.summary?.requiresApproval !== 2
  || adapterContract.summary?.crossBoundaryContracts !== 2
  || adapterContract.summary?.canUseNetwork !== false
  || adapterContract.summary?.canImportModule !== false
  || adapterContract.summary?.canExecutePluginCode !== false
  || adapterContract.summary?.canActivateRuntime !== false
  || adapterContract.summary?.createsTask !== false
  || adapterContract.summary?.createsApproval !== false
) {
  throw new Error(`search/web adapter contract summary mismatch: ${JSON.stringify(adapterContract.summary)}`);
}
for (const contract of adapterContract.providerContracts ?? []) {
  if (
    contract.category !== "search_and_web"
    || contract.policy?.domain !== "cross_boundary"
    || contract.policy?.requiresApproval !== true
    || contract.audit?.ledger !== "capability_history"
    || contract.runtime?.owner !== "openclaw_on_nixos"
    || contract.runtime?.canUseNetwork !== false
    || contract.runtime?.canImportModule !== false
    || contract.runtime?.canExecutePluginCode !== false
    || contract.runtime?.canActivateRuntime !== false
    || contract.futureTaskBoundary?.createsTaskNow !== false
    || contract.futureTaskBoundary?.createsApprovalNow !== false
    || contract.privacy?.authEnvVarNamesExposed !== false
    || contract.privacy?.endpointHostsExposed !== false
  ) {
    throw new Error(`search/web provider contract boundary mismatch: ${JSON.stringify(contract)}`);
  }
}
for (const check of adapterContract.contractChecks ?? []) {
  if (check.required !== true || check.status !== "passed") {
    throw new Error(`search/web adapter contract check should pass: ${JSON.stringify(check)}`);
  }
}
if (
  !status.implementedCapabilities?.includes("plan.openclaw.plugin_search_web_adapter_contract")
  || status.summary?.canPlanSearchWebAdapterContract !== true
) {
  throw new Error(`native adapter status should expose search/web adapter contract shell: ${JSON.stringify(status)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`search/web adapter contract must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`search/web adapter contract must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`search/web adapter contract must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "SEARCH_WEB_ADAPTER_SECRET_ENDPOINT_TOKEN",
  "SEARCH_WEB_ADAPTER_SECRET_SCHEMA_BODY",
  "SEARCH_WEB_ADAPTER_SECRET_AUTH_ENV",
  "secretSchemaBody",
]) {
  if (raw.includes(secret)) {
    throw new Error(`search/web adapter contract leaked manifest body, auth env var name, schema body, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterContract: {
    registry: adapterContract.registry,
    providers: adapterContract.summary.providerContractCount,
    required: `${adapterContract.summary.passedRequired}/${adapterContract.summary.requiredChecks}`,
    network: adapterContract.summary.canUseNetwork,
    runtime: adapterContract.summary.canActivateRuntime,
  },
}, null, 2));
EOF
