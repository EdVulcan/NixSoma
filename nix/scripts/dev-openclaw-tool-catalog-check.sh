#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-tool-catalog-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
TOOL_DOCS_DIR="$WORKSPACE_DIR/docs/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9410}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9411}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9412}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9413}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9414}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9415}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9416}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9417}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9480}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-tool-catalog-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-tool-catalog-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR" "$TOOLS_DIR" "$TOOL_DOCS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-tool-catalog-secret-version",
  "private": true,
  "scripts": {
    "build": "echo TOOL_CATALOG_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-tool-catalog-plugin-secret-version",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo TOOL_CATALOG_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-tool-catalog-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface ToolCatalogCapabilityContract {
  capabilityId: string;
}
export function createToolCatalogCapabilityContract(): ToolCatalogCapabilityContract {
  const TOOL_CATALOG_PLUGIN_SDK_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: TOOL_CATALOG_PLUGIN_SDK_SECRET_SOURCE };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ToolCatalogPluginManifestContract = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ToolCatalogEnhancedOpenClawCapability {
  tool: string;
  policy: string;
}
export function defineToolCatalogEnhancedOpenClawCapability(): ToolCatalogEnhancedOpenClawCapability {
  const TOOL_CATALOG_ENHANCED_SDK_SECRET_SOURCE = "must-not-leak";
  return { tool: TOOL_CATALOG_ENHANCED_SDK_SECRET_SOURCE, policy: "catalog" };
}
TS
cat > "$TOOLS_DIR/image-generate-tool.ts" <<'TS'
export function imageGenerateTool() {
  const TOOL_CATALOG_IMAGE_TOOL_SECRET_SOURCE = "must-not-leak";
  return TOOL_CATALOG_IMAGE_TOOL_SECRET_SOURCE;
}
TS
cat > "$TOOLS_DIR/web-fetch.ts" <<'TS'
export function webFetchTool() {
  const TOOL_CATALOG_WEB_FETCH_SECRET_SOURCE = "must-not-leak";
  return TOOL_CATALOG_WEB_FETCH_SECRET_SOURCE;
}
TS
cat > "$TOOLS_DIR/sessions-send-tool.ts" <<'TS'
export function sessionsSendTool() {
  const TOOL_CATALOG_SESSION_TOOL_SECRET_SOURCE = "must-not-leak";
  return TOOL_CATALOG_SESSION_TOOL_SECRET_SOURCE;
}
TS
cat > "$TOOLS_DIR/cron-tool.ts" <<'TS'
export function cronTool() {
  const TOOL_CATALOG_CRON_TOOL_SECRET_SOURCE = "must-not-leak";
  return TOOL_CATALOG_CRON_TOOL_SECRET_SOURCE;
}
TS
cat > "$TOOLS_DIR/web-fetch.test.ts" <<'TS'
export const TOOL_CATALOG_TEST_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOL_DOCS_DIR/image-generation.md" <<'MD'
# Image generation

TOOL_CATALOG_IMAGE_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/web-fetch.md" <<'MD'
# Web fetch

TOOL_CATALOG_WEB_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/subagents.md" <<'MD'
# Subagents

TOOL_CATALOG_SUBAGENT_DOC_SECRET_BODY must not leak.
MD

cleanup() {
  rm -f "${CATALOG_FILE:-}" "${SUMMARY_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CATALOG_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/openclaw-tool-catalog" > "$CATALOG_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-tool-catalog/summary" > "$SUMMARY_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$CATALOG_FILE" "$SUMMARY_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const catalog = readJson(2);
const summary = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const raw = JSON.stringify({ catalog, summary, history, approvals });

if (
  !catalog.ok
  || catalog.registry !== "openclaw-tool-catalog-v0"
  || catalog.mode !== "read-only-native-absorption"
  || catalog.capability?.id !== "sense.openclaw.tool_catalog"
  || catalog.capability?.runtimeOwner !== "openclaw_on_nixos"
  || !catalog.sourceRegistries?.includes("openclaw-native-plugin-sdk-contract-implementation-v0")
) {
  throw new Error(`tool catalog response mismatch: ${JSON.stringify(catalog)}`);
}
if (
  catalog.summary?.toolImplementationFiles !== 4
  || catalog.summary?.toolTestFiles !== 1
  || catalog.summary?.toolDocumentationFiles !== 3
  || catalog.summary?.documentedImplementations < 2
  || catalog.summary?.pluginSdkVocabularyFiles < 1
  || catalog.summary?.categoryCount < 3
  || catalog.summary?.canReadSourceFileContent !== false
  || catalog.summary?.exposesSourceFileContent !== false
  || catalog.summary?.exposesDocumentationContent !== false
  || catalog.summary?.canImportModule !== false
  || catalog.summary?.canExecuteToolCode !== false
  || catalog.summary?.canActivateRuntime !== false
  || catalog.summary?.createsTask !== false
  || catalog.summary?.createsApproval !== false
) {
  throw new Error(`tool catalog summary mismatch: ${JSON.stringify(catalog.summary)}`);
}
for (const toolName of ["image-generate-tool.ts", "web-fetch.ts", "sessions-send-tool.ts", "cron-tool.ts"]) {
  if (!catalog.catalog?.tools?.some((tool) => tool.fileName === toolName && tool.nativeSlot === "sense.openclaw.tool_catalog" && tool.contentRead === false)) {
    throw new Error(`tool catalog missing tool metadata for ${toolName}: ${JSON.stringify(catalog.catalog?.tools)}`);
  }
}
for (const category of ["media_generation", "web_and_gateway", "session_and_agents", "automation"]) {
  if (!catalog.catalog?.categories?.some((entry) => entry.category === category)) {
    throw new Error(`tool catalog missing category ${category}: ${JSON.stringify(catalog.catalog?.categories)}`);
  }
}
if (JSON.stringify(catalog.summary) !== JSON.stringify(summary.summary)) {
  throw new Error(`tool catalog summary endpoint should agree: ${JSON.stringify({ catalog: catalog.summary, summary: summary.summary })}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`tool catalog must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`tool catalog must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "TOOL_CATALOG_ROOT_SECRET_BUILD_BODY",
  "TOOL_CATALOG_SDK_SECRET_BUILD_BODY",
  "TOOL_CATALOG_PLUGIN_SDK_SECRET_SOURCE",
  "TOOL_CATALOG_ENHANCED_SDK_SECRET_SOURCE",
  "TOOL_CATALOG_IMAGE_TOOL_SECRET_SOURCE",
  "TOOL_CATALOG_WEB_FETCH_SECRET_SOURCE",
  "TOOL_CATALOG_SESSION_TOOL_SECRET_SOURCE",
  "TOOL_CATALOG_CRON_TOOL_SECRET_SOURCE",
  "TOOL_CATALOG_TEST_SECRET_SOURCE",
  "TOOL_CATALOG_IMAGE_DOC_SECRET_BODY",
  "TOOL_CATALOG_WEB_DOC_SECRET_BODY",
  "TOOL_CATALOG_SUBAGENT_DOC_SECRET_BODY",
  "999.0.0-tool-catalog-secret-version",
  "0.0.0-tool-catalog-secret-version",
  "0.0.0-tool-catalog-plugin-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`tool catalog must not expose source text, doc bodies, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawToolCatalog: {
    registry: catalog.registry,
    tools: catalog.summary.toolImplementationFiles,
    docs: catalog.summary.toolDocumentationFiles,
    categories: catalog.summary.categoryCount,
    documentedImplementations: catalog.summary.documentedImplementations,
  },
}, null, 2));
EOF
