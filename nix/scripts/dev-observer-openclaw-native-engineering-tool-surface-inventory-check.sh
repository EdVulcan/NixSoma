#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-tool-surface-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

source "$SCRIPT_DIR/openclaw-engineering-tool-surface-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9980}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9981}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9982}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9983}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9984}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9985}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9986}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9987}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9988}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-tool-surface-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-tool-surface-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_tool_surface_fixture "$WORKSPACE_DIR" "OBSERVER_ENGINEERING_TOOL_SURFACE"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${INVENTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
INVENTORY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-tool-surface" > "$INVENTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$INVENTORY_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const inventory = readJson(4);
const raw = JSON.stringify({ html, client, inventory });

for (const token of [
  "OpenClaw Engineering Tool Surface",
  "engineering-tool-surface-registry",
  "engineering-tool-surface-tools",
  "engineering-tool-surface-deferred",
  "engineering-tool-surface-execution",
  "engineering-tool-surface-mode",
  "engineering-tool-surface-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering tool surface token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-tool-surface",
  "refreshEngineeringToolSurface",
  "renderEngineeringToolSurface",
  "Native governed engineering tool surface inventory",
  "read-only-tool-contract-mapping",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering tool surface token: ${token}`);
  }
}
if (
  !inventory.ok
  || inventory.registry !== "openclaw-native-engineering-tool-surface-inventory-v0"
  || inventory.summary?.totalTools !== 10
  || inventory.summary?.coveredTools !== 10
  || inventory.governance?.observerVisible !== true
  || inventory.governance?.canExecuteToolCode !== false
  || inventory.governance?.canRunVerification !== false
  || inventory.governance?.canStartLsp !== false
  || inventory.governance?.canMutate !== false
) {
  throw new Error(`Observer engineering tool surface inventory mismatch: ${JSON.stringify(inventory)}`);
}
for (const toolName of ["cc_read", "cc_grep", "cc_lsp", "cc_verify", "cc_todo_write"]) {
  if (!inventory.tools?.some((tool) => tool.sourceToolName === toolName && tool.sourceEvidence?.indexMentioned === true)) {
    throw new Error(`Observer engineering tool surface missing ${toolName}`);
  }
}
for (const secret of [
  "OBSERVER_ENGINEERING_TOOL_SURFACE_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_ENGINEERING_TOOL_SURFACE_INDEX_SECRET_SOURCE",
  "OBSERVER_ENGINEERING_TOOL_SURFACE_tools_FileReadTool_ts_SECRET_SOURCE",
  "OBSERVER_ENGINEERING_TOOL_SURFACE_lsp_LSPTool_ts_SECRET_SOURCE",
  "0.0.0-OBSERVER_ENGINEERING_TOOL_SURFACE-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer engineering tool surface leaked source text or package details: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringToolSurfaceInventory: {
    html: "visible",
    client: "visible",
    registry: inventory.registry,
    tools: inventory.summary.totalTools,
    execution: inventory.governance.canExecuteToolCode,
  },
}, null, 2));
EOF
