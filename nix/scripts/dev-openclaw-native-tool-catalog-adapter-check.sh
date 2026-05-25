#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-tool-catalog-adapter-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
TOOL_DOCS_DIR="$WORKSPACE_DIR/docs/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9430}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9431}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9432}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9433}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9434}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9435}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9436}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9437}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9500}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-tool-catalog-adapter-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-tool-catalog-adapter-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR" "$TOOLS_DIR" "$TOOL_DOCS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-native-tool-adapter-secret-version",
  "private": true,
  "scripts": {
    "build": "echo NATIVE_TOOL_ADAPTER_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-native-tool-adapter-plugin-secret-version",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo NATIVE_TOOL_ADAPTER_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-native-tool-adapter-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface NativeToolAdapterCapabilityContract {
  capabilityId: string;
}
export function createNativeToolAdapterCapabilityContract(): NativeToolAdapterCapabilityContract {
  const NATIVE_TOOL_ADAPTER_PLUGIN_SDK_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: NATIVE_TOOL_ADAPTER_PLUGIN_SDK_SECRET_SOURCE };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type NativeToolAdapterPluginManifestContract = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface NativeToolAdapterEnhancedCapability {
  tool: string;
}
export function defineNativeToolAdapterEnhancedCapability(): NativeToolAdapterEnhancedCapability {
  const NATIVE_TOOL_ADAPTER_ENHANCED_SDK_SECRET_SOURCE = "must-not-leak";
  return { tool: NATIVE_TOOL_ADAPTER_ENHANCED_SDK_SECRET_SOURCE };
}
TS
cat > "$TOOLS_DIR/web-fetch.ts" <<'TS'
export const NATIVE_TOOL_ADAPTER_WEB_FETCH_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/web-search.ts" <<'TS'
export const NATIVE_TOOL_ADAPTER_WEB_SEARCH_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/image-generate-tool.ts" <<'TS'
export const NATIVE_TOOL_ADAPTER_IMAGE_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/sessions-send-tool.ts" <<'TS'
export const NATIVE_TOOL_ADAPTER_SESSION_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/web-fetch.test.ts" <<'TS'
export const NATIVE_TOOL_ADAPTER_TEST_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOL_DOCS_DIR/web-fetch.md" <<'MD'
# Web fetch

NATIVE_TOOL_ADAPTER_WEB_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/web.md" <<'MD'
# Web

NATIVE_TOOL_ADAPTER_WEB_INDEX_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/image-generation.md" <<'MD'
# Image generation

NATIVE_TOOL_ADAPTER_IMAGE_DOC_SECRET_BODY must not leak.
MD

cleanup() {
  rm -f "${CAPABILITIES_FILE:-}" "${ADAPTER_FILE:-}" "${PROFILE_FILE:-}" "${INVOKE_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CAPABILITIES_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
PROFILE_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/tool-catalog?category=web_and_gateway&limit=10" > "$PROFILE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"sense.openclaw.tool_catalog","intent":"openclaw.tool.catalog","params":{"category":"web_and_gateway","limit":10}}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=sense.openclaw.tool_catalog&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$CAPABILITIES_FILE" "$ADAPTER_FILE" "$PROFILE_FILE" "$INVOKE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const capabilities = readJson(2);
const adapter = readJson(3);
const profile = readJson(4);
const invoke = readJson(5);
const history = readJson(6);
const approvals = readJson(7);
const raw = JSON.stringify({ capabilities, adapter, profile, invoke, history, approvals });

const capability = capabilities.capabilities?.find((item) => item.id === "sense.openclaw.tool_catalog");
if (
  !capability
  || capability.service !== "openclaw-core"
  || capability.risk !== "low"
  || capability.governance !== "audit_only"
  || capability.requiresApproval === true
  || !capability.intents?.includes("openclaw.tool.catalog")
) {
  throw new Error(`native tool catalog capability mismatch: ${JSON.stringify(capability)}`);
}
if (
  !adapter.ok
  || adapter.status !== "read_only_and_approval_gated_mutation_adapters_ready"
  || !adapter.implementedCapabilities?.includes("sense.openclaw.tool_catalog")
  || adapter.summary?.canReadToolCatalogMetadata !== true
  || adapter.summary?.canExecuteToolCode !== false
  || adapter.summary?.canActivateRuntime !== false
) {
  throw new Error(`native adapter status should include tool catalog: ${JSON.stringify(adapter)}`);
}
if (
  !profile.ok
  || profile.registry !== "openclaw-native-plugin-adapter-v0"
  || profile.mode !== "tool-catalog-profile-only"
  || profile.adapterStatus !== "native_shell_active_tool_catalog_only"
  || profile.capability?.id !== "sense.openclaw.tool_catalog"
  || profile.filter?.category !== "web_and_gateway"
  || profile.summary?.matchedTools !== 2
  || profile.summary?.totalTools !== 4
  || profile.summary?.filterApplied !== true
  || !profile.tools?.every((tool) => tool.category === "web_and_gateway" && tool.contentRead === false)
  || profile.governance?.canReadSourceFileContent !== false
  || profile.governance?.exposesSourceFileContent !== false
  || profile.governance?.exposesDocumentationContent !== false
  || profile.governance?.canExecuteToolCode !== false
  || profile.governance?.canActivateRuntime !== false
  || profile.governance?.createsTask !== false
  || profile.governance?.createsApproval !== false
) {
  throw new Error(`native tool catalog adapter profile mismatch: ${JSON.stringify(profile)}`);
}
if (
  !invoke.ok
  || invoke.invoked !== true
  || invoke.blocked !== false
  || invoke.capability?.id !== "sense.openclaw.tool_catalog"
  || invoke.policy?.decision !== "audit_only"
  || invoke.result?.summary?.matchedTools !== 2
  || invoke.summary?.kind !== "openclaw.tool_catalog"
  || invoke.summary?.matchedTools !== 2
  || invoke.summary?.canExecuteToolCode !== false
) {
  throw new Error(`native tool catalog capability invocation mismatch: ${JSON.stringify(invoke)}`);
}
if (
  history.summary?.byCapability?.["sense.openclaw.tool_catalog"] !== 1
  || !history.items?.some((entry) => entry.capability?.id === "sense.openclaw.tool_catalog" && entry.invoked === true && entry.blocked === false)
) {
  throw new Error(`native tool catalog invocation history mismatch: ${JSON.stringify(history)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`read-only native tool catalog adapter must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "NATIVE_TOOL_ADAPTER_ROOT_SECRET_BUILD_BODY",
  "NATIVE_TOOL_ADAPTER_SDK_SECRET_BUILD_BODY",
  "NATIVE_TOOL_ADAPTER_PLUGIN_SDK_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_ENHANCED_SDK_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_WEB_FETCH_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_WEB_SEARCH_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_IMAGE_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_SESSION_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_TEST_SECRET_SOURCE",
  "NATIVE_TOOL_ADAPTER_WEB_DOC_SECRET_BODY",
  "NATIVE_TOOL_ADAPTER_WEB_INDEX_DOC_SECRET_BODY",
  "NATIVE_TOOL_ADAPTER_IMAGE_DOC_SECRET_BODY",
  "999.0.0-native-tool-adapter-secret-version",
  "0.0.0-native-tool-adapter-secret-version",
  "0.0.0-native-tool-adapter-plugin-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`native tool catalog adapter must not expose source text, doc bodies, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeToolCatalogAdapter: {
    capability: capability.id,
    adapterStatus: adapter.status,
    matchedTools: profile.summary.matchedTools,
    policy: invoke.policy.decision,
    history: history.summary.byCapability,
  },
}, null, 2));
EOF
