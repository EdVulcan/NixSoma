#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-denial-recovery-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_DENIAL_RECOVERY_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10030}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10031}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10032}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10033}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10034}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10035}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10036}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10037}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10038}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-denial-recovery-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-denial-recovery-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' -d "$payload"
}

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
export interface SearchWebDenialRecoveryContract {
  adapterId: string;
  requiresApproval: boolean;
}
export function createSearchWebDenialRecoveryContract(): SearchWebDenialRecoveryContract {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    requiresApproval: true,
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebDenialRecoveryManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface SearchWebDenialRecoverySourceContract {
  adapterId: string;
  networkDeferred: boolean;
}
export function defineSearchWebDenialRecoverySourceContract(): SearchWebDenialRecoverySourceContract {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    networkDeferred: true,
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
      "hosts": ["SEARCH_WEB_DENIAL_RECOVERY_SECRET_ENDPOINT.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["SEARCH_WEB_DENIAL_RECOVERY_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${DENIED_FILE:-}" \
    "${RECOVERED_FILE:-}" \
    "${DUPLICATE_RECOVERY_FILE:-}" \
    "${RECOVERED_BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${DEFERRED_FILE:-}" \
    "${HISTORY_FILE:-}" \
    "${APPROVALS_FILE:-}" \
    "${TASKS_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
DENIED_FILE="$(mktemp)"
RECOVERED_FILE="$(mktemp)"
DUPLICATE_RECOVERY_FILE="$(mktemp)"
RECOVERED_BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
DEFERRED_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!taskResponse.ok || taskResponse.registry !== "openclaw-plugin-search-web-adapter-task-v0") {
  throw new Error(`search/web task response mismatch before denial: ${JSON.stringify(taskResponse)}`);
}
if (taskResponse.task?.status !== "queued" || taskResponse.task?.restorable !== false) {
  throw new Error(`new search/web task should be queued and not yet restorable: ${JSON.stringify(taskResponse.task)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block search/web task before approval: ${JSON.stringify(blocked)}`);
}
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked search/web step should expose linked approval: ${JSON.stringify(blocked.approval)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-plugin-search-web-adapter-denial-recovery-check","reason":"deny search/web fixture before recovery"}' > "$DENIED_FILE"

denied_task_id="$(node - <<'EOF' "$DENIED_FILE"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

if (!denied.ok || denied.approval?.status !== "denied" || denied.task?.status !== "failed") {
  throw new Error(`denying search/web approval should fail task: ${JSON.stringify(denied)}`);
}
if (denied.task?.type !== "openclaw_search_web_adapter_invocation" || denied.task?.plan?.strategy !== "openclaw-search-web-adapter-v0") {
  throw new Error(`denied search/web task should retain native adapter plan: ${JSON.stringify(denied.task)}`);
}
if (denied.task?.restorable !== true) {
  throw new Error(`denied search/web task should be restorable: ${JSON.stringify(denied.task)}`);
}
if (denied.task?.policy?.request?.approved === true || denied.task?.policy?.decision?.approved === true) {
  throw new Error(`denied search/web task must not become approved: ${JSON.stringify(denied.task.policy)}`);
}
process.stdout.write(denied.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_task_id/recover" '{}' > "$RECOVERED_FILE"
curl --silent --output "$DUPLICATE_RECOVERY_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/tasks/$denied_task_id/recover" \
  -H 'content-type: application/json' \
  -d '{}' | grep -qx "409"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"

recovered_approval_id="$(node - <<'EOF' "$DENIED_FILE" "$RECOVERED_FILE" "$DUPLICATE_RECOVERY_FILE" "$HISTORY_FILE"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recovered = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicate = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const history = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));

if (!recovered.ok || recovered.task?.status !== "queued") {
  throw new Error(`recovering denied search/web task should create queued task: ${JSON.stringify(recovered)}`);
}
if (recovered.task?.recovery?.recoveredFromTaskId !== denied.task?.id) {
  throw new Error(`recovered search/web task should link to denied source: ${JSON.stringify(recovered.task?.recovery)}`);
}
if (recovered.recoveredFromTask?.recoveredByTaskId !== recovered.task?.id) {
  throw new Error(`denied search/web task should link to recovered task: ${JSON.stringify(recovered.recoveredFromTask)}`);
}
if (recovered.task?.plan?.strategy !== "openclaw-search-web-adapter-v0" || recovered.task?.plan?.status !== "planned") {
  throw new Error(`recovered search/web task should reset native adapter plan: ${JSON.stringify(recovered.task?.plan)}`);
}
if (recovered.task?.policy?.request?.approved === true || recovered.task?.policy?.decision?.approved === true) {
  throw new Error(`recovered search/web task must not inherit approval: ${JSON.stringify(recovered.task?.policy)}`);
}
if (recovered.task?.policy?.decision?.decision !== "require_approval") {
  throw new Error(`recovered search/web task should require fresh approval: ${JSON.stringify(recovered.task?.policy)}`);
}
if (recovered.task?.approval?.required !== true || recovered.task?.approval?.status !== "pending") {
  throw new Error(`recovered search/web task should have fresh pending approval: ${JSON.stringify(recovered.task?.approval)}`);
}
if (recovered.task?.approval?.requestId === denied.approval?.id) {
  throw new Error(`recovered search/web task should not reuse denied approval id: ${JSON.stringify(recovered.task?.approval)}`);
}
if (duplicate.ok !== false || duplicate.recoveredByTaskId !== recovered.task?.id) {
  throw new Error(`duplicate search/web recovery should be rejected: ${JSON.stringify(duplicate)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0) {
  throw new Error(`search/web recovery must not invoke capabilities: ${JSON.stringify(history.summary)}`);
}
process.stdout.write(recovered.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_BLOCKED_FILE"
post_json "$CORE_URL/approvals/$recovered_approval_id/approve" '{"approvedBy":"dev-openclaw-plugin-search-web-adapter-denial-recovery-check","reason":"approve recovered search/web fixture"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?limit=120" > "$EVENTS_FILE"

node - <<'EOF' \
  "$DENIED_FILE" \
  "$RECOVERED_FILE" \
  "$RECOVERED_BLOCKED_FILE" \
  "$APPROVED_FILE" \
  "$DEFERRED_FILE" \
  "$HISTORY_FILE" \
  "$APPROVALS_FILE" \
  "$TASKS_FILE" \
  "$EVENTS_FILE" \
  "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const denied = readJson(2);
const recovered = readJson(3);
const recoveredBlocked = readJson(4);
const approved = readJson(5);
const deferred = readJson(6);
const history = readJson(7);
const approvals = readJson(8);
const tasks = readJson(9);
const events = readJson(10);
const querySecret = process.argv[11];
const raw = JSON.stringify({ denied, recovered, recoveredBlocked, approved, deferred, history, approvals, tasks, events });

if (!recoveredBlocked.ok || recoveredBlocked.ran !== false || recoveredBlocked.blocked !== true || recoveredBlocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block recovered search/web task before fresh approval: ${JSON.stringify(recoveredBlocked)}`);
}
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`fresh search/web approval should convert task to audited deferred execution: ${JSON.stringify(approved)}`);
}
if (!deferred.ok || deferred.ran !== false || deferred.blocked !== true || deferred.reason !== "search_web_runtime_preflight_deferred") {
  throw new Error(`approved search/web recovery should remain runtime-preflight deferred: ${JSON.stringify(deferred)}`);
}
if (deferred.task?.id !== recovered.task?.id || deferred.task?.status !== "queued") {
  throw new Error(`deferred search/web task should stay queued for future runtime preflight: ${JSON.stringify(deferred.task)}`);
}
if (deferred.execution !== null) {
  throw new Error(`operator response should not expose an execution body while blocked: ${JSON.stringify(deferred.execution)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`search/web denial recovery must not invoke capabilities or network providers: ${JSON.stringify(history.summary)}`);
}
if (approvals.summary?.counts?.denied !== 1 || approvals.summary?.counts?.approved !== 1 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should show one denial and one fresh approval: ${JSON.stringify(approvals.summary)}`);
}
if (tasks.summary?.counts?.failed !== 1 || tasks.summary?.counts?.queued !== 1 || tasks.summary?.counts?.recoverable !== 1) {
  throw new Error(`task summary should show failed source plus deferred recovered search/web task: ${JSON.stringify(tasks.summary)}`);
}

const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["approval.created", "approval.denied", "approval.approved", "task.recovered", "task.failed", "task.blocked"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_DENIAL_RECOVERY_SECRET_ENDPOINT",
  "SEARCH_WEB_DENIAL_RECOVERY_SECRET_AUTH_ENV",
]) {
  if (raw.includes(secret)) {
    throw new Error(`search/web denial recovery leaked query, endpoint, or auth env detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterDenialRecovery: {
    deniedTask: {
      id: denied.task.id,
      status: denied.task.status,
      recoveredByTaskId: recovered.recoveredFromTask?.recoveredByTaskId ?? null,
    },
    recoveredTask: {
      id: recovered.task.id,
      status: deferred.task.status,
      recoveredFromTaskId: recovered.task.recovery?.recoveredFromTaskId ?? null,
      deferredReason: deferred.reason,
    },
    approvals: approvals.summary,
    capabilityHistory: history.summary,
  },
}, null, 2));
EOF
