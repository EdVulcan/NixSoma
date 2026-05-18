#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-adapter-contract-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9360}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9361}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9362}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9363}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9364}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9365}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9366}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9367}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9430}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-runtime-adapter-contract-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-adapter-contract-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$WORKSPACE_DIR/extensions/provider-b" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
for index in $(seq 1 9); do mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"; done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-runtime-adapter-contract-fixture",
  "private": true,
  "scripts": {
    "build": "echo RUNTIME_ADAPTER_CONTRACT_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "extensions/*"
  - "packages/*"
  - "ui"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-runtime-adapter-contract-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-runtime-adapter-contract-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${CONTRACT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

CONTRACT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/runtime-adapter-contract" > "$CONTRACT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$CONTRACT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const contract = readJson(2);
const history = readJson(3);
const approvals = readJson(4);
const tasks = readJson(5);
const raw = JSON.stringify({ contract, history, approvals, tasks });

if (
  !contract.ok
  || contract.registry !== "openclaw-native-plugin-runtime-adapter-contract-v0"
  || contract.mode !== "runtime-adapter-contract"
  || contract.sourceRegistry !== "openclaw-native-plugin-runtime-activation-plan-v0"
  || contract.status !== "contract_ready_runtime_loader_blocked"
  || contract.activationReady !== false
  || contract.adapter?.id !== "native-plugin-runtime-adapter-v0"
  || contract.adapter?.canImportModule !== false
  || contract.adapter?.canExecutePluginCode !== false
  || contract.adapter?.canActivateRuntime !== false
  || contract.plugin?.id !== "openclaw.native.plugin-sdk"
  || contract.plugin?.packageName !== "@openclaw/plugin-sdk"
  || contract.capability?.id !== "act.plugin.capability.invoke"
) {
  throw new Error(`native runtime adapter contract mismatch: ${JSON.stringify(contract)}`);
}
const runtimeContract = contract.runtimeContract;
if (
  runtimeContract?.contractVersion !== "openclaw-native-plugin-runtime-adapter-contract-v0"
  || runtimeContract.state !== "contract_ready_not_implemented"
  || runtimeContract.approval?.required !== true
  || runtimeContract.approval?.collected !== false
  || runtimeContract.isolation?.processIsolationRequired !== true
  || runtimeContract.isolation?.oldOpenClawModuleImportAllowed !== false
  || runtimeContract.isolation?.pluginModuleImportAllowed !== false
  || runtimeContract.isolation?.secretsMounted !== false
  || runtimeContract.execution?.canReadManifestMetadata !== true
  || runtimeContract.execution?.canReadSourceFileContent !== false
  || runtimeContract.execution?.canImportModule !== false
  || runtimeContract.execution?.canExecutePluginCode !== false
  || runtimeContract.execution?.canActivateRuntime !== false
  || runtimeContract.execution?.canMutate !== false
  || runtimeContract.privacy?.readmeContentExposed !== false
  || runtimeContract.privacy?.sourceFileContentExposed !== false
  || runtimeContract.privacy?.scriptBodiesExposed !== false
  || runtimeContract.privacy?.dependencyVersionsExposed !== false
  || runtimeContract.privacy?.packageVersionExposed !== false
  || runtimeContract.audit?.ledger !== "capability_history"
  || runtimeContract.audit?.activationTaskRequired !== true
  || runtimeContract.audit?.recoveryChainRequired !== true
) {
  throw new Error(`native runtime adapter contract boundary mismatch: ${JSON.stringify(runtimeContract)}`);
}
if (
  contract.summary?.requiredChecks !== 7
  || contract.summary?.passedRequired !== 6
  || contract.summary?.blockedRequired !== 1
  || contract.summary?.adapterContractReady !== true
  || contract.summary?.runtimeLoaderImplemented !== false
  || contract.summary?.canImportModule !== false
  || contract.summary?.canExecutePluginCode !== false
  || contract.summary?.canActivateRuntime !== false
  || contract.summary?.createsTask !== false
  || contract.summary?.createsApproval !== false
) {
  throw new Error(`native runtime adapter contract summary mismatch: ${JSON.stringify(contract.summary)}`);
}
if (!contract.checks?.some((check) => check.id === "runtime_loader_adapter_required" && check.status === "blocked")) {
  throw new Error(`runtime loader requirement should remain blocked: ${JSON.stringify(contract.checks)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`runtime adapter contract must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`runtime adapter contract must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`runtime adapter contract must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "RUNTIME_ADAPTER_CONTRACT_ROOT_SECRET_BUILD_BODY",
  "RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_BUILD_BODY",
  "RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-runtime-adapter-contract-secret-version",
  "0.0.0-runtime-adapter-contract-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`runtime adapter contract leaked source, script, dependency, or package detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginRuntimeAdapterContract: {
    registry: contract.registry,
    status: contract.status,
    adapterContractReady: contract.summary.adapterContractReady,
    blockedRequired: contract.summary.blockedRequired,
    runtimeActivation: contract.summary.canActivateRuntime,
    capabilityInvocations: history.items.length,
    pendingApprovals: approvals.items.length,
    tasks: tasks.items.length,
  },
}, null, 2));
EOF
