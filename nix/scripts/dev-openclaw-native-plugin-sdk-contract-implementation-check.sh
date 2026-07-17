#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-sdk-contract-implementation-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"

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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-sdk-contract-implementation-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/native-plugin-sdk-contract-implementation-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-sdk-implementation-fixture",
  "private": true,
  "scripts": {
    "build": "echo SDK_IMPLEMENTATION_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-sdk-implementation-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SDK_IMPLEMENTATION_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-sdk-implementation-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface CapabilityContract {
  capabilityId: string;
  approvalRequired: boolean;
}
export function createCapabilityContract(): CapabilityContract {
  const SDK_IMPLEMENTATION_PACKAGE_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: SDK_IMPLEMENTATION_PACKAGE_SECRET_SOURCE, approvalRequired: true };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type PluginManifestContract = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface EnhancedOpenClawCapability {
  tool: string;
  prompt: string;
  manifest: string;
}
export function defineEnhancedOpenClawCapability(): EnhancedOpenClawCapability {
  const SDK_IMPLEMENTATION_ENHANCED_SECRET_SOURCE = "must-not-leak";
  return { tool: SDK_IMPLEMENTATION_ENHANCED_SECRET_SOURCE, prompt: "policy", manifest: "plugin" };
}
TS

cleanup() {
  rm -f "${IMPLEMENTATION_FILE:-}" "${SUMMARY_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

IMPLEMENTATION_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-sdk-contract-implementation" > "$IMPLEMENTATION_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-sdk-contract-implementation/summary" > "$SUMMARY_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$IMPLEMENTATION_FILE" "$SUMMARY_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const implementation = readJson(2);
const summary = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const raw = JSON.stringify({ implementation, summary, history, approvals });

if (
  !implementation.ok
  || implementation.registry !== "openclaw-native-plugin-sdk-contract-implementation-v0"
  || implementation.mode !== "native-sdk-contract-implementation"
  || implementation.runtimeOwner !== "openclaw_on_nixos"
  || !implementation.sourceRegistries?.includes("openclaw-plugin-sdk-native-contract-tests-v0")
  || !implementation.sourceRegistries?.includes("openclaw-native-plugin-registry-v0")
) {
  throw new Error(`native SDK implementation response mismatch: ${JSON.stringify(implementation)}`);
}
if (
  implementation.summary?.totalSlots !== 10
  || implementation.summary?.implementedSlots !== 10
  || implementation.summary?.missingSlots !== 0
  || implementation.summary?.readOnlySlots !== 6
  || implementation.summary?.executableSlots !== 3
  || implementation.summary?.nativeCapabilities !== 11
  || implementation.summary?.nativeContractTestsPassed !== true
  || implementation.summary?.readyForFirstReadOnlyAbsorption !== true
  || implementation.summary?.canImportModule !== false
  || implementation.summary?.canExecutePluginCode !== false
  || implementation.summary?.canActivateRuntime !== false
  || implementation.summary?.createsTask !== false
  || implementation.summary?.createsApproval !== false
) {
  throw new Error(`native SDK implementation summary mismatch: ${JSON.stringify(implementation.summary)}`);
}
for (const slotId of [
  "sense.plugin.manifest_profile",
  "sense.openclaw.tool_catalog",
  "sense.openclaw.workspace_semantic_index",
  "sense.openclaw.workspace_symbol_lookup",
  "act.openclaw.workspace_text_write",
  "act.openclaw.workspace_patch_apply",
  "sense.openclaw.prompt_pack",
  "sense.openclaw.plugin_manifest_map",
  "plan.openclaw.plugin_capability",
  "act.plugin.capability.invoke",
]) {
  const slot = implementation.implementationSlots?.find((entry) => entry.id === slotId);
  if (!slot || slot.status !== "implemented" || slot.runtimeOwner !== "openclaw_on_nixos") {
    throw new Error(`native SDK implementation missing slot ${slotId}: ${JSON.stringify(slot)}`);
  }
}
if (JSON.stringify(implementation.summary) !== JSON.stringify(summary.summary)) {
  throw new Error(`native SDK implementation summary endpoint should agree: ${JSON.stringify({ implementation: implementation.summary, summary: summary.summary })}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`native SDK implementation must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`native SDK implementation must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "SDK_IMPLEMENTATION_ROOT_SECRET_BUILD_BODY",
  "SDK_IMPLEMENTATION_SDK_SECRET_BUILD_BODY",
  "SDK_IMPLEMENTATION_PACKAGE_SECRET_SOURCE",
  "SDK_IMPLEMENTATION_ENHANCED_SECRET_SOURCE",
  "999.0.0-sdk-implementation-secret-version",
  "0.0.0-sdk-implementation-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`native SDK implementation must not expose source text, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginSdkContractImplementation: {
    registry: implementation.registry,
    slots: `${implementation.summary.implementedSlots}/${implementation.summary.totalSlots}`,
    readOnlySlots: implementation.summary.readOnlySlots,
    executableSlots: implementation.summary.executableSlots,
    readyForFirstReadOnlyAbsorption: implementation.summary.readyForFirstReadOnlyAbsorption,
  },
}, null, 2));
EOF
