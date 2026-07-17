#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-invoke-task-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9200}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9201}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9202}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9203}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9204}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9205}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9206}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9207}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9270}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-invoke-task-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-invoke-task-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$WORKSPACE_DIR/extensions/provider-a" \
  "$WORKSPACE_DIR/extensions/provider-b" \
  "$WORKSPACE_DIR/packages/memory-host-sdk" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$WORKSPACE_DIR/qa/smoke" \
  "$WORKSPACE_DIR/skills" \
  "$WORKSPACE_DIR/src/core" \
  "$WORKSPACE_DIR/test/unit" \
  "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

for index in $(seq 1 9); do
  mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"
done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-invoke-task-fixture",
  "private": true,
  "scripts": {
    "build": "echo INVOKE_TASK_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-invoke-task-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo INVOKE_TASK_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-invoke-task-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const INVOKE_TASK_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f \
    "${DENIED_FILE:-}" \
    "${TASK_FILE:-}" \
    "${PENDING_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${HISTORY_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

DENIED_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
PENDING_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

curl --silent --output "$DENIED_FILE" --write-out "%{http_code}" \
  -H "content-type: application/json" \
  -d '{"capabilityId":"act.plugin.capability.invoke"}' \
  "$CORE_URL/plugins/native-adapter/invoke-tasks" | grep -qx "400"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"act.plugin.capability.invoke","confirm":true}' \
  "$CORE_URL/plugins/native-adapter/invoke-tasks" > "$TASK_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$PENDING_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{}' \
  "$CORE_URL/operator/step" > "$BLOCKED_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/events/recent?limit=30" > "$EVENTS_FILE" || true

node - <<'EOF' "$DENIED_FILE" "$TASK_FILE" "$PENDING_FILE" "$BLOCKED_FILE" "$HISTORY_FILE" "$EVENTS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const denied = readJson(2);
const response = readJson(3);
const pending = readJson(4);
const blocked = readJson(5);
const history = readJson(6);
const eventsText = readText(7);
const raw = JSON.stringify({ denied, response, pending, blocked, history, eventsText });

if (!denied.error?.includes("confirm=true")) {
  throw new Error(`native plugin invoke task should require confirm=true: ${JSON.stringify(denied)}`);
}
if (
  !response.ok
  || response.registry !== "openclaw-native-plugin-invoke-task-v0"
  || response.mode !== "approval-gated"
  || response.sourceRegistry !== "openclaw-native-plugin-invoke-plan-v0"
  || response.capability?.id !== "act.plugin.capability.invoke"
  || response.task?.type !== "native_plugin_capability"
  || response.task?.status !== "queued"
  || response.task?.workViewStrategy !== "native-plugin-adapter"
  || response.task?.policy?.decision?.decision !== "require_approval"
  || response.task?.policy?.decision?.reason !== "native_plugin_capability_invoke_requires_explicit_user_approval"
  || response.task?.approval?.required !== true
  || response.approval?.status !== "pending"
  || response.approval?.taskId !== response.task?.id
  || response.governance?.createsTask !== true
  || response.governance?.createsApproval !== true
  || response.governance?.canExecutePluginCode !== false
  || response.governance?.canActivateRuntime !== false
  || response.governance?.executed !== false
) {
  throw new Error(`native plugin invoke task mismatch: ${JSON.stringify(response)}`);
}
if (
  !response.task?.plan
  || response.task.plan.strategy !== "native-plugin-invoke-v0"
  || response.task.plan.capabilitySummary?.approvalGates < 1
  || !response.task.plan.steps?.some((step) => step.capabilityId === "act.plugin.capability.invoke" && step.requiresApproval === true)
) {
  throw new Error(`native plugin invoke task plan mismatch: ${JSON.stringify(response.task?.plan)}`);
}
if (pending.items?.length !== 1 || pending.items[0].id !== response.approval.id) {
  throw new Error(`approval inbox should contain native plugin pending approval: ${JSON.stringify(pending.items)}`);
}
if (
  !blocked.ok
  || blocked.ran !== false
  || blocked.blocked !== true
  || blocked.reason !== "policy_requires_approval"
  || blocked.task?.id !== response.task.id
  || blocked.approval?.id !== response.approval.id
) {
  throw new Error(`operator should block native plugin invoke task before approval: ${JSON.stringify(blocked)}`);
}
if ((history.items ?? []).some((entry) => entry.capability?.id === "act.plugin.capability.invoke")) {
  throw new Error(`native plugin invoke task materialization must not execute plugin capability: ${JSON.stringify(history.items)}`);
}
for (const secret of [
  "INVOKE_TASK_ROOT_SECRET_BUILD_BODY",
  "INVOKE_TASK_SDK_SECRET_BUILD_BODY",
  "INVOKE_TASK_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-invoke-task-secret-version",
  "0.0.0-invoke-task-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`invoke task materialization must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginInvokeTask: {
    registry: response.registry,
    mode: response.mode,
    task: {
      id: response.task.id,
      status: response.task.status,
      type: response.task.type,
      approval: response.task.approval,
    },
    approval: {
      id: response.approval.id,
      status: response.approval.status,
      reason: response.approval.reason,
    },
    blocked: {
      reason: blocked.reason,
      ran: blocked.ran,
    },
    governance: response.governance,
  },
}, null, 2));
EOF
