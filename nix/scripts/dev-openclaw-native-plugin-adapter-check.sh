#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-adapter-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9160}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9161}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9162}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9163}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9164}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9165}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9166}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9167}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9230}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-adapter-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-adapter-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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
  "version": "0.0.0-native-adapter-fixture",
  "private": true,
  "scripts": {
    "build": "echo ADAPTER_ROOT_SECRET_BUILD_BODY",
    "typecheck": "echo ADAPTER_ROOT_SECRET_TYPECHECK_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "extensions/*"
  - "packages/*"
  - "ui"
YAML
cat > "$WORKSPACE_DIR/README.md" <<'MD'
ADAPTER_ROOT_SECRET_README_CONTENT must not appear in adapter output.
MD
cat > "$WORKSPACE_DIR/ui/package.json" <<'JSON'
{
  "name": "@openclaw/ui",
  "private": true
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-native-adapter-fixture",
  "private": false,
  "main": "./dist/index.js",
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing.js"
  },
  "scripts": {
    "build": "echo ADAPTER_SDK_SECRET_BUILD_BODY",
    "test": "echo ADAPTER_SDK_SECRET_TEST_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-adapter-secret-version"
  },
  "devDependencies": {
    "typescript": "999.0.0-adapter-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/README.md" <<'MD'
ADAPTER_SDK_SECRET_README_CONTENT must not appear in adapter output.
MD
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const ADAPTER_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f \
    "${CAPABILITIES_FILE:-}" \
    "${ADAPTER_FILE:-}" \
    "${PROFILE_FILE:-}" \
    "${INVOKE_FILE:-}" \
    "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CAPABILITIES_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
PROFILE_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/manifest-profile" > "$PROFILE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"sense.plugin.manifest_profile","intent":"plugin.manifest.profile"}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=sense.plugin.manifest_profile&limit=5" > "$HISTORY_FILE"

node - <<'EOF' "$CAPABILITIES_FILE" "$ADAPTER_FILE" "$PROFILE_FILE" "$INVOKE_FILE" "$HISTORY_FILE" "$PLUGIN_SDK_DIR"
const fs = require("node:fs");
const path = require("node:path");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const capabilities = readJson(2);
const adapter = readJson(3);
const profile = readJson(4);
const invoke = readJson(5);
const history = readJson(6);
const pluginSdkDir = path.resolve(process.argv[7]);
const raw = JSON.stringify({ capabilities, adapter, profile, invoke, history });

const capability = capabilities.capabilities?.find((item) => item.id === "sense.plugin.manifest_profile");
if (
  !capability
  || capability.service !== "openclaw-core"
  || capability.risk !== "low"
  || capability.governance !== "audit_only"
  || capability.requiresApproval === true
  || !capability.intents?.includes("plugin.manifest.profile")
) {
  throw new Error(`native plugin manifest profile capability mismatch: ${JSON.stringify(capability)}`);
}
if (
  !adapter.ok
  || adapter.registry !== "openclaw-native-plugin-adapter-v0"
  || adapter.mode !== "native-adapter-shell"
  || adapter.status !== "read_only_and_approval_gated_mutation_adapters_ready"
  || !adapter.implementedCapabilities?.includes("sense.plugin.manifest_profile")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.tool_catalog")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.workspace_semantic_index")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.workspace_symbol_lookup")
  || !adapter.implementedCapabilities?.includes("sense.openclaw.plugin_manifest_map")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.plugin_capability")
  || adapter.summary?.canReadManifestMetadata !== true
  || adapter.summary?.canReadToolCatalogMetadata !== true
  || adapter.summary?.canReadPluginManifestMapMetadata !== true
  || adapter.summary?.canPlanPluginCapabilityAbsorption !== true
  || adapter.summary?.canReadWorkspaceSemanticMetadata !== true
  || adapter.summary?.canExecuteWorkspaceSymbolLookup !== true
  || adapter.summary?.canReadSourceFileContent !== false
  || adapter.summary?.canExecutePluginCode !== false
  || adapter.summary?.canExecuteToolCode !== false
  || adapter.summary?.canActivateRuntime !== false
) {
  throw new Error(`native plugin adapter status mismatch: ${JSON.stringify(adapter)}`);
}
if (
  !profile.ok
  || profile.registry !== "openclaw-native-plugin-adapter-v0"
  || profile.mode !== "manifest-profile-only"
  || profile.adapterStatus !== "native_shell_active_manifest_only"
  || path.resolve(profile.workspace.path, "packages", "plugin-sdk") !== pluginSdkDir
  || profile.plugin?.id !== "openclaw.native.plugin-sdk"
  || profile.plugin?.packageName !== "@openclaw/plugin-sdk"
  || profile.plugin?.hasVersion !== true
  || profile.plugin?.hasTypes !== true
  || profile.plugin?.hasExports !== true
  || !profile.plugin?.exportKeys?.includes(".")
  || !profile.plugin?.exportKeys?.includes("./testing")
  || !profile.plugin?.scriptNames?.includes("build")
  || !profile.plugin?.scriptNames?.includes("test")
  || profile.plugin?.dependencySummary?.dependencies !== 1
  || profile.plugin?.dependencySummary?.devDependencies !== 1
  || !profile.capabilities?.some((item) => item.id === "sense.plugin.manifest_profile" && item.risk === "low")
  || profile.governance?.canReadSourceFileContent !== false
  || profile.governance?.exposesScriptBodies !== false
  || profile.governance?.exposesDependencyVersions !== false
  || profile.governance?.canExecutePluginCode !== false
  || profile.governance?.canActivateRuntime !== false
) {
  throw new Error(`native plugin manifest profile mismatch: ${JSON.stringify(profile)}`);
}
if (
  !invoke.ok
  || invoke.invoked !== true
  || invoke.blocked !== false
  || invoke.capability?.id !== "sense.plugin.manifest_profile"
  || invoke.policy?.decision !== "audit_only"
  || invoke.result?.plugin?.packageName !== "@openclaw/plugin-sdk"
  || invoke.summary?.kind !== "plugin.manifest_profile"
  || invoke.summary?.canExecutePluginCode !== false
) {
  throw new Error(`native plugin manifest profile invocation mismatch: ${JSON.stringify(invoke)}`);
}
if (
  history.summary?.byCapability?.["sense.plugin.manifest_profile"] !== 1
  || !history.items?.some((entry) => entry.capability?.id === "sense.plugin.manifest_profile" && entry.invoked === true && entry.blocked === false)
) {
  throw new Error(`native plugin manifest profile invocation history mismatch: ${JSON.stringify(history)}`);
}
for (const secret of [
  "ADAPTER_ROOT_SECRET_BUILD_BODY",
  "ADAPTER_ROOT_SECRET_TYPECHECK_BODY",
  "ADAPTER_ROOT_SECRET_README_CONTENT",
  "ADAPTER_SDK_SECRET_BUILD_BODY",
  "ADAPTER_SDK_SECRET_TEST_BODY",
  "ADAPTER_SDK_SECRET_README_CONTENT",
  "ADAPTER_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-adapter-secret-version",
  "0.0.0-native-adapter-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`native adapter must not expose README contents, source contents, script bodies, or version values: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginAdapter: {
    capability: capability.id,
    adapterStatus: adapter.status,
    profile: {
      packageName: profile.plugin.packageName,
      exportKeys: profile.plugin.exportKeys,
      scriptNames: profile.plugin.scriptNames,
      dependencySummary: profile.plugin.dependencySummary,
    },
    invocation: {
      policy: invoke.policy.decision,
      invoked: invoke.invoked,
      history: history.summary.byCapability,
    },
    governance: profile.governance,
  },
}, null, 2));
EOF
