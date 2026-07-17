#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-preflight-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9240}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9241}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9242}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9243}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9244}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9245}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9246}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9247}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9310}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-runtime-preflight-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-preflight-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$WORKSPACE_DIR/extensions/provider-b" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
for index in $(seq 1 9); do mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"; done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-runtime-preflight-fixture",
  "private": true,
  "scripts": {
    "build": "echo RUNTIME_PREFLIGHT_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-runtime-preflight-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo RUNTIME_PREFLIGHT_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-runtime-preflight-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const RUNTIME_PREFLIGHT_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${ADAPTER_FILE:-}" "${PREFLIGHT_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

ADAPTER_FILE="$(mktemp)"
PREFLIGHT_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/runtime-preflight" > "$PREFLIGHT_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$ADAPTER_FILE" "$PREFLIGHT_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const adapter = readJson(2);
const preflight = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const raw = JSON.stringify({ adapter, preflight, history, approvals });

if (
  !adapter.ok
  || !adapter.implementedCapabilities?.includes("plan.plugin.runtime_preflight")
  || adapter.summary?.canExecutePluginCode !== false
  || adapter.summary?.canActivateRuntime !== false
) {
  throw new Error(`adapter should expose runtime preflight without runtime activation: ${JSON.stringify(adapter)}`);
}
if (
  !preflight.ok
  || preflight.registry !== "openclaw-native-plugin-runtime-preflight-v0"
  || preflight.mode !== "preflight-only"
  || preflight.sourceRegistry !== "openclaw-native-plugin-invoke-plan-v0"
  || preflight.adapter?.status !== "preflight_ready_runtime_disabled"
  || preflight.adapter?.canLoadPluginModule !== false
  || preflight.adapter?.canExecutePluginCode !== false
  || preflight.adapter?.canActivateRuntime !== false
  || preflight.plugin?.id !== "openclaw.native.plugin-sdk"
  || preflight.plugin?.packageName !== "@openclaw/plugin-sdk"
  || preflight.capability?.id !== "act.plugin.capability.invoke"
  || preflight.capability?.approvalRequired !== true
) {
  throw new Error(`native plugin runtime preflight mismatch: ${JSON.stringify(preflight)}`);
}
const envelope = preflight.executionEnvelope;
if (
  envelope?.envelopeVersion !== "native-plugin-execution-envelope-v0"
  || envelope.state !== "blocked_pending_runtime_adapter"
  || envelope.policyDecision?.decision !== "require_approval"
  || envelope.approval?.required !== true
  || envelope.approval?.collected !== false
  || envelope.audit?.required !== true
  || envelope.audit?.ledger !== "capability_history"
  || envelope.permissions?.commandExecution !== true
  || envelope.permissions?.filesystemWrite !== true
  || envelope.constraints?.canReadManifestMetadata !== true
  || envelope.constraints?.canReadSourceFileContent !== false
  || envelope.constraints?.canImportModule !== false
  || envelope.constraints?.canExecutePluginCode !== false
  || envelope.constraints?.canActivateRuntime !== false
  || envelope.constraints?.canMutate !== false
  || envelope.constraints?.canCreateTask !== false
  || envelope.constraints?.canCreateApproval !== false
) {
  throw new Error(`runtime preflight envelope mismatch: ${JSON.stringify(envelope)}`);
}
if (
  preflight.governance?.createsTask !== false
  || preflight.governance?.createsApproval !== false
  || preflight.governance?.canImportModule !== false
  || preflight.governance?.canExecutePluginCode !== false
  || preflight.governance?.canActivateRuntime !== false
  || preflight.governance?.exposesScriptBodies !== false
  || preflight.governance?.exposesDependencyVersions !== false
) {
  throw new Error(`runtime preflight governance mismatch: ${JSON.stringify(preflight.governance)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`runtime preflight must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`runtime preflight must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "RUNTIME_PREFLIGHT_ROOT_SECRET_BUILD_BODY",
  "RUNTIME_PREFLIGHT_SDK_SECRET_BUILD_BODY",
  "RUNTIME_PREFLIGHT_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-runtime-preflight-secret-version",
  "0.0.0-runtime-preflight-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`runtime preflight must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginRuntimePreflight: {
    registry: preflight.registry,
    envelope: envelope.envelopeVersion,
    state: envelope.state,
    runtimeActivation: preflight.adapter.canActivateRuntime,
    capabilityInvocations: history.items.length,
    pendingApprovals: approvals.items.length,
  },
}, null, 2));
EOF
