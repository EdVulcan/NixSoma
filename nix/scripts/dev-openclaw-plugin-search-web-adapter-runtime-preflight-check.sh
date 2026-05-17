#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-runtime-preflight-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_PREFLIGHT_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10050}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10051}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10052}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10053}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10054}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10055}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10056}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10057}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10058}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-runtime-preflight-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-runtime-preflight-check-events.jsonl}"

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
  "$EXTENSIONS_DIR/memory"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-search-web-preflight-fixture",
  "private": true,
  "scripts": {
    "build": "echo SEARCH_WEB_PREFLIGHT_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-search-web-preflight-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEARCH_WEB_PREFLIGHT_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SEARCH_WEB_PREFLIGHT_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebPreflightManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineSearchWebPreflightSourceContract() {
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
      "hosts": ["SEARCH_WEB_PREFLIGHT_SECRET_ENDPOINT.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["SEARCH_WEB_PREFLIGHT_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${ADAPTER_FILE:-}" "${PREFLIGHT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

ADAPTER_FILE="$(mktemp)"
PREFLIGHT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight?providerContractId=openclaw.web-search&query=$QUERY_SECRET" > "$PREFLIGHT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$ADAPTER_FILE" "$PREFLIGHT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const adapter = readJson(2);
const preflight = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const querySecret = process.argv[6];
const raw = JSON.stringify({ adapter, preflight, history, approvals });

if (
  !adapter.ok
  || !adapter.implementedCapabilities?.includes("plan.openclaw.plugin_search_web_runtime_preflight")
  || adapter.summary?.canPlanSearchWebRuntimePreflight !== true
  || adapter.summary?.canExecutePluginCode !== false
  || adapter.summary?.canActivateRuntime !== false
) {
  throw new Error(`adapter should expose search/web runtime preflight without runtime activation: ${JSON.stringify(adapter)}`);
}
if (
  !preflight.ok
  || preflight.registry !== "openclaw-plugin-search-web-adapter-runtime-preflight-v0"
  || preflight.mode !== "preflight-only"
  || preflight.sourceRegistry !== "openclaw-plugin-search-web-adapter-task-draft-v0"
  || preflight.adapter?.status !== "preflight_ready_network_runtime_disabled"
  || preflight.adapter?.canUseNetwork !== false
  || preflight.adapter?.canExecutePluginCode !== false
  || preflight.adapter?.canActivateRuntime !== false
  || preflight.provider?.manifestId !== "openclaw.web-search"
  || preflight.query?.contentExposed !== false
) {
  throw new Error(`search/web runtime preflight mismatch: ${JSON.stringify(preflight)}`);
}
const envelope = preflight.executionEnvelope;
if (
  envelope?.envelopeVersion !== "openclaw-search-web-execution-envelope-v0"
  || envelope.state !== "blocked_pending_network_runtime_adapter"
  || envelope.policyDecision?.decision !== "require_approval"
  || envelope.approval?.required !== true
  || envelope.approval?.collected !== false
  || envelope.audit?.required !== true
  || envelope.audit?.ledger !== "capability_history"
  || envelope.query?.contentExposed !== false
  || envelope.constraints?.canReadManifestMetadata !== true
  || envelope.constraints?.canResolveProviderMetadata !== true
  || envelope.constraints?.canExposeQueryContent !== false
  || envelope.constraints?.canUseNetwork !== false
  || envelope.constraints?.canImportModule !== false
  || envelope.constraints?.canExecutePluginCode !== false
  || envelope.constraints?.canActivateRuntime !== false
  || envelope.constraints?.canMutate !== false
  || envelope.constraints?.canCreateTask !== false
  || envelope.constraints?.canCreateApproval !== false
) {
  throw new Error(`search/web preflight envelope mismatch: ${JSON.stringify(envelope)}`);
}
if (
  preflight.governance?.createsTask !== false
  || preflight.governance?.createsApproval !== false
  || preflight.governance?.canUseNetwork !== false
  || preflight.governance?.canImportModule !== false
  || preflight.governance?.canExecutePluginCode !== false
  || preflight.governance?.canActivateRuntime !== false
  || preflight.governance?.exposesQueryContent !== false
  || preflight.governance?.exposesEndpointHosts !== false
) {
  throw new Error(`search/web runtime preflight governance mismatch: ${JSON.stringify(preflight.governance)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`search/web runtime preflight must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`search/web runtime preflight must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_PREFLIGHT_ROOT_SECRET_BUILD_BODY",
  "SEARCH_WEB_PREFLIGHT_SDK_SECRET_BUILD_BODY",
  "SEARCH_WEB_PREFLIGHT_SDK_SECRET_SOURCE_CONTENT",
  "SEARCH_WEB_PREFLIGHT_SECRET_ENDPOINT",
  "SEARCH_WEB_PREFLIGHT_SECRET_AUTH_ENV",
  "0.0.0-search-web-preflight-fixture",
  "0.0.0-search-web-preflight-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`search/web runtime preflight leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterRuntimePreflight: {
    registry: preflight.registry,
    envelope: envelope.envelopeVersion,
    state: envelope.state,
    provider: preflight.provider.manifestId,
    network: preflight.adapter.canUseNetwork,
    capabilityInvocations: history.items.length,
    pendingApprovals: approvals.items.length,
  },
}, null, 2));
EOF
