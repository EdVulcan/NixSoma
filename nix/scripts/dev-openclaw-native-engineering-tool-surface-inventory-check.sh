#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-tool-surface-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

source "$SCRIPT_DIR/openclaw-engineering-tool-surface-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9970}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9971}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9972}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9973}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9974}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9975}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9976}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9977}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9978}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-tool-surface-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-tool-surface-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_tool_surface_fixture "$WORKSPACE_DIR" "ENGINEERING_TOOL_SURFACE"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f "${INVENTORY_FILE:-}" "${ADAPTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

INVENTORY_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-tool-surface" > "$INVENTORY_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$INVENTORY_FILE" "$ADAPTER_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const inventory = readJson(2);
const adapter = readJson(3);
const raw = JSON.stringify({ inventory, adapter });
const requiredTools = [
  "cc_read",
  "cc_edit",
  "cc_write",
  "cc_glob",
  "cc_grep",
  "cc_lsp",
  "cc_verify",
  "cc_plan_enter",
  "cc_plan_exit",
  "cc_todo_write",
];

if (
  !inventory.ok
  || inventory.registry !== "openclaw-native-engineering-tool-surface-inventory-v0"
  || inventory.mode !== "read-only-tool-contract-mapping"
  || inventory.identityLevel !== "Level 1: stable user-space control plane"
  || inventory.summary?.totalTools !== 10
  || inventory.summary?.coveredTools !== 10
  || inventory.summary?.sourceFilesPresent !== inventory.summary?.sourceFilesExpected
  || inventory.summary?.canExecuteToolCode !== false
  || inventory.summary?.canRunVerification !== false
  || inventory.summary?.canStartLsp !== false
  || inventory.summary?.canMutate !== false
  || inventory.summary?.createsTask !== false
  || inventory.summary?.createsApproval !== false
  || inventory.governance?.canExecuteToolCode !== false
  || inventory.governance?.canMutate !== false
) {
  throw new Error(`engineering tool surface inventory mismatch: ${JSON.stringify(inventory)}`);
}
for (const toolName of requiredTools) {
  const tool = inventory.tools?.find((item) => item.sourceToolName === toolName);
  if (
    !tool
    || typeof tool.intendedNativeCapabilityId !== "string"
    || typeof tool.operationClass !== "string"
    || typeof tool.riskLevel !== "string"
    || tool.domain !== "workspace_engineering"
    || typeof tool.approvalExpectation !== "string"
    || typeof tool.auditExpectation !== "string"
    || typeof tool.observerVisibilityExpectation !== "string"
    || typeof tool.migrationStatus !== "string"
    || typeof tool.deferredExecutionBoundary !== "string"
    || tool.sourceEvidence?.indexMentioned !== true
  ) {
    throw new Error(`missing or incomplete engineering tool contract for ${toolName}: ${JSON.stringify(tool)}`);
  }
}
const edit = inventory.tools.find((item) => item.sourceToolName === "cc_edit");
const verify = inventory.tools.find((item) => item.sourceToolName === "cc_verify");
const lsp = inventory.tools.find((item) => item.sourceToolName === "cc_lsp");
if (
  edit.riskLevel !== "high"
  || !edit.intendedNativeCapabilityId.includes("edit_proposal")
  || verify.operationClass !== "verification_command_evidence"
  || !verify.deferredExecutionBoundary.includes("no shell or verification command is run")
  || lsp.operationClass !== "read_only_language_intelligence"
  || !lsp.deferredExecutionBoundary.includes("no language server is started")
) {
  throw new Error(`tool-specific contract mismatch: ${JSON.stringify({ edit, verify, lsp })}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool_surface_inventory")
  || adapter.summary?.canReadEngineeringToolSurfaceMetadata !== true
  || adapter.summary?.canExecuteToolCode !== false
) {
  throw new Error(`native adapter status missing engineering tool surface inventory: ${JSON.stringify(adapter)}`);
}
for (const secret of [
  "ENGINEERING_TOOL_SURFACE_ROOT_SECRET_BUILD_BODY",
  "ENGINEERING_TOOL_SURFACE_INDEX_SECRET_SOURCE",
  "ENGINEERING_TOOL_SURFACE_tools_FileReadTool_ts_SECRET_SOURCE",
  "ENGINEERING_TOOL_SURFACE_lsp_LSPTool_ts_SECRET_SOURCE",
  "0.0.0-ENGINEERING_TOOL_SURFACE-secret-version",
]) {
  if (raw.includes(secret)) {
    throw new Error(`engineering tool surface inventory leaked source text or package details: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringToolSurfaceInventory: {
    registry: inventory.registry,
    tools: inventory.summary.totalTools,
    covered: inventory.summary.coveredTools,
    execution: inventory.governance.canExecuteToolCode,
    next: inventory.summary.nextRecommendedSlice,
  },
}, null, 2));
EOF
