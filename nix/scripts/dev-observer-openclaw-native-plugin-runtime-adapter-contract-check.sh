#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-plugin-runtime-adapter-contract-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9370}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9371}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9372}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9373}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9374}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9375}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9376}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9377}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9440}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-plugin-runtime-adapter-contract-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-native-plugin-runtime-adapter-contract-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$WORKSPACE_DIR/extensions/provider-b" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
for index in $(seq 1 9); do mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"; done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-runtime-adapter-contract-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_RUNTIME_ADAPTER_CONTRACT_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-observer-runtime-adapter-contract-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${CONTRACT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
CONTRACT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/runtime-adapter-contract" > "$CONTRACT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$CONTRACT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const contract = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const tasks = readJson(7);
const raw = JSON.stringify({ html, client, contract, history, approvals, tasks });

for (const token of [
  "OpenClaw Native Runtime Adapter Contract",
  "native-plugin-runtime-contract-registry",
  "native-plugin-runtime-contract-status",
  "native-plugin-runtime-contract-required",
  "native-plugin-runtime-contract-runtime",
  "native-plugin-runtime-contract-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/runtime-adapter-contract",
  "refreshNativePluginRuntimeAdapterContract",
  "renderNativePluginRuntimeAdapterContract",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !contract.ok
  || contract.registry !== "openclaw-native-plugin-runtime-adapter-contract-v0"
  || contract.runtimeContract?.contractVersion !== "openclaw-native-plugin-runtime-adapter-contract-v0"
  || contract.summary?.adapterContractReady !== true
  || contract.summary?.blockedRequired !== 1
  || contract.summary?.canExecutePluginCode !== false
  || contract.summary?.canActivateRuntime !== false
  || contract.governance?.createsTask !== false
  || contract.governance?.createsApproval !== false
) {
  throw new Error(`Observer runtime adapter contract response mismatch: ${JSON.stringify(contract)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer runtime adapter contract must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer runtime adapter contract must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`Observer runtime adapter contract must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "OBSERVER_RUNTIME_ADAPTER_CONTRACT_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_ADAPTER_CONTRACT_SDK_SECRET_SOURCE_CONTENT",
  "0.0.0-observer-runtime-adapter-contract-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer runtime adapter contract leaked source, script, or package detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativePluginRuntimeAdapterContract: {
    html: "visible",
    registry: contract.registry,
    status: contract.status,
    adapterContractReady: contract.summary.adapterContractReady,
    blockedRequired: contract.summary.blockedRequired,
    runtimeActivation: contract.summary.canActivateRuntime,
  },
}, null, 2));
EOF
