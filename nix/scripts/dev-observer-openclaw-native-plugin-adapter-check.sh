#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-plugin-adapter-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9170}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9171}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9172}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9173}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9174}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9175}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9176}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9177}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9240}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-plugin-adapter-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-native-plugin-adapter-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$WORKSPACE_DIR/extensions/provider-a" \
  "$WORKSPACE_DIR/extensions/provider-b" \
  "$WORKSPACE_DIR/packages/memory-host-sdk" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$WORKSPACE_DIR/qa/smoke" \
  "$WORKSPACE_DIR/skills" \
  "$WORKSPACE_DIR/src/core" \
  "$WORKSPACE_DIR/test/unit" \
  "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

for index in $(seq 1 9); do
  mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"
done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-adapter-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_ADAPTER_ROOT_SECRET_BUILD_BODY",
    "typecheck": "echo OBSERVER_ADAPTER_ROOT_SECRET_TYPECHECK_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "extensions/*"
  - "packages/*"
  - "ui"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-observer-adapter-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_ADAPTER_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-observer-adapter-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_ADAPTER_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${ADAPTER_FILE:-}" \
    "${PROFILE_FILE:-}" \
    "${CAPABILITIES_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
PROFILE_FILE="$(mktemp)"
CAPABILITIES_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/manifest-profile" > "$PROFILE_FILE"
curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$ADAPTER_FILE" "$PROFILE_FILE" "$CAPABILITIES_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const adapter = readJson(4);
const profile = readJson(5);
const capabilities = readJson(6);
const raw = JSON.stringify({ adapter, profile, capabilities });

const requiredHtml = [
  "OpenClaw Native Plugin Adapter",
  "native-plugin-adapter-registry",
  "native-plugin-adapter-status",
  "native-plugin-adapter-implemented",
  "native-plugin-adapter-runtime",
  "native-plugin-adapter-mode",
  "native-plugin-adapter-json",
];
const requiredClient = [
  "/plugins/openclaw-native-plugin-adapter",
  "renderNativePluginAdapter",
  "refreshNativePluginAdapter",
  "first real adapter capability is available, but runtime activation remains disabled",
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
const capability = capabilities.capabilities?.find((item) => item.id === "sense.plugin.manifest_profile");
if (!capability || capability.service !== "openclaw-core" || capability.governance !== "audit_only") {
  throw new Error(`Observer adapter capability registry mismatch: ${JSON.stringify(capability)}`);
}
if (
  !adapter.ok
  || adapter.registry !== "openclaw-native-plugin-adapter-v0"
  || adapter.status !== "read_only_and_approval_gated_mutation_adapters_ready"
  || adapter.summary?.canActivateRuntime !== false
  || adapter.summary?.canExecutePluginCode !== false
  || adapter.summary?.canExecuteToolCode !== false
  || !adapter.implementedCapabilities?.includes("sense.plugin.manifest_profile")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.tool_catalog")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.workspace_semantic_index")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.workspace_symbol_lookup")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.plugin_manifest_map")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.plugin_capability")
  || adapter.summary?.canExecuteWorkspaceSymbolLookup !== true
  || adapter.summary?.canPlanPluginCapabilityAbsorption !== true
) {
  throw new Error(`Observer adapter status mismatch: ${JSON.stringify(adapter)}`);
}
if (
  !profile.ok
  || profile.plugin?.packageName !== "@openclaw/plugin-sdk"
  || profile.governance?.canReadSourceFileContent !== false
  || profile.governance?.canExecutePluginCode !== false
  || profile.governance?.canActivateRuntime !== false
) {
  throw new Error(`Observer adapter profile mismatch: ${JSON.stringify(profile)}`);
}
for (const secret of [
  "OBSERVER_ADAPTER_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_ADAPTER_ROOT_SECRET_TYPECHECK_BODY",
  "OBSERVER_ADAPTER_SDK_SECRET_BUILD_BODY",
  "OBSERVER_ADAPTER_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-observer-adapter-secret-version",
  "0.0.0-observer-adapter-fixture",
]) {
  if (raw.includes(secret) || html.includes(secret) || client.includes(secret)) {
    throw new Error(`Observer adapter output must not expose source contents, script bodies, or version values: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativePluginAdapter: {
    htmlMetrics: requiredHtml,
    clientApis: [
      "/plugins/openclaw-native-plugin-adapter",
      "renderNativePluginAdapter",
      "refreshNativePluginAdapter",
    ],
    adapterStatus: adapter.status,
    capability: capability.id,
    runtimeActivation: adapter.summary.canActivateRuntime,
  },
}, null, 2));
EOF
