#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-activation-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9260}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9261}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9262}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9263}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9264}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9265}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9266}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9267}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9330}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-runtime-activation-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-activation-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$WORKSPACE_DIR/extensions/provider-b" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
for index in $(seq 1 9); do mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"; done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-runtime-activation-plan-fixture",
  "private": true,
  "scripts": {
    "build": "echo RUNTIME_ACTIVATION_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-runtime-activation-plan-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo RUNTIME_ACTIVATION_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-runtime-activation-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const RUNTIME_ACTIVATION_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f "${PLAN_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

PLAN_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/runtime-activation-plan" > "$PLAN_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"

node - <<'EOF' "$PLAN_FILE" "$HISTORY_FILE" "$APPROVALS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const plan = readJson(2);
const history = readJson(3);
const approvals = readJson(4);
const raw = JSON.stringify({ plan, history, approvals });

if (
  !plan.ok
  || plan.registry !== "openclaw-native-plugin-runtime-activation-plan-v0"
  || plan.mode !== "activation-plan-only"
  || plan.status !== "blocked_pending_runtime_adapter"
  || plan.activationReady !== false
  || plan.sourceRegistry !== "openclaw-native-plugin-runtime-preflight-v0"
  || plan.executionEnvelope?.envelopeVersion !== "native-plugin-execution-envelope-v0"
  || plan.executionEnvelope?.state !== "blocked_pending_runtime_adapter"
) {
  throw new Error(`runtime activation plan mismatch: ${JSON.stringify(plan)}`);
}
if (
  plan.summary?.activationReady !== false
  || plan.summary?.requiredGates !== 6
  || plan.summary?.passedRequired !== 3
  || plan.summary?.blockedRequired !== 3
  || plan.summary?.canReadSourceFileContent !== false
  || plan.summary?.canImportModule !== false
  || plan.summary?.canExecutePluginCode !== false
  || plan.summary?.canActivateRuntime !== false
  || plan.summary?.createsTask !== false
  || plan.summary?.createsApproval !== false
) {
  throw new Error(`runtime activation summary mismatch: ${JSON.stringify(plan.summary)}`);
}
for (const id of [
  "source_content_review_required",
  "runtime_loader_adapter_required",
  "runtime_activation_approval_required",
]) {
  const gate = plan.gates?.find((item) => item.id === id);
  if (!gate || gate.required !== true || gate.status !== "blocked") {
    throw new Error(`runtime activation gate should be blocked: ${JSON.stringify(gate)}`);
  }
}
if (
  plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
  || plan.governance?.canImportModule !== false
  || plan.governance?.canExecutePluginCode !== false
  || plan.governance?.canActivateRuntime !== false
  || plan.governance?.exposesScriptBodies !== false
  || plan.governance?.exposesDependencyVersions !== false
) {
  throw new Error(`runtime activation governance mismatch: ${JSON.stringify(plan.governance)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`runtime activation plan must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`runtime activation plan must not create approvals: ${JSON.stringify(approvals.items)}`);
}
for (const secret of [
  "RUNTIME_ACTIVATION_ROOT_SECRET_BUILD_BODY",
  "RUNTIME_ACTIVATION_SDK_SECRET_BUILD_BODY",
  "RUNTIME_ACTIVATION_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-runtime-activation-secret-version",
  "0.0.0-runtime-activation-plan-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`runtime activation plan must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginRuntimeActivationPlan: {
    registry: plan.registry,
    status: plan.status,
    passedRequired: plan.summary.passedRequired,
    blockedRequired: plan.summary.blockedRequired,
    activationReady: plan.activationReady,
  },
}, null, 2));
EOF
