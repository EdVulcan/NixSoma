#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-capability-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9950}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9951}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9952}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9953}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9954}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9955}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9956}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9957}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9997}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-capability-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-plugin-capability-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$SDK_SOURCE_DIR" \
  "$EXTENSIONS_DIR/memory" \
  "$EXTENSIONS_DIR/web" \
  "$EXTENSIONS_DIR/media" \
  "$EXTENSIONS_DIR/channel"
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
export interface ObserverPluginCapabilityPlanContract {
  capabilityId: string;
}
export function createObserverPluginCapabilityPlanContract(): ObserverPluginCapabilityPlanContract {
  return { capabilityId: "plan.openclaw.plugin_capability" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverPluginCapabilityPlanManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface ObserverPluginCapabilityPlanEnhancedCapability {
  capabilityId: string;
}
export function defineObserverPluginCapabilityPlanEnhancedCapability(): ObserverPluginCapabilityPlanEnhancedCapability {
  return { capabilityId: "plan.openclaw.plugin_capability" };
}
TS

cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/web/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.web-search",
  "providers": ["exa"],
  "providerEndpoints": [
    {
      "name": "exa",
      "hosts": ["OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/media/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.media",
  "providers": ["runway"],
  "contracts": {
    "tools": ["image"],
    "media": ["render"]
  },
  "configContracts": {
    "script": "OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_SCRIPT_BODY"
  }
}
JSON
cat > "$EXTENSIONS_DIR/channel/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.channel-discord",
  "channels": ["discord"],
  "channelEnvVars": {
    "discord": ["OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_CHANNEL_ENV"]
  },
  "contracts": {
    "tools": ["send"],
    "channel": ["bridge"]
  }
}
JSON

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${PLAN_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
PLAN_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-capability-plan" > "$PLAN_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=plan.openclaw.plugin_capability&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$PLAN_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const plan = readJson(4);
const history = readJson(5);
const approvals = readJson(6);
const tasks = readJson(7);
const raw = JSON.stringify({ html, client, plan, history, approvals, tasks });

for (const token of [
  "OpenClaw Plugin Capability Plan",
  "plugin-capability-plan-registry",
  "plugin-capability-plan-candidates",
  "plugin-capability-plan-blocked",
  "plugin-capability-plan-approval",
  "plugin-capability-plan-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/plugin-capability-plan",
  "refreshPluginCapabilityPlan",
  "renderPluginCapabilityPlan",
  "plan.openclaw.plugin_capability",
  "Manifest-derived plugin capability plan",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (
  !plan.ok
  || plan.registry !== "openclaw-plugin-capability-plan-v0"
  || plan.summary?.candidateCount !== 4
  || plan.summary?.blockedCandidates < 3
  || plan.summary?.requiresApproval < 2
  || plan.governance?.canImportModule !== false
  || plan.governance?.canExecutePluginCode !== false
  || plan.governance?.canActivateRuntime !== false
  || plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
) {
  throw new Error(`Observer plugin capability plan response mismatch: ${JSON.stringify(plan)}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`Observer direct plugin capability plan read must not invoke capabilities: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`Observer plugin capability plan must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`Observer plugin capability plan must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_AUTH_ENV",
  "OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_CHANNEL_ENV",
  "OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_ENDPOINT_TOKEN",
  "OBSERVER_PLUGIN_CAPABILITY_PLAN_SECRET_SCRIPT_BODY",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer plugin capability plan leaked manifest body, auth env var name, schema body, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawPluginCapabilityPlan: {
    html: "visible",
    registry: plan.registry,
    candidates: plan.summary.candidateCount,
    blocked: plan.summary.blockedCandidates,
    approval: plan.summary.requiresApproval,
  },
}, null, 2));
EOF
