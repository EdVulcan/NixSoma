#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-denial-recovery-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10210}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10211}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10212}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10213}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10214}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10215}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10216}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10217}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10218}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-provider-runtime-sandbox-denial-recovery-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-denial-recovery-check-events.jsonl}"

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
  "version": "0.0.0-search-web-sandbox-denial-recovery-fixture",
  "private": true,
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-search-web-sandbox-denial-recovery-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebSandboxDenialRecoveryManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineSearchWebSandboxDenialRecoverySourceContract() {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    providerRuntimeDeferred: true,
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
      "hosts": ["SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SECRET_ENDPOINT.example.test"]
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
    "lancedb": ["SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${TASK_FILE:-}" "${BLOCKED_FILE:-}" "${DENIED_FILE:-}" "${RECOVERED_FILE:-}" "${DUPLICATE_RECOVERY_FILE:-}" "${RECOVERED_BLOCKED_FILE:-}" "${APPROVED_FILE:-}" "${DEFERRED_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}" "${EVENTS_FILE:-}"
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

post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.registry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0") {
  throw new Error(`provider sandbox task response mismatch before denial: ${JSON.stringify(taskResponse)}`);
}
if (taskResponse.task?.status !== "queued" || taskResponse.task?.type !== "openclaw_search_web_provider_runtime_sandbox") {
  throw new Error(`new provider sandbox task should be queued: ${JSON.stringify(taskResponse.task)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block provider sandbox task before approval: ${JSON.stringify(blocked)}`);
}
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked provider sandbox step should expose linked approval: ${JSON.stringify(blocked.approval)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-denial-recovery-check","reason":"deny search/web provider sandbox fixture before recovery"}' > "$DENIED_FILE"

denied_task_id="$(node - <<'EOF' "$DENIED_FILE"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!denied.ok || denied.approval?.status !== "denied" || denied.task?.status !== "failed") {
  throw new Error(`denying provider sandbox approval should fail task: ${JSON.stringify(denied)}`);
}
if (denied.task?.type !== "openclaw_search_web_provider_runtime_sandbox" || denied.task?.plan?.strategy !== "openclaw-search-web-provider-runtime-sandbox-v0") {
  throw new Error(`denied provider sandbox task should retain sandbox plan: ${JSON.stringify(denied.task)}`);
}
if (denied.task?.restorable !== true) {
  throw new Error(`denied provider sandbox task should be restorable: ${JSON.stringify(denied.task)}`);
}
if (denied.task?.policy?.request?.approved === true || denied.task?.policy?.decision?.approved === true) {
  throw new Error(`denied provider sandbox task must not become approved: ${JSON.stringify(denied.task.policy)}`);
}
process.stdout.write(denied.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_task_id/recover" '{}' > "$RECOVERED_FILE"
curl --silent --output "$DUPLICATE_RECOVERY_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/tasks/$denied_task_id/recover" \
  -H 'content-type: application/json' \
  -d '{}' | grep -qx "409"

recovered_approval_id="$(node - <<'EOF' "$DENIED_FILE" "$RECOVERED_FILE" "$DUPLICATE_RECOVERY_FILE"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recovered = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicate = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
if (!recovered.ok || recovered.task?.status !== "queued") {
  throw new Error(`recovering denied provider sandbox task should create queued task: ${JSON.stringify(recovered)}`);
}
if (recovered.task?.recovery?.recoveredFromTaskId !== denied.task?.id) {
  throw new Error(`recovered provider sandbox task should link to denied source: ${JSON.stringify(recovered.task?.recovery)}`);
}
if (recovered.recoveredFromTask?.recoveredByTaskId !== recovered.task?.id) {
  throw new Error(`denied provider sandbox task should link to recovered task: ${JSON.stringify(recovered.recoveredFromTask)}`);
}
if (recovered.task?.type !== "openclaw_search_web_provider_runtime_sandbox" || recovered.task?.plan?.strategy !== "openclaw-search-web-provider-runtime-sandbox-v0") {
  throw new Error(`recovered provider sandbox task should preserve sandbox plan: ${JSON.stringify(recovered.task)}`);
}
if (recovered.task?.policy?.request?.approved === true || recovered.task?.policy?.decision?.approved === true) {
  throw new Error(`recovered provider sandbox task must not inherit approval: ${JSON.stringify(recovered.task?.policy)}`);
}
if (recovered.task?.policy?.decision?.decision !== "require_approval") {
  throw new Error(`recovered provider sandbox task should require fresh approval: ${JSON.stringify(recovered.task?.policy)}`);
}
if (recovered.task?.approval?.required !== true || recovered.task?.approval?.status !== "pending") {
  throw new Error(`recovered provider sandbox task should have fresh pending approval: ${JSON.stringify(recovered.task?.approval)}`);
}
if (recovered.task?.approval?.requestId === denied.approval?.id) {
  throw new Error(`recovered provider sandbox task should not reuse denied approval id: ${JSON.stringify(recovered.task?.approval)}`);
}
if (duplicate.ok !== false || duplicate.recoveredByTaskId !== recovered.task?.id) {
  throw new Error(`duplicate provider sandbox recovery should be rejected: ${JSON.stringify(duplicate)}`);
}
process.stdout.write(recovered.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_BLOCKED_FILE"
post_json "$CORE_URL/approvals/$recovered_approval_id/approve" '{"approvedBy":"dev-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-denial-recovery-check","reason":"approve recovered search/web provider sandbox fixture"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?limit=120" > "$EVENTS_FILE"

node - <<'EOF' "$DENIED_FILE" "$RECOVERED_FILE" "$RECOVERED_BLOCKED_FILE" "$APPROVED_FILE" "$DEFERRED_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE" "$EVENTS_FILE" "$QUERY_SECRET"
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
  throw new Error(`operator should block recovered provider sandbox task before fresh approval: ${JSON.stringify(recoveredBlocked)}`);
}
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`fresh provider sandbox approval should convert task to audited deferred execution: ${JSON.stringify(approved)}`);
}
if (!deferred.ok || deferred.ran !== false || deferred.blocked !== true || deferred.reason !== "search_web_provider_runtime_sandbox_deferred") {
  throw new Error(`approved provider sandbox recovery should remain provider-runtime deferred: ${JSON.stringify(deferred)}`);
}
if (deferred.task?.id !== recovered.task?.id || deferred.task?.status !== "queued") {
  throw new Error(`deferred provider sandbox task should stay queued for future runtime adapter: ${JSON.stringify(deferred.task)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`provider sandbox denial recovery must not invoke capabilities or network providers: ${JSON.stringify(history.summary)}`);
}
if (approvals.summary?.counts?.denied !== 1 || approvals.summary?.counts?.approved !== 1 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should show one denial and one fresh approval: ${JSON.stringify(approvals.summary)}`);
}
if (tasks.summary?.counts?.failed !== 1 || tasks.summary?.counts?.queued !== 1 || tasks.summary?.counts?.recoverable !== 1) {
  throw new Error(`task summary should show failed source plus deferred recovered provider sandbox task: ${JSON.stringify(tasks.summary)}`);
}
const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["approval.created", "approval.denied", "approval.approved", "task.recovered", "task.failed", "task.blocked"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_ROOT_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SDK_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SDK_SECRET_SOURCE_CONTENT",
  "SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SECRET_ENDPOINT",
  "SEARCH_WEB_SANDBOX_DENIAL_RECOVERY_SECRET_AUTH_ENV",
  "0.0.0-search-web-sandbox-denial-recovery-fixture",
  "0.0.0-search-web-sandbox-denial-recovery-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`provider sandbox denial recovery leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterProviderRuntimeSandboxDenialRecovery: {
    deniedTask: denied.task.id,
    recoveredTask: recovered.task.id,
    deferredReason: deferred.reason,
    approvals: approvals.summary,
  },
}, null, 2));
EOF
