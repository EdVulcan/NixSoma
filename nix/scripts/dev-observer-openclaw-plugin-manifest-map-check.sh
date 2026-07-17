#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-manifest-map-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9930}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9931}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9932}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9933}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9934}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9935}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9936}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9937}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9995}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-manifest-map-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-plugin-manifest-map-check-events.jsonl}"

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
  "$EXTENSIONS_DIR/memory" \
  "$EXTENSIONS_DIR/web" \
  "$EXTENSIONS_DIR/media" \
  "$EXTENSIONS_DIR/channel"
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
export interface ObserverPluginManifestMapContract {
  capabilityId: string;
}
export function createObserverPluginManifestMapContract(): ObserverPluginManifestMapContract {
  return { capabilityId: "sense.openclaw.plugin_manifest_map" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverPluginManifestMapManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverPluginManifestMapEnhancedCapability {
  capabilityId: string;
}
export function defineObserverPluginManifestMapEnhancedCapability(): ObserverPluginManifestMapEnhancedCapability {
  return { capabilityId: "sense.openclaw.plugin_manifest_map" };
}
TS

cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "enabledByDefault": true,
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "observerSecretSchemaBody": {
        "type": "string",
        "description": "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_SCHEMA_BODY"
      }
    }
  }
}
JSON
cat > "$EXTENSIONS_DIR/web/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.web-search",
  "providers": ["exa"],
  "providerEndpoints": [
    {
      "name": "exa",
      "hosts": ["OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/media/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.media",
  "providers": ["runway"],
  "contracts": {
    "tools": ["image"],
    "media": ["render"]
  },
  "configContracts": {
    "script": "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_SCRIPT_BODY"
  }
}
JSON
cat > "$EXTENSIONS_DIR/channel/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.channel-discord",
  "channels": ["discord"],
  "channelEnvVars": {
    "discord": ["OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_CHANNEL_ENV"]
  },
  "contracts": {
    "tools": ["send"],
    "channel": ["bridge"]
  }
}
JSON

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${MANIFEST_MAP_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
MANIFEST_MAP_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-plugin-manifest-map" > "$MANIFEST_MAP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$MANIFEST_MAP_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const manifestMap = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ html, client, manifestMap, history, approvals });

for (const token of [
  "OpenClaw Plugin Manifest Map",
  "plugin-manifest-map-registry",
  "plugin-manifest-map-manifests",
  "plugin-manifest-map-categories",
  "plugin-manifest-map-auth",
  "plugin-manifest-map-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/openclaw-plugin-manifest-map",
  "refreshPluginManifestMap",
  "renderPluginManifestMap",
  "sense.openclaw.plugin_manifest_map",
  "authRefs=",
  "exposeAuthNames=",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !manifestMap.ok
  || manifestMap.registry !== "openclaw-plugin-manifest-map-v0"
  || manifestMap.summary?.manifestCount !== 4
  || manifestMap.summary?.categoryCount < 4
  || manifestMap.summary?.authReferenceCount !== 3
  || manifestMap.governance?.canReadManifestMetadata !== true
  || manifestMap.governance?.exposesManifestBodies !== false
  || manifestMap.governance?.exposesAuthEnvVarNames !== false
  || manifestMap.governance?.exposesConfigSchemaBodies !== false
  || manifestMap.governance?.canImportModule !== false
  || manifestMap.governance?.canExecutePluginCode !== false
  || manifestMap.governance?.canActivateRuntime !== false
  || manifestMap.governance?.createsTask !== false
  || manifestMap.governance?.createsApproval !== false
) {
  throw new Error(`Observer plugin manifest map response mismatch: ${JSON.stringify(manifestMap)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer plugin manifest map direct reads must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer plugin manifest map must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_AUTH_ENV",
  "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_CHANNEL_ENV",
  "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_SCHEMA_BODY",
  "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_ENDPOINT_TOKEN",
  "OBSERVER_PLUGIN_MANIFEST_MAP_SECRET_SCRIPT_BODY",
  "observerSecretSchemaBody",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer plugin manifest map leaked manifest body, auth env var name, schema body, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawPluginManifestMap: {
    html: "visible",
    registry: manifestMap.registry,
    manifests: manifestMap.summary.manifestCount,
    categories: manifestMap.summary.categoryCount,
    authReferences: manifestMap.summary.authReferenceCount,
  },
}, null, 2));
EOF
