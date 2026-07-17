#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-native-plugin-sdk-contract-implementation-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"

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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-plugin-sdk-contract-implementation-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-native-plugin-sdk-contract-implementation-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-sdk-implementation-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_SDK_IMPLEMENTATION_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-observer-sdk-implementation-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_SDK_IMPLEMENTATION_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-observer-sdk-implementation-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface ObserverCapabilityContract {
  capabilityId: string;
}
export function createObserverCapabilityContract(): ObserverCapabilityContract {
  const OBSERVER_SDK_IMPLEMENTATION_PACKAGE_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: OBSERVER_SDK_IMPLEMENTATION_PACKAGE_SECRET_SOURCE };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverPluginManifestContract = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverEnhancedOpenClawCapability {
  tool: string;
  prompt: string;
  manifest: string;
}
export function defineObserverEnhancedOpenClawCapability(): ObserverEnhancedOpenClawCapability {
  const OBSERVER_SDK_IMPLEMENTATION_ENHANCED_SECRET_SOURCE = "must-not-leak";
  return { tool: OBSERVER_SDK_IMPLEMENTATION_ENHANCED_SECRET_SOURCE, prompt: "policy", manifest: "plugin" };
}
TS

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${IMPLEMENTATION_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
IMPLEMENTATION_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-sdk-contract-implementation" > "$IMPLEMENTATION_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$IMPLEMENTATION_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const implementation = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ html, client, implementation, history, approvals });

for (const token of [
  "OpenClaw Native SDK Contract Implementation",
  "native-sdk-implementation-registry",
  "native-sdk-implementation-slots",
  "native-sdk-implementation-readonly",
  "native-sdk-implementation-executable",
  "native-sdk-implementation-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/openclaw-native-plugin-sdk-contract-implementation",
  "refreshNativeSdkContractImplementation",
  "renderNativeSdkContractImplementation",
  "stable OpenClawOnNixOS-owned absorption slots",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !implementation.ok
  || implementation.registry !== "openclaw-native-plugin-sdk-contract-implementation-v0"
  || implementation.summary?.implementedSlots !== 10
  || implementation.summary?.totalSlots !== 10
  || implementation.summary?.readOnlySlots !== 6
  || implementation.summary?.executableSlots !== 3
  || implementation.summary?.readyForFirstReadOnlyAbsorption !== true
  || implementation.governance?.canImportModule !== false
  || implementation.governance?.canExecutePluginCode !== false
  || implementation.governance?.createsTask !== false
  || implementation.governance?.createsApproval !== false
) {
  throw new Error(`Observer native SDK implementation response mismatch: ${JSON.stringify(implementation)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer native SDK implementation must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer native SDK implementation must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_SDK_IMPLEMENTATION_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_SDK_IMPLEMENTATION_SDK_SECRET_BUILD_BODY",
  "OBSERVER_SDK_IMPLEMENTATION_PACKAGE_SECRET_SOURCE",
  "OBSERVER_SDK_IMPLEMENTATION_ENHANCED_SECRET_SOURCE",
  "999.0.0-observer-sdk-implementation-secret-version",
  "0.0.0-observer-sdk-implementation-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer native SDK implementation must not expose source text, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativePluginSdkContractImplementation: {
    html: "visible",
    registry: implementation.registry,
    slots: `${implementation.summary.implementedSlots}/${implementation.summary.totalSlots}`,
    readOnlySlots: implementation.summary.readOnlySlots,
    executableSlots: implementation.summary.executableSlots,
  },
}, null, 2));
EOF
