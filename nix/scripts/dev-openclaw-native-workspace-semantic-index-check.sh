#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-workspace-semantic-index-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
TOOL_DOCS_DIR="$WORKSPACE_DIR/docs/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9450}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9451}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9452}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9453}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9454}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9455}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9456}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9457}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9520}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-workspace-semantic-index-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-workspace-semantic-index-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR" "$TOOLS_DIR" "$TOOL_DOCS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-semantic-index-secret-version",
  "private": true,
  "scripts": {
    "build": "echo SEMANTIC_INDEX_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-semantic-index-plugin-secret-version",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEMANTIC_INDEX_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-semantic-index-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface SemanticIndexCapabilityContract {
  capabilityId: string;
}
export function createSemanticIndexCapabilityContract(): SemanticIndexCapabilityContract {
  const SEMANTIC_INDEX_PLUGIN_SDK_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: SEMANTIC_INDEX_PLUGIN_SDK_SECRET_SOURCE };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SemanticIndexPluginManifestContract = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export const SEMANTIC_INDEX_ENHANCED_SDK_SECRET_SOURCE = "must-not-leak";
TS
cat > "$TOOLS_DIR/web-fetch.ts" <<'TS'
import { guardedFetch } from "./web-guarded-fetch";
export interface WebFetchToolInput {
  url: string;
}
export function createWebFetchTool(input: WebFetchToolInput) {
  const SEMANTIC_INDEX_WEB_FETCH_SECRET_SOURCE = "must-not-leak";
  return { tool: "web-fetch", capability: "network", policy: SEMANTIC_INDEX_WEB_FETCH_SECRET_SOURCE, input };
}
TS
cat > "$TOOLS_DIR/sessions-send-tool.ts" <<'TS'
export type SessionSendTarget = { sessionId: string };
export function createSessionSendTool(target: SessionSendTarget) {
  const SEMANTIC_INDEX_SESSION_SECRET_SOURCE = "must-not-leak";
  return { tool: "session-send", approval: false, target };
}
TS
cat > "$TOOLS_DIR/image-generate-tool.ts" <<'TS'
export class ImageGenerateTool {
  run() {
    const SEMANTIC_INDEX_IMAGE_SECRET_SOURCE = "must-not-leak";
    return SEMANTIC_INDEX_IMAGE_SECRET_SOURCE;
  }
}
TS
cat > "$TOOL_DOCS_DIR/web-fetch.md" <<'MD'
# Web fetch

SEMANTIC_INDEX_WEB_DOC_SECRET_BODY must not leak.
MD

cleanup() {
  rm -f "${CAPABILITIES_FILE:-}" "${INDEX_FILE:-}" "${INVOKE_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CAPABILITIES_FILE="$(mktemp)"
INDEX_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-semantic-index?scope=tools&limit=20" > "$INDEX_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"sense.openclaw.workspace_semantic_index","intent":"openclaw.workspace.semantic_index","params":{"scope":"tools","limit":20}}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=sense.openclaw.workspace_semantic_index&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$CAPABILITIES_FILE" "$INDEX_FILE" "$INVOKE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const capabilities = readJson(2);
const index = readJson(3);
const invoke = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ capabilities, index, invoke, history, approvals });

const capability = capabilities.capabilities?.find((item) => item.id === "sense.openclaw.workspace_semantic_index");
if (
  !capability
  || capability.service !== "openclaw-core"
  || capability.risk !== "low"
  || capability.governance !== "audit_only"
  || capability.requiresApproval === true
  || !capability.intents?.includes("openclaw.workspace.semantic_index")
) {
  throw new Error(`workspace semantic index capability mismatch: ${JSON.stringify(capability)}`);
}
if (
  !index.ok
  || index.registry !== "openclaw-native-plugin-adapter-v0"
  || index.mode !== "workspace-semantic-index-only"
  || index.capability?.id !== "sense.openclaw.workspace_semantic_index"
  || index.scope?.id !== "tools"
  || index.summary?.totalFiles !== 3
  || index.summary?.contentRead !== 3
  || index.summary?.exportStatements < 3
  || index.summary?.functionDeclarations < 2
  || index.summary?.semanticVocabularyFiles < 2
  || index.summary?.canReadSourceFileContent !== true
  || index.summary?.exposesSourceFileContent !== false
  || index.summary?.canExecuteToolCode !== false
  || index.governance?.outputMode !== "derived_signals_only"
  || !index.files?.every((file) => file.contentRead === true && file.contentExposed === false && file.signals)
) {
  throw new Error(`workspace semantic index mismatch: ${JSON.stringify(index)}`);
}
if (
  !invoke.ok
  || invoke.invoked !== true
  || invoke.blocked !== false
  || invoke.capability?.id !== "sense.openclaw.workspace_semantic_index"
  || invoke.policy?.decision !== "audit_only"
  || invoke.summary?.kind !== "openclaw.workspace_semantic_index"
  || invoke.summary?.contentRead !== 3
  || invoke.summary?.exposesSourceFileContent !== false
  || invoke.summary?.canExecuteToolCode !== false
) {
  throw new Error(`workspace semantic index invocation mismatch: ${JSON.stringify(invoke)}`);
}
if (
  history.summary?.byCapability?.["sense.openclaw.workspace_semantic_index"] !== 1
  || !history.items?.some((entry) => entry.capability?.id === "sense.openclaw.workspace_semantic_index" && entry.invoked === true && entry.blocked === false)
) {
  throw new Error(`workspace semantic index history mismatch: ${JSON.stringify(history)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`workspace semantic index must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "SEMANTIC_INDEX_ROOT_SECRET_BUILD_BODY",
  "SEMANTIC_INDEX_SDK_SECRET_BUILD_BODY",
  "SEMANTIC_INDEX_PLUGIN_SDK_SECRET_SOURCE",
  "SEMANTIC_INDEX_ENHANCED_SDK_SECRET_SOURCE",
  "SEMANTIC_INDEX_WEB_FETCH_SECRET_SOURCE",
  "SEMANTIC_INDEX_SESSION_SECRET_SOURCE",
  "SEMANTIC_INDEX_IMAGE_SECRET_SOURCE",
  "SEMANTIC_INDEX_WEB_DOC_SECRET_BODY",
  "999.0.0-semantic-index-secret-version",
  "0.0.0-semantic-index-secret-version",
  "0.0.0-semantic-index-plugin-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`workspace semantic index must not expose source text, docs, scripts, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeWorkspaceSemanticIndex: {
    capability: capability.id,
    files: index.summary.totalFiles,
    exports: index.summary.exportStatements,
    functions: index.summary.functionDeclarations,
    policy: invoke.policy.decision,
    history: history.summary.byCapability,
  },
}, null, 2));
EOF
