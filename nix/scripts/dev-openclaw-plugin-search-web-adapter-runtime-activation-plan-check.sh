#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-runtime-activation-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_ACTIVATION_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10070}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10071}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10072}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10073}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10074}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10075}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10076}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10077}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10078}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-runtime-activation-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-runtime-activation-plan-check-events.jsonl}"

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
  "version": "0.0.0-search-web-activation-plan-fixture",
  "private": true,
  "scripts": {
    "build": "echo SEARCH_WEB_ACTIVATION_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-search-web-activation-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEARCH_WEB_ACTIVATION_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SEARCH_WEB_ACTIVATION_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebActivationManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineSearchWebActivationSourceContract() {
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
      "hosts": ["SEARCH_WEB_ACTIVATION_SECRET_ENDPOINT.example.test"]
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
    "lancedb": ["SEARCH_WEB_ACTIVATION_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${PLAN_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

PLAN_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-plan?providerContractId=openclaw.web-search&query=$QUERY_SECRET" > "$PLAN_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$PLAN_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const plan = readJson(2);
const history = readJson(3);
const approvals = readJson(4);
const querySecret = process.argv[5];
const raw = JSON.stringify({ plan, history, approvals });

if (
  !plan.ok
  || plan.registry !== "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0"
  || plan.mode !== "activation-plan-only"
  || plan.status !== "blocked_pending_network_runtime_adapter"
  || plan.activationReady !== false
  || plan.sourceRegistry !== "openclaw-plugin-search-web-adapter-runtime-preflight-v0"
  || plan.executionEnvelope?.envelopeVersion !== "openclaw-search-web-execution-envelope-v0"
  || plan.executionEnvelope?.state !== "blocked_pending_network_runtime_adapter"
) {
  throw new Error(`search/web runtime activation plan mismatch: ${JSON.stringify(plan)}`);
}
if (
  plan.summary?.activationReady !== false
  || plan.summary?.requiredGates !== 7
  || plan.summary?.passedRequired !== 4
  || plan.summary?.blockedRequired !== 3
  || plan.summary?.canUseNetwork !== false
  || plan.summary?.canImportModule !== false
  || plan.summary?.canExecutePluginCode !== false
  || plan.summary?.canActivateRuntime !== false
  || plan.summary?.createsTask !== false
  || plan.summary?.createsApproval !== false
) {
  throw new Error(`search/web runtime activation summary mismatch: ${JSON.stringify(plan.summary)}`);
}
for (const id of [
  "network_runtime_adapter_required",
  "provider_runtime_sandbox_required",
  "runtime_activation_approval_required",
]) {
  const gate = plan.gates?.find((item) => item.id === id);
  if (!gate || gate.required !== true || gate.status !== "blocked") {
    throw new Error(`search/web runtime activation gate should be blocked: ${JSON.stringify(gate)}`);
  }
}
for (const id of [
  "preflight_envelope_ready",
  "audit_binding_ready",
  "explicit_user_approval_required",
  "query_privacy_locked",
]) {
  const gate = plan.gates?.find((item) => item.id === id);
  if (!gate || gate.required !== true || gate.status !== "passed") {
    throw new Error(`search/web runtime activation gate should be passed: ${JSON.stringify(gate)}`);
  }
}
if (
  plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
  || plan.governance?.canUseNetwork !== false
  || plan.governance?.canImportModule !== false
  || plan.governance?.canExecutePluginCode !== false
  || plan.governance?.canActivateRuntime !== false
  || plan.governance?.exposesQueryContent !== false
  || plan.governance?.exposesEndpointHosts !== false
) {
  throw new Error(`search/web runtime activation governance mismatch: ${JSON.stringify(plan.governance)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`search/web runtime activation plan must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`search/web runtime activation plan must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_ACTIVATION_ROOT_SECRET_BUILD_BODY",
  "SEARCH_WEB_ACTIVATION_SDK_SECRET_BUILD_BODY",
  "SEARCH_WEB_ACTIVATION_SDK_SECRET_SOURCE_CONTENT",
  "SEARCH_WEB_ACTIVATION_SECRET_ENDPOINT",
  "SEARCH_WEB_ACTIVATION_SECRET_AUTH_ENV",
  "0.0.0-search-web-activation-plan-fixture",
  "0.0.0-search-web-activation-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`search/web runtime activation plan leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterRuntimeActivationPlan: {
    registry: plan.registry,
    status: plan.status,
    passedRequired: plan.summary.passedRequired,
    blockedRequired: plan.summary.blockedRequired,
    activationReady: plan.activationReady,
  },
}, null, 2));
EOF
