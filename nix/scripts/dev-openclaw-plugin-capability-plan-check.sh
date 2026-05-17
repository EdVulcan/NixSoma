#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-capability-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9940}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9941}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9942}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9943}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9944}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9945}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9946}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9947}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9996}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-capability-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-capability-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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
export interface PluginCapabilityPlanContract {
  capabilityId: string;
}
export function createPluginCapabilityPlanContract(): PluginCapabilityPlanContract {
  return { capabilityId: "plan.openclaw.plugin_capability" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type PluginCapabilityPlanManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface PluginCapabilityPlanEnhancedCapability {
  capabilityId: string;
}
export function definePluginCapabilityPlanEnhancedCapability(): PluginCapabilityPlanEnhancedCapability {
  return { capabilityId: "plan.openclaw.plugin_capability" };
}
TS

cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["PLUGIN_CAPABILITY_PLAN_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember", "recall"],
    "memory": ["workspace-index"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "secretSchemaBody": {
        "type": "string",
        "description": "PLUGIN_CAPABILITY_PLAN_SECRET_SCHEMA_BODY"
      }
    }
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
      "hosts": ["PLUGIN_CAPABILITY_PLAN_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
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
    "script": "PLUGIN_CAPABILITY_PLAN_SECRET_SCRIPT_BODY"
  }
}
JSON
cat > "$EXTENSIONS_DIR/channel/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.channel-discord",
  "channels": ["discord"],
  "channelEnvVars": {
    "discord": ["PLUGIN_CAPABILITY_PLAN_SECRET_CHANNEL_ENV"]
  },
  "contracts": {
    "tools": ["send"],
    "channel": ["bridge"]
  }
}
JSON

cleanup() {
  rm -f "${PLAN_FILE:-}" "${INVOKE_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

PLAN_FILE="$(mktemp)"
INVOKE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-capability-plan" > "$PLAN_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d '{"capabilityId":"plan.openclaw.plugin_capability","intent":"plugin.capability_plan","params":{"limit":4}}' \
  "$CORE_URL/capabilities/invoke" > "$INVOKE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=plan.openclaw.plugin_capability&limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$PLAN_FILE" "$INVOKE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const plan = readJson(2);
const invoke = readJson(3);
const history = readJson(4);
const approvals = readJson(5);
const tasks = readJson(6);
const raw = JSON.stringify({ plan, invoke, history, approvals, tasks });

if (
  !plan.ok
  || plan.registry !== "openclaw-plugin-capability-plan-v0"
  || plan.mode !== "manifest-derived-plan-only"
  || plan.capability?.id !== "plan.openclaw.plugin_capability"
  || plan.capability?.kind !== "plan"
  || plan.capability?.runtimeOwner !== "openclaw_on_nixos"
  || !plan.sourceRegistries?.includes("openclaw-plugin-manifest-map-v0")
) {
  throw new Error(`plugin capability plan response mismatch: ${JSON.stringify(plan)}`);
}
if (
  plan.summary?.candidateCount !== 4
  || plan.summary?.blockedCandidates < 3
  || plan.summary?.requiresApproval < 2
  || plan.summary?.requiresRuntimeAdapter < 3
  || plan.summary?.canReadManifestMetadata !== true
  || plan.summary?.exposesManifestBodies !== false
  || plan.summary?.exposesAuthEnvVarNames !== false
  || plan.summary?.exposesConfigSchemaBodies !== false
  || plan.summary?.canImportModule !== false
  || plan.summary?.canExecutePluginCode !== false
  || plan.summary?.canActivateRuntime !== false
  || plan.summary?.createsTask !== false
  || plan.summary?.createsApproval !== false
) {
  throw new Error(`plugin capability plan summary mismatch: ${JSON.stringify(plan.summary)}`);
}
for (const manifestId of ["openclaw.memory", "openclaw.web-search", "openclaw.media", "openclaw.channel-discord"]) {
  const candidate = plan.candidates?.find((item) => item.manifestId === manifestId);
  if (!candidate || candidate.canImportModule !== false || candidate.canExecutePluginCode !== false || candidate.canActivateRuntime !== false || candidate.contentExposed !== false) {
    throw new Error(`plugin capability plan missing safe candidate for ${manifestId}: ${JSON.stringify(candidate)}`);
  }
  if (!candidate.gates?.some((gate) => gate.id === "manifest_metadata_absorbed" && gate.status === "passed")) {
    throw new Error(`plugin capability candidate missing absorbed manifest gate for ${manifestId}: ${JSON.stringify(candidate.gates)}`);
  }
}
const webCandidate = plan.candidates.find((item) => item.manifestId === "openclaw.web-search");
if (webCandidate.proposedCapability.risk !== "high" || webCandidate.proposedCapability.approvalRequired !== true || !webCandidate.proposedCapability.domains.includes("cross_boundary")) {
  throw new Error(`web candidate should require high-risk cross-boundary approval: ${JSON.stringify(webCandidate)}`);
}
const channelCandidate = plan.candidates.find((item) => item.manifestId === "openclaw.channel-discord");
if (channelCandidate.proposedCapability.kind !== "act" || channelCandidate.proposedCapability.approvalRequired !== true) {
  throw new Error(`channel candidate should be act/approval-gated: ${JSON.stringify(channelCandidate)}`);
}
if (!invoke.ok || invoke.result?.registry !== "openclaw-plugin-capability-plan-v0") {
  throw new Error(`capability invoke should return plugin capability plan: ${JSON.stringify(invoke)}`);
}
if ((history.items ?? []).length !== 1 || history.items[0]?.capabilityId !== "plan.openclaw.plugin_capability") {
  throw new Error(`plugin capability plan invoke should create one capability history item: ${JSON.stringify(history.items)}`);
}
if ((approvals.items ?? []).length !== 0) {
  throw new Error(`plugin capability plan must not create approvals: ${JSON.stringify(approvals.items)}`);
}
if ((tasks.items ?? []).length !== 0) {
  throw new Error(`plugin capability plan must not create tasks: ${JSON.stringify(tasks.items)}`);
}
for (const secret of [
  "PLUGIN_CAPABILITY_PLAN_SECRET_AUTH_ENV",
  "PLUGIN_CAPABILITY_PLAN_SECRET_CHANNEL_ENV",
  "PLUGIN_CAPABILITY_PLAN_SECRET_SCHEMA_BODY",
  "PLUGIN_CAPABILITY_PLAN_SECRET_ENDPOINT_TOKEN",
  "PLUGIN_CAPABILITY_PLAN_SECRET_SCRIPT_BODY",
  "secretSchemaBody",
]) {
  if (raw.includes(secret)) {
    throw new Error(`plugin capability plan leaked manifest body, auth env var name, schema body, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginCapabilityPlan: {
    registry: plan.registry,
    candidates: plan.summary.candidateCount,
    blocked: plan.summary.blockedCandidates,
    approval: plan.summary.requiresApproval,
    history: history.items.length,
  },
}, null, 2));
EOF
