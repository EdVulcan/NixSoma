#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-sdk-native-contract-tests-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9390}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9391}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9392}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9393}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9394}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9395}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9396}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9397}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9460}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-sdk-native-contract-tests-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-sdk-native-contract-tests-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$SDK_SOURCE_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-native-contract-tests-fixture",
  "private": true,
  "scripts": {
    "build": "echo NATIVE_CONTRACT_TESTS_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-native-contract-tests-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo NATIVE_CONTRACT_TESTS_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-native-contract-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface CapabilityContract {
  capabilityId: string;
  risk: "low" | "high";
}

export type PluginManifestContract = {
  pluginId: string;
};

export function createCapabilityContract(): CapabilityContract {
  const NATIVE_CONTRACT_TESTS_PACKAGE_SECRET_SOURCE = "must-not-leak";
  return { capabilityId: NATIVE_CONTRACT_TESTS_PACKAGE_SECRET_SOURCE, risk: "high" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export interface PluginPolicy {
  approval: boolean;
}
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface NativePluginCapability {
  capabilityId: string;
  approvalRequired: boolean;
  policyDomain: string;
}

export type NativePluginManifest = {
  pluginId: string;
  runtimeOwner: string;
};

export function defineNativeCapability(): NativePluginCapability {
  const NATIVE_CONTRACT_TESTS_ENHANCED_SOURCE_SECRET = "must-not-leak";
  return {
    capabilityId: NATIVE_CONTRACT_TESTS_ENHANCED_SOURCE_SECRET,
    approvalRequired: true,
    policyDomain: "cross_boundary",
  };
}
TS
cat > "$SDK_SOURCE_DIR/runtime.ts" <<'TS'
export const runtimePolicyVocabulary = {
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
  rm -f "${REPORT_FILE:-}" "${SUMMARY_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

REPORT_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-native-contract-tests" > "$REPORT_FILE"
curl --silent --fail "$CORE_URL/workspaces/openclaw-plugin-sdk-native-contract-tests/summary" > "$SUMMARY_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$REPORT_FILE" "$SUMMARY_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$SDK_SOURCE_DIR"
const fs = require("node:fs");
const path = require("node:path");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const report = readJson(2);
const summary = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const sdkSourceDir = path.resolve(process.argv[6]);
const raw = JSON.stringify({ report, summary, history, approvals });

if (
  !report.ok
  || report.registry !== "openclaw-plugin-sdk-native-contract-tests-v0"
  || report.mode !== "native-contract-tests"
  || !report.sourceRegistries?.includes("openclaw-plugin-sdk-source-content-review-v0")
  || !report.sourceRegistries?.includes("openclaw-native-plugin-contract-v0")
) {
  throw new Error(`native contract tests report mismatch: ${JSON.stringify(report)}`);
}
if (
  path.resolve(report.enhancedSource?.root ?? "") !== sdkSourceDir
  || report.enhancedSource?.present !== true
  || report.summary?.enhancedSourceFilesRead < 2
  || report.summary?.sourcePackageFilesRead < 2
  || report.summary?.exportStatements < 5
  || report.summary?.interfaceDeclarations < 2
  || report.summary?.typeDeclarations < 1
  || report.summary?.functionDeclarations < 2
  || report.summary?.capabilityVocabularyFiles < 1
) {
  throw new Error(`native contract tests should derive signals from package and enhanced src/plugin-sdk roots: ${JSON.stringify(report.summary)}`);
}
if (
  report.summary?.requiredTests !== report.summary?.passedRequired
  || report.summary?.failedRequired !== 0
  || report.summary?.nativeContractReadyForImplementation !== true
  || report.summary?.nativeCapabilities !== 11
  || report.summary?.canImportModule !== false
  || report.summary?.canExecutePluginCode !== false
  || report.summary?.canActivateRuntime !== false
  || report.summary?.createsTask !== false
  || report.summary?.createsApproval !== false
) {
  throw new Error(`native contract tests summary mismatch: ${JSON.stringify(report.summary)}`);
}
for (const testId of [
  "derived_source_signals_present",
  "enhanced_source_module_profiled",
  "native_contract_validates",
  "runtime_owner_locked",
  "plugin_identity_mapped",
  "manifest_profile_capability_mapped",
  "governed_invoke_capability_mapped",
  "capability_policy_fields_mapped",
  "source_content_not_imported",
]) {
  const test = report.tests?.find((entry) => entry.id === testId);
  if (!test || test.status !== "passed") {
    throw new Error(`native contract test ${testId} should pass: ${JSON.stringify(test)}`);
  }
}
const capabilities = report.contract?.capabilities ?? [];
if (
  !capabilities.some((capability) => capability.id === "sense.plugin.manifest_profile" && capability.kind === "sense" && capability.risk === "low" && capability.approval?.required === false)
  || !capabilities.some((capability) => capability.id === "sense.openclaw.tool_catalog" && capability.kind === "sense" && capability.risk === "low" && capability.approval?.required === false)
  || !capabilities.some((capability) => capability.id === "sense.openclaw.workspace_semantic_index" && capability.kind === "sense" && capability.risk === "low" && capability.approval?.required === false)
  || !capabilities.some((capability) => capability.id === "sense.openclaw.workspace_symbol_lookup" && capability.kind === "sense" && capability.risk === "low" && capability.approval?.required === false)
  || !capabilities.some((capability) => capability.id === "sense.openclaw.prompt_pack" && capability.kind === "sense" && capability.risk === "low" && capability.approval?.required === false)
  || !capabilities.some((capability) => capability.id === "sense.openclaw.plugin_manifest_map" && capability.kind === "sense" && capability.risk === "low" && capability.approval?.required === false)
  || !capabilities.some((capability) => capability.id === "act.plugin.capability.invoke" && capability.kind === "act" && capability.risk === "high" && capability.approval?.required === true && capability.audit?.required === true)
) {
  throw new Error(`native contract tests should expose mapped native capability contracts: ${JSON.stringify(capabilities)}`);
}
if (JSON.stringify(report.summary) !== JSON.stringify(summary.summary)) {
  throw new Error(`native contract tests summary endpoint should agree: ${JSON.stringify({ report: report.summary, summary: summary.summary })}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`native contract tests must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`native contract tests must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "NATIVE_CONTRACT_TESTS_ROOT_SECRET_BUILD_BODY",
  "NATIVE_CONTRACT_TESTS_SDK_SECRET_BUILD_BODY",
  "NATIVE_CONTRACT_TESTS_PACKAGE_SECRET_SOURCE",
  "NATIVE_CONTRACT_TESTS_ENHANCED_SOURCE_SECRET",
  "999.0.0-native-contract-secret-version",
  "0.0.0-native-contract-tests-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`native contract tests must not expose source text, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSdkNativeContractTests: {
    registry: report.registry,
    required: `${report.summary.passedRequired}/${report.summary.requiredTests}`,
    enhancedSourceFilesRead: report.summary.enhancedSourceFilesRead,
    nativeCapabilities: report.summary.nativeCapabilities,
    implementationReady: report.summary.nativeContractReadyForImplementation,
  },
}, null, 2));
EOF
