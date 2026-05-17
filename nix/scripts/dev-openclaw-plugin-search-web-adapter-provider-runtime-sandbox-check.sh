#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_SANDBOX_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10170}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10171}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10172}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10173}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10174}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10175}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10176}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10177}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10178}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-provider-runtime-sandbox-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-check-events.jsonl}"

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
  "version": "0.0.0-search-web-sandbox-fixture",
  "private": true,
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-search-web-sandbox-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SEARCH_WEB_SANDBOX_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebSandboxManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineSearchWebSandboxSourceContract() {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    networkRuntimeDeferred: true,
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
      "hosts": ["SEARCH_WEB_SANDBOX_SECRET_ENDPOINT.example.test"]
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
    "lancedb": ["SEARCH_WEB_SANDBOX_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${SANDBOX_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

SANDBOX_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox?providerContractId=openclaw.web-search&query=$QUERY_SECRET" > "$SANDBOX_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$SANDBOX_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const sandbox = readJson(2);
const history = readJson(3);
const approvals = readJson(4);
const querySecret = process.argv[5];
const raw = JSON.stringify({ sandbox, history, approvals });

if (
  !sandbox.ok
  || sandbox.registry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0"
  || sandbox.mode !== "provider-runtime-sandbox-contract"
  || sandbox.status !== "contract_ready_activation_blocked"
  || sandbox.sourceRegistry !== "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0"
  || sandbox.sandbox?.contractVersion !== "openclaw-search-web-provider-runtime-sandbox-v0"
  || sandbox.sandbox?.state !== "contract_ready_not_approved"
) {
  throw new Error(`search/web provider runtime sandbox mismatch: ${JSON.stringify(sandbox)}`);
}
if (
  sandbox.summary?.requiredChecks !== 8
  || sandbox.summary?.passedRequired !== 6
  || sandbox.summary?.blockedRequired !== 2
  || sandbox.summary?.sandboxContractReady !== true
  || sandbox.summary?.sandboxApproved !== false
  || sandbox.summary?.activationReady !== false
  || sandbox.summary?.createsTask !== false
  || sandbox.summary?.createsApproval !== false
  || sandbox.summary?.canUseNetwork !== false
  || sandbox.summary?.canImportModule !== false
  || sandbox.summary?.canExecutePluginCode !== false
  || sandbox.summary?.canActivateRuntime !== false
) {
  throw new Error(`search/web provider runtime sandbox summary mismatch: ${JSON.stringify(sandbox.summary)}`);
}
for (const id of ["sandbox_approval_required", "network_runtime_adapter_required"]) {
  const check = sandbox.checks?.find((item) => item.id === id);
  if (!check || check.required !== true || check.status !== "blocked") {
    throw new Error(`sandbox check should be blocked: ${JSON.stringify(check)}`);
  }
}
if (
  sandbox.sandbox?.egress?.networkEgressDefault !== "deny"
  || sandbox.sandbox?.egress?.canUseNetwork !== false
  || sandbox.sandbox?.egress?.endpointHostsExposed !== false
  || sandbox.sandbox?.privacy?.queryContentExposed !== false
  || sandbox.sandbox?.privacy?.authEnvVarNamesExposed !== false
  || sandbox.sandbox?.privacy?.endpointHostsExposed !== false
  || sandbox.sandbox?.execution?.canImportModule !== false
  || sandbox.sandbox?.execution?.canExecuteProviderCode !== false
  || sandbox.sandbox?.execution?.canActivateRuntime !== false
) {
  throw new Error(`sandbox boundary mismatch: ${JSON.stringify(sandbox.sandbox)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`provider runtime sandbox contract must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`provider runtime sandbox contract must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_SANDBOX_ROOT_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_SDK_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_SDK_SECRET_SOURCE_CONTENT",
  "SEARCH_WEB_SANDBOX_SECRET_ENDPOINT",
  "SEARCH_WEB_SANDBOX_SECRET_AUTH_ENV",
  "0.0.0-search-web-sandbox-fixture",
  "0.0.0-search-web-sandbox-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`provider runtime sandbox leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterProviderRuntimeSandbox: {
    registry: sandbox.registry,
    status: sandbox.status,
    passedRequired: sandbox.summary.passedRequired,
    blockedRequired: sandbox.summary.blockedRequired,
    network: sandbox.summary.canUseNetwork,
    runtime: sandbox.summary.canActivateRuntime,
  },
}, null, 2));
EOF
