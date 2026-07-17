#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-tool-catalog-adapter-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
TOOL_DOCS_DIR="$WORKSPACE_DIR/docs/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9440}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9441}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9442}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9443}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9444}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9445}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9446}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9447}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9510}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-tool-catalog-adapter-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-native-tool-catalog-adapter-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR" "$TOOLS_DIR" "$TOOL_DOCS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-native-tool-adapter-secret-version",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_NATIVE_TOOL_ADAPTER_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-observer-native-tool-adapter-plugin-secret-version",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_NATIVE_TOOL_ADAPTER_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-observer-native-tool-adapter-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_NATIVE_TOOL_ADAPTER_PLUGIN_SDK_SECRET_SOURCE = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverNativeToolAdapterPluginManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export const OBSERVER_NATIVE_TOOL_ADAPTER_ENHANCED_SDK_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/web-fetch.ts" <<'TS'
export const OBSERVER_NATIVE_TOOL_ADAPTER_WEB_FETCH_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/web-search.ts" <<'TS'
export const OBSERVER_NATIVE_TOOL_ADAPTER_WEB_SEARCH_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/image-generate-tool.ts" <<'TS'
export const OBSERVER_NATIVE_TOOL_ADAPTER_IMAGE_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/subagents-tool.ts" <<'TS'
export const OBSERVER_NATIVE_TOOL_ADAPTER_SUBAGENT_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOL_DOCS_DIR/web-fetch.md" <<'MD'
# Web fetch

OBSERVER_NATIVE_TOOL_ADAPTER_WEB_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/image-generation.md" <<'MD'
# Image generation

OBSERVER_NATIVE_TOOL_ADAPTER_IMAGE_DOC_SECRET_BODY must not leak.
MD

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${PROFILE_FILE:-}" "${INVOKE_FILE:-}" "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
PROFILE_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/tool-catalog?category=web_and_gateway&limit=10" > "$PROFILE_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"sense.openclaw.tool_catalog","intent":"openclaw.tool.catalog","params":{"category":"web_and_gateway","limit":10}}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=sense.openclaw.tool_catalog&limit=5" > "$HISTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$PROFILE_FILE" "$INVOKE_FILE" "$HISTORY_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const profile = readJson(4);
const invoke = readJson(5);
const history = readJson(6);
const raw = JSON.stringify({ html, client, profile, invoke, history });

for (const token of [
  "OpenClaw Tool Catalog Adapter",
  "tool-catalog-adapter-registry",
  "tool-catalog-adapter-matches",
  "tool-catalog-adapter-categories",
  "tool-catalog-adapter-execution",
  "tool-catalog-adapter-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/tool-catalog",
  "refreshToolCatalogAdapter",
  "renderToolCatalogAdapter",
  "Native adapter invocation surface",
  "sense.openclaw.tool_catalog",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !profile.ok
  || profile.mode !== "tool-catalog-profile-only"
  || profile.summary?.matchedTools !== 2
  || profile.governance?.canExecuteToolCode !== false
  || profile.governance?.canActivateRuntime !== false
) {
  throw new Error(`Observer native tool catalog adapter profile mismatch: ${JSON.stringify(profile)}`);
}
if (
  !invoke.ok
  || invoke.invoked !== true
  || invoke.capability?.id !== "sense.openclaw.tool_catalog"
  || invoke.policy?.decision !== "audit_only"
  || invoke.summary?.kind !== "openclaw.tool_catalog"
) {
  throw new Error(`Observer native tool catalog adapter invocation mismatch: ${JSON.stringify(invoke)}`);
}
if (history.summary?.byCapability?.["sense.openclaw.tool_catalog"] !== 1) {
  throw new Error(`Observer native tool catalog adapter history mismatch: ${JSON.stringify(history)}`);
}
for (const secret of [
  "OBSERVER_NATIVE_TOOL_ADAPTER_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_NATIVE_TOOL_ADAPTER_SDK_SECRET_BUILD_BODY",
  "OBSERVER_NATIVE_TOOL_ADAPTER_PLUGIN_SDK_SECRET_SOURCE",
  "OBSERVER_NATIVE_TOOL_ADAPTER_ENHANCED_SDK_SECRET_SOURCE",
  "OBSERVER_NATIVE_TOOL_ADAPTER_WEB_FETCH_SECRET_SOURCE",
  "OBSERVER_NATIVE_TOOL_ADAPTER_WEB_SEARCH_SECRET_SOURCE",
  "OBSERVER_NATIVE_TOOL_ADAPTER_IMAGE_SECRET_SOURCE",
  "OBSERVER_NATIVE_TOOL_ADAPTER_SUBAGENT_SECRET_SOURCE",
  "OBSERVER_NATIVE_TOOL_ADAPTER_WEB_DOC_SECRET_BODY",
  "OBSERVER_NATIVE_TOOL_ADAPTER_IMAGE_DOC_SECRET_BODY",
  "999.0.0-observer-native-tool-adapter-secret-version",
  "0.0.0-observer-native-tool-adapter-secret-version",
  "0.0.0-observer-native-tool-adapter-plugin-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer native tool catalog adapter must not expose source text, doc bodies, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeToolCatalogAdapter: {
    html: "visible",
    mode: profile.mode,
    matchedTools: profile.summary.matchedTools,
    policy: invoke.policy.decision,
    history: history.summary.byCapability,
  },
}, null, 2));
EOF
