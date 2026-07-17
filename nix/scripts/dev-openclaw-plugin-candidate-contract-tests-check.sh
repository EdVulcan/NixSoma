#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-candidate-contract-tests-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9960}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9961}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9962}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9963}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9964}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9965}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9966}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9967}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9998}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-candidate-contract-tests-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-candidate-contract-tests-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$SDK_SOURCE_DIR" \
  "$EXTENSIONS_DIR/web" \
  "$EXTENSIONS_DIR/memory"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export interface PluginCandidateContractTest {
  capabilityId: string;
  category: string;
}
export function createPluginCandidateContractTest(): PluginCandidateContractTest {
  return {
    capabilityId: "plan.openclaw.plugin_capability",
    category: "search_and_web",
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type PluginCandidateContractTestManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface PluginCandidateContractTestSource {
  capabilityId: string;
  approvalRequired: boolean;
}
export function definePluginCandidateContractTestSource(): PluginCandidateContractTestSource {
  return {
    capabilityId: "plan.openclaw.plugin_capability",
    approvalRequired: true,
  };
}
TS

cat > "$EXTENSIONS_DIR/web/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.web-search",
  "providers": ["exa"],
  "providerEndpoints": [
    {
      "name": "exa",
      "hosts": ["PLUGIN_CANDIDATE_CONTRACT_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "secretSchemaBody": {
        "type": "string",
        "description": "PLUGIN_CANDIDATE_CONTRACT_SECRET_SCHEMA_BODY"
      }
    }
  }
}
JSON
cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["PLUGIN_CANDIDATE_CONTRACT_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${REPORT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

REPORT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-candidate-contract-tests?category=search_and_web&limit=4" > "$REPORT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$REPORT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const report = readJson(2);
const history = readJson(3);
const approvals = readJson(4);
const tasks = readJson(5);
const raw = JSON.stringify({ report, history, approvals, tasks });

if (
  !report.ok
  || report.registry !== "openclaw-plugin-candidate-contract-tests-v0"
  || report.mode !== "candidate-native-adapter-contract-tests"
  || !report.sourceRegistries?.includes("openclaw-plugin-capability-plan-v0")
  || report.filter?.category !== "search_and_web"
) {
  throw new Error(`plugin candidate contract tests response mismatch: ${JSON.stringify(report)}`);
}
if (
  report.summary?.candidateCount !== 1
  || report.summary?.adapterContractCount !== 1
  || report.summary?.requiredTests !== report.summary?.passedRequired
  || report.summary?.failedRequired !== 0
  || report.summary?.nativeAdapterContractTestsReady !== true
  || report.summary?.runtimeAdapterImplemented !== false
  || report.summary?.requiresApproval !== 1
  || report.summary?.crossBoundaryCandidates !== 1
  || report.summary?.canReadManifestMetadata !== true
  || report.summary?.exposesManifestBodies !== false
  || report.summary?.exposesAuthEnvVarNames !== false
  || report.summary?.canImportModule !== false
  || report.summary?.canExecutePluginCode !== false
  || report.summary?.canActivateRuntime !== false
  || report.summary?.createsTask !== false
  || report.summary?.createsApproval !== false
) {
  throw new Error(`plugin candidate contract tests summary mismatch: ${JSON.stringify(report.summary)}`);
}
const candidate = report.candidates?.[0];
if (
  candidate?.manifestId !== "openclaw.web-search"
  || candidate?.category !== "search_and_web"
  || candidate?.proposedCapability?.risk !== "high"
  || candidate?.proposedCapability?.approvalRequired !== true
  || !candidate?.proposedCapability?.domains?.includes("cross_boundary")
  || candidate?.canImportModule !== false
  || candidate?.canExecutePluginCode !== false
  || candidate?.canActivateRuntime !== false
  || candidate?.contentExposed !== false
) {
  throw new Error(`plugin candidate contract tests selected wrong candidate: ${JSON.stringify(candidate)}`);
}
const adapterContract = report.adapterContracts?.[0];
if (
  adapterContract?.manifestId !== "openclaw.web-search"
  || adapterContract?.approvalRequired !== true
  || adapterContract?.runtimeOwner !== "openclaw_on_nixos"
  || adapterContract?.implementationStatus !== "contract_tests_ready_runtime_adapter_pending"
  || !adapterContract?.expectedNativeSurfaces?.includes("policy_approval_gate")
  || !adapterContract?.mustDenyBeforeFutureImplementation?.includes("execute_plugin_code")
) {
  throw new Error(`plugin candidate adapter contract mismatch: ${JSON.stringify(adapterContract)}`);
}
for (const testId of [
  "candidate_selected_from_manifest_plan",
  "native_contract_fields_declared",
  "runtime_adapter_gate_blocks_activation",
  "policy_approval_boundary_declared",
  "source_privacy_boundary_locked",
  "manifest_signals_are_metadata_only",
]) {
  const test = report.tests?.find((entry) => entry.id.endsWith(`:${testId}`));
  if (!test || test.status !== "passed") {
    throw new Error(`plugin candidate contract test should pass ${testId}: ${JSON.stringify(test)}`);
  }
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`plugin candidate contract tests must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`plugin candidate contract tests must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`plugin candidate contract tests must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "PLUGIN_CANDIDATE_CONTRACT_SECRET_ENDPOINT_TOKEN",
  "PLUGIN_CANDIDATE_CONTRACT_SECRET_SCHEMA_BODY",
  "PLUGIN_CANDIDATE_CONTRACT_SECRET_AUTH_ENV",
  "secretSchemaBody",
]) {
  if (raw.includes(secret)) {
    throw new Error(`plugin candidate contract tests leaked manifest body, auth env var name, schema body, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginCandidateContractTests: {
    registry: report.registry,
    category: report.summary.selectedCategory,
    required: `${report.summary.passedRequired}/${report.summary.requiredTests}`,
    contracts: report.summary.adapterContractCount,
    runtimeAdapterImplemented: report.summary.runtimeAdapterImplemented,
  },
}, null, 2));
EOF
