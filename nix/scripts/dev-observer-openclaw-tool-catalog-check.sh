#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-tool-catalog-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
TOOL_DOCS_DIR="$WORKSPACE_DIR/docs/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9420}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9421}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9422}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9423}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9424}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9425}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9426}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9427}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9490}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-tool-catalog-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-tool-catalog-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR" "$TOOLS_DIR" "$TOOL_DOCS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-tool-catalog-secret-version",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_TOOL_CATALOG_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-observer-tool-catalog-plugin-secret-version",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_TOOL_CATALOG_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-observer-tool-catalog-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface ObserverToolCatalogCapabilityContract {
  capabilityId: string;
}
export function createObserverToolCatalogCapabilityContract(): ObserverToolCatalogCapabilityContract {
  const OBSERVER_TOOL_CATALOG_PLUGIN_SDK_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: OBSERVER_TOOL_CATALOG_PLUGIN_SDK_SECRET_SOURCE };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverToolCatalogPluginManifestContract = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverToolCatalogEnhancedCapability {
  tool: string;
}
export function defineObserverToolCatalogEnhancedCapability(): ObserverToolCatalogEnhancedCapability {
  const OBSERVER_TOOL_CATALOG_ENHANCED_SDK_SECRET_SOURCE = "must-not-leak";
  return { tool: OBSERVER_TOOL_CATALOG_ENHANCED_SDK_SECRET_SOURCE };
}
TS
cat > "$TOOLS_DIR/image-generate-tool.ts" <<'TS'
export const OBSERVER_TOOL_CATALOG_IMAGE_TOOL_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/web-search.ts" <<'TS'
export const OBSERVER_TOOL_CATALOG_WEB_SEARCH_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/subagents-tool.ts" <<'TS'
export const OBSERVER_TOOL_CATALOG_SUBAGENTS_TOOL_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/pdf-tool.ts" <<'TS'
export const OBSERVER_TOOL_CATALOG_PDF_TOOL_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOL_DOCS_DIR/image-generation.md" <<'MD'
# Image generation

OBSERVER_TOOL_CATALOG_IMAGE_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/web.md" <<'MD'
# Web

OBSERVER_TOOL_CATALOG_WEB_DOC_SECRET_BODY must not leak.
MD
cat > "$TOOL_DOCS_DIR/subagents.md" <<'MD'
# Subagents

OBSERVER_TOOL_CATALOG_SUBAGENTS_DOC_SECRET_BODY must not leak.
MD

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${CATALOG_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
CATALOG_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-tool-catalog" > "$CATALOG_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$CATALOG_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const catalog = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ html, client, catalog, history, approvals });

for (const token of [
  "OpenClaw Tool Catalog",
  "openclaw-tool-catalog-registry",
  "openclaw-tool-catalog-tools",
  "openclaw-tool-catalog-docs",
  "openclaw-tool-catalog-categories",
  "openclaw-tool-catalog-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/openclaw-tool-catalog",
  "refreshOpenClawToolCatalog",
  "renderOpenClawToolCatalog",
  "First real read-only absorption",
  "sense.openclaw.tool_catalog",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !catalog.ok
  || catalog.registry !== "openclaw-tool-catalog-v0"
  || catalog.summary?.toolImplementationFiles !== 4
  || catalog.summary?.toolDocumentationFiles !== 3
  || catalog.summary?.categoryCount < 3
  || catalog.governance?.canReadSourceFileContent !== false
  || catalog.governance?.exposesSourceFileContent !== false
  || catalog.governance?.exposesDocumentationContent !== false
  || catalog.governance?.canImportModule !== false
  || catalog.governance?.canExecuteToolCode !== false
  || catalog.governance?.createsTask !== false
  || catalog.governance?.createsApproval !== false
) {
  throw new Error(`Observer tool catalog response mismatch: ${JSON.stringify(catalog)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer tool catalog must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer tool catalog must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_TOOL_CATALOG_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_TOOL_CATALOG_SDK_SECRET_BUILD_BODY",
  "OBSERVER_TOOL_CATALOG_PLUGIN_SDK_SECRET_SOURCE",
  "OBSERVER_TOOL_CATALOG_ENHANCED_SDK_SECRET_SOURCE",
  "OBSERVER_TOOL_CATALOG_IMAGE_TOOL_SECRET_SOURCE",
  "OBSERVER_TOOL_CATALOG_WEB_SEARCH_SECRET_SOURCE",
  "OBSERVER_TOOL_CATALOG_SUBAGENTS_TOOL_SECRET_SOURCE",
  "OBSERVER_TOOL_CATALOG_PDF_TOOL_SECRET_SOURCE",
  "OBSERVER_TOOL_CATALOG_IMAGE_DOC_SECRET_BODY",
  "OBSERVER_TOOL_CATALOG_WEB_DOC_SECRET_BODY",
  "OBSERVER_TOOL_CATALOG_SUBAGENTS_DOC_SECRET_BODY",
  "999.0.0-observer-tool-catalog-secret-version",
  "0.0.0-observer-tool-catalog-secret-version",
  "0.0.0-observer-tool-catalog-plugin-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer tool catalog must not expose source text, doc bodies, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawToolCatalog: {
    html: "visible",
    registry: catalog.registry,
    tools: catalog.summary.toolImplementationFiles,
    docs: catalog.summary.toolDocumentationFiles,
    categories: catalog.summary.categoryCount,
  },
}, null, 2));
EOF
