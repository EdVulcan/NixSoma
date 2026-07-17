#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-sdk-native-contract-tests-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9400}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9401}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9402}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9403}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9404}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9405}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9406}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9407}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9470}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-sdk-native-contract-tests-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-plugin-sdk-native-contract-tests-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-native-contract-tests-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_NATIVE_CONTRACT_TESTS_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-observer-native-contract-tests-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_NATIVE_CONTRACT_TESTS_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-observer-native-contract-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface ObserverCapabilityContract {
  capabilityId: string;
}

export type ObserverPluginPolicy = {
  approval: boolean;
};

export function createObserverCapabilityContract(): ObserverCapabilityContract {
  const OBSERVER_NATIVE_CONTRACT_TESTS_PACKAGE_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: OBSERVER_NATIVE_CONTRACT_TESTS_PACKAGE_SECRET_SOURCE };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export interface ObserverPluginManifest {
  pluginId: string;
}
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverNativeCapability {
  capabilityId: string;
  permission: string;
}

export type ObserverRuntimePolicy = {
  runtimeOwner: string;
  approvalRequired: boolean;
};

export function defineObserverNativeCapability(): ObserverNativeCapability {
  const OBSERVER_NATIVE_CONTRACT_TESTS_ENHANCED_SOURCE_SECRET = "must-not-leak";
  return {
    capabilityId: OBSERVER_NATIVE_CONTRACT_TESTS_ENHANCED_SOURCE_SECRET,
    permission: "commandExecution",
  };
}
TS
cat > "$SDK_SOURCE_DIR/policy.ts" <<'TS'
export const observerPolicyVocabulary = {
  capability: true,
  plugin: true,
  permission: true,
  policy: true,
  approval: true,
  runtime: true,
  manifest: true,
};
TS

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${REPORT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
REPORT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-native-contract-tests" > "$REPORT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$REPORT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const report = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const raw = JSON.stringify({ html, client, report, history, approvals });

for (const token of [
  "OpenClaw Plugin SDK Native Contract Tests",
  "plugin-sdk-native-tests-registry",
  "plugin-sdk-native-tests-required",
  "plugin-sdk-native-tests-source",
  "plugin-sdk-native-tests-caps",
  "plugin-sdk-native-tests-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/workspaces/openclaw-plugin-sdk-native-contract-tests",
  "refreshPluginSdkNativeContractTests",
  "renderPluginSdkNativeContractTests",
  "derived SDK source signals are checked against OpenClawOnNixOS-owned plugin/capability contracts",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !report.ok
  || report.registry !== "openclaw-plugin-sdk-native-contract-tests-v0"
  || report.summary?.requiredTests !== report.summary?.passedRequired
  || report.summary?.failedRequired !== 0
  || report.summary?.enhancedSourceFilesRead < 2
  || report.summary?.nativeCapabilities !== 11
  || report.governance?.canImportModule !== false
  || report.governance?.canExecutePluginCode !== false
  || report.governance?.createsTask !== false
  || report.governance?.createsApproval !== false
) {
  throw new Error(`Observer native contract tests report mismatch: ${JSON.stringify(report)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer native contract tests must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer native contract tests must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "OBSERVER_NATIVE_CONTRACT_TESTS_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_NATIVE_CONTRACT_TESTS_SDK_SECRET_BUILD_BODY",
  "OBSERVER_NATIVE_CONTRACT_TESTS_PACKAGE_SECRET_SOURCE",
  "OBSERVER_NATIVE_CONTRACT_TESTS_ENHANCED_SOURCE_SECRET",
  "999.0.0-observer-native-contract-secret-version",
  "0.0.0-observer-native-contract-tests-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer native contract tests must not expose source text, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawPluginSdkNativeContractTests: {
    html: "visible",
    registry: report.registry,
    required: `${report.summary.passedRequired}/${report.summary.requiredTests}`,
    enhancedSourceFilesRead: report.summary.enhancedSourceFilesRead,
    nativeCapabilities: report.summary.nativeCapabilities,
  },
}, null, 2));
EOF
