#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-manifest-map-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9920}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9921}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9922}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9923}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9924}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9925}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9926}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9927}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9990}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-manifest-map-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-manifest-map-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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
export interface PluginManifestMapContract {
  capabilityId: string;
}
export function createPluginManifestMapContract(): PluginManifestMapContract {
  return { capabilityId: "sense.openclaw.plugin_manifest_map" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type PluginManifestMapManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface PluginManifestMapEnhancedCapability {
  capabilityId: string;
}
export function definePluginManifestMapEnhancedCapability(): PluginManifestMapEnhancedCapability {
  return { capabilityId: "sense.openclaw.plugin_manifest_map" };
}
TS

cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "enabledByDefault": true,
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["PLUGIN_MANIFEST_MAP_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember", "recall"],
    "memory": ["workspace-index"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "secretSchemaBody": {
        "type": "string",
        "description": "PLUGIN_MANIFEST_MAP_SECRET_SCHEMA_BODY"
      },
      "retentionDays": {
        "type": "number"
      }
    }
  },
  "uiHints": [
    { "name": "memory", "sensitive": true }
  ]
}
JSON
cat > "$EXTENSIONS_DIR/web/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.web-search",
  "providers": ["exa", "tavily"],
  "providerEndpoints": [
    {
      "name": "exa",
      "hosts": ["PLUGIN_MANIFEST_MAP_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/media/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.media",
  "providers": ["runway", "elevenlabs"],
  "providerAuthChoices": ["api-key", "oauth"],
  "contracts": {
    "tools": ["image", "voice"],
    "media": ["render"]
  },
  "configContracts": {
    "script": "PLUGIN_MANIFEST_MAP_SECRET_SCRIPT_BODY"
  }
}
JSON
cat > "$EXTENSIONS_DIR/channel/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.channel-discord",
  "channels": ["discord", "slack"],
  "channelEnvVars": {
    "discord": ["PLUGIN_MANIFEST_MAP_SECRET_CHANNEL_ENV"]
  },
  "contracts": {
    "tools": ["send"],
    "channel": ["bridge"]
  }
}
JSON

cleanup() {
  rm -f "${MANIFEST_MAP_FILE:-}" "${SUMMARY_FILE:-}" "${ADAPTER_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

MANIFEST_MAP_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/openclaw-plugin-manifest-map" > "$MANIFEST_MAP_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-plugin-manifest-map/summary" > "$SUMMARY_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-manifest-map?query=web" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$MANIFEST_MAP_FILE" "$SUMMARY_FILE" "$ADAPTER_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const manifestMap = readJson(2);
const summary = readJson(3);
const adapter = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ manifestMap, summary, adapter, history, approvals });

if (
  !manifestMap.ok
  || manifestMap.registry !== "openclaw-plugin-manifest-map-v0"
  || manifestMap.mode !== "read-only-plugin-manifest-absorption"
  || manifestMap.capability?.id !== "sense.openclaw.plugin_manifest_map"
  || manifestMap.capability?.runtimeOwner !== "openclaw_on_nixos"
  || !manifestMap.sourceRegistries?.includes("openclaw-native-plugin-sdk-contract-implementation-v0")
) {
  throw new Error(`plugin manifest map response mismatch: ${JSON.stringify(manifestMap)}`);
}
if (
  manifestMap.summary?.manifestCount !== 4
  || manifestMap.summary?.categoryCount < 4
  || manifestMap.summary?.authReferenceCount !== 3
  || manifestMap.summary?.configSchemaCount !== 1
  || manifestMap.summary?.canReadManifestMetadata !== true
  || manifestMap.summary?.exposesManifestBodies !== false
  || manifestMap.summary?.exposesAuthEnvVarNames !== false
  || manifestMap.summary?.exposesConfigSchemaBodies !== false
  || manifestMap.summary?.canImportModule !== false
  || manifestMap.summary?.canExecutePluginCode !== false
  || manifestMap.summary?.canActivateRuntime !== false
  || manifestMap.summary?.canMutate !== false
  || manifestMap.summary?.createsTask !== false
  || manifestMap.summary?.createsApproval !== false
) {
  throw new Error(`plugin manifest map summary mismatch: ${JSON.stringify(manifestMap.summary)}`);
}
for (const category of ["memory", "search_and_web", "media", "channels"]) {
  if (!manifestMap.categories?.some((entry) => entry.category === category)) {
    throw new Error(`plugin manifest map missing category ${category}: ${JSON.stringify(manifestMap.categories)}`);
  }
}
for (const manifestId of ["openclaw.memory", "openclaw.web-search", "openclaw.media", "openclaw.channel-discord"]) {
  const entry = manifestMap.manifests?.find((manifest) => manifest.id === manifestId);
  if (!entry || entry.contentExposed !== false || entry.manifestBodyExposed !== false || entry.authMaterialExposed !== false) {
    throw new Error(`plugin manifest map missing redacted metadata entry for ${manifestId}: ${JSON.stringify(entry)}`);
  }
}
if (JSON.stringify(manifestMap.summary) !== JSON.stringify(summary.summary)) {
  throw new Error(`plugin manifest map summary endpoint should agree: ${JSON.stringify({ manifest: manifestMap.summary, summary: summary.summary })}`);
}
if (!adapter.ok || adapter.filter?.query !== "web" || adapter.manifests?.length !== 1 || adapter.manifests?.[0]?.id !== "openclaw.web-search") {
  throw new Error(`plugin manifest map native adapter query mismatch: ${JSON.stringify(adapter)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`plugin manifest map direct reads must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`plugin manifest map must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "PLUGIN_MANIFEST_MAP_SECRET_AUTH_ENV",
  "PLUGIN_MANIFEST_MAP_SECRET_CHANNEL_ENV",
  "PLUGIN_MANIFEST_MAP_SECRET_SCHEMA_BODY",
  "PLUGIN_MANIFEST_MAP_SECRET_ENDPOINT_TOKEN",
  "PLUGIN_MANIFEST_MAP_SECRET_SCRIPT_BODY",
  "secretSchemaBody",
]) {
  if (raw.includes(secret)) {
    throw new Error(`plugin manifest map leaked manifest body, auth env var name, schema body, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginManifestMap: {
    registry: manifestMap.registry,
    manifests: manifestMap.summary.manifestCount,
    categories: manifestMap.summary.categoryCount,
    authReferences: manifestMap.summary.authReferenceCount,
  },
}, null, 2));
EOF
