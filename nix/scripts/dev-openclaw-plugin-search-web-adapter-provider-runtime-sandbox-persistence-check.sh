#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-persistence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_SANDBOX_PERSISTENCE_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10250}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10251}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10252}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10253}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10254}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10255}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10256}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10257}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10258}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-provider-runtime-sandbox-persistence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-persistence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

post_json() {
  curl --silent --fail -X POST "$1" -H 'content-type: application/json' -d "$2"
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
  "version": "0.0.0-search-web-sandbox-persistence-fixture",
  "private": true,
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_PERSISTENCE_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-search-web-sandbox-persistence-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_PERSISTENCE_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SEARCH_WEB_SANDBOX_PERSISTENCE_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebSandboxPersistenceManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineSearchWebSandboxPersistenceSourceContract() {
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
      "hosts": ["SEARCH_WEB_SANDBOX_PERSISTENCE_SECRET_ENDPOINT.example.test"]
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
    "lancedb": ["SEARCH_WEB_SANDBOX_PERSISTENCE_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${TASK_FILE:-}" "${BLOCKED_FILE:-}" "${POST_PENDING_RESTART_TASKS_FILE:-}" "${POST_PENDING_RESTART_APPROVALS_FILE:-}" "${DENIED_FILE:-}" "${RECOVERED_FILE:-}" "${POST_RECOVERY_RESTART_TASKS_FILE:-}" "${POST_RECOVERY_RESTART_APPROVALS_FILE:-}" "${RECOVERED_APPROVED_FILE:-}" "${DEFERRED_FILE:-}" "${POST_FINAL_RESTART_TASKS_FILE:-}" "${POST_FINAL_RESTART_APPROVALS_FILE:-}" "${POST_FINAL_RESTART_HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
POST_PENDING_RESTART_TASKS_FILE="$(mktemp)"
POST_PENDING_RESTART_APPROVALS_FILE="$(mktemp)"
DENIED_FILE="$(mktemp)"
RECOVERED_FILE="$(mktemp)"
POST_RECOVERY_RESTART_TASKS_FILE="$(mktemp)"
POST_RECOVERY_RESTART_APPROVALS_FILE="$(mktemp)"
RECOVERED_APPROVED_FILE="$(mktemp)"
DEFERRED_FILE="$(mktemp)"
POST_FINAL_RESTART_TASKS_FILE="$(mktemp)"
POST_FINAL_RESTART_APPROVALS_FILE="$(mktemp)"
POST_FINAL_RESTART_HISTORY_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "openclaw_search_web_provider_runtime_sandbox") {
  throw new Error(`persistence fixture should create provider sandbox task: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`provider sandbox task should block before persisted approval: ${JSON.stringify(blocked)}`);
}
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked provider sandbox should expose linked approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null

curl --silent --fail "$CORE_URL/tasks?limit=8" > "$POST_PENDING_RESTART_TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=8" > "$POST_PENDING_RESTART_APPROVALS_FILE"

node - <<'EOF' "$TASK_FILE" "$POST_PENDING_RESTART_TASKS_FILE" "$POST_PENDING_RESTART_APPROVALS_FILE" "$approval_id"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tasks = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const approvals = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const approvalId = process.argv[5];
const task = (tasks.items ?? []).find((item) => item.id === taskResponse.task?.id);
if (!task || task.status !== "queued" || task.type !== "openclaw_search_web_provider_runtime_sandbox" || task.approval?.requestId !== approvalId) {
  throw new Error(`pending provider sandbox task should survive restart: ${JSON.stringify(task)}`);
}
if (!(approvals.items ?? []).some((approval) => approval.id === approvalId && approval.status === "pending")) {
  throw new Error(`pending provider sandbox approval should survive restart: ${JSON.stringify(approvals.items)}`);
}
if (tasks.summary?.counts?.queued !== 1 || approvals.summary?.counts?.pending !== 1) {
  throw new Error(`pending restart summaries mismatch: ${JSON.stringify({ tasks: tasks.summary, approvals: approvals.summary })}`);
}
EOF

post_json "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-persistence-check","reason":"deny persisted provider sandbox task before recovery"}' > "$DENIED_FILE"

denied_task_id="$(node - <<'EOF' "$DENIED_FILE"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!denied.ok || denied.approval?.status !== "denied" || denied.task?.status !== "failed" || denied.task?.restorable !== true) {
  throw new Error(`denied persisted provider sandbox should fail and become restorable: ${JSON.stringify(denied)}`);
}
process.stdout.write(denied.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_task_id/recover" '{}' > "$RECOVERED_FILE"

recovered_approval_id="$(node - <<'EOF' "$DENIED_FILE" "$RECOVERED_FILE"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recovered = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!recovered.ok || recovered.task?.status !== "queued" || recovered.task?.type !== "openclaw_search_web_provider_runtime_sandbox") {
  throw new Error(`recovered persisted provider sandbox should be queued: ${JSON.stringify(recovered)}`);
}
if (recovered.task?.recovery?.recoveredFromTaskId !== denied.task?.id || recovered.recoveredFromTask?.recoveredByTaskId !== recovered.task?.id) {
  throw new Error(`recovered persisted provider sandbox should preserve recovery links: ${JSON.stringify(recovered)}`);
}
if (recovered.task?.approval?.status !== "pending" || recovered.task?.approval?.requestId === denied.approval?.id) {
  throw new Error(`recovered persisted provider sandbox should use fresh pending approval: ${JSON.stringify(recovered.task?.approval)}`);
}
process.stdout.write(recovered.task.approval.requestId);
EOF
)"

"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null

curl --silent --fail "$CORE_URL/tasks?limit=8" > "$POST_RECOVERY_RESTART_TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=8" > "$POST_RECOVERY_RESTART_APPROVALS_FILE"

node - <<'EOF' "$DENIED_FILE" "$RECOVERED_FILE" "$POST_RECOVERY_RESTART_TASKS_FILE" "$POST_RECOVERY_RESTART_APPROVALS_FILE" "$recovered_approval_id"
const fs = require("node:fs");
const denied = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recovered = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const tasks = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const approvals = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const recoveredApprovalId = process.argv[6];
const sourceAfter = (tasks.items ?? []).find((task) => task.id === denied.task?.id);
const recoveredAfter = (tasks.items ?? []).find((task) => task.id === recovered.task?.id);
if (!sourceAfter || sourceAfter.status !== "failed" || sourceAfter.recoveredByTaskId !== recovered.task?.id || sourceAfter.restorable !== true) {
  throw new Error(`failed provider sandbox source should survive restart with recovery link: ${JSON.stringify(sourceAfter)}`);
}
if (!recoveredAfter || recoveredAfter.status !== "queued" || recoveredAfter.recovery?.recoveredFromTaskId !== sourceAfter.id || recoveredAfter.approval?.requestId !== recoveredApprovalId) {
  throw new Error(`queued recovered provider sandbox should survive restart: ${JSON.stringify(recoveredAfter)}`);
}
if (!(approvals.items ?? []).some((approval) => approval.id === recoveredApprovalId && approval.status === "pending")) {
  throw new Error(`fresh recovered provider sandbox approval should survive restart pending: ${JSON.stringify(approvals.items)}`);
}
if (tasks.summary?.counts?.failed !== 1 || tasks.summary?.counts?.queued !== 1 || tasks.summary?.counts?.recoverable !== 1) {
  throw new Error(`recovery restart task summary mismatch: ${JSON.stringify(tasks.summary)}`);
}
if (approvals.summary?.counts?.denied !== 1 || approvals.summary?.counts?.pending !== 1) {
  throw new Error(`recovery restart approval summary mismatch: ${JSON.stringify(approvals.summary)}`);
}
EOF

post_json "$CORE_URL/approvals/$recovered_approval_id/approve" '{"approvedBy":"dev-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-persistence-check","reason":"approve recovered persisted provider sandbox task"}' > "$RECOVERED_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"

node - <<'EOF' "$RECOVERED_APPROVED_FILE" "$DEFERRED_FILE"
const fs = require("node:fs");
const approved = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const deferred = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`recovered provider sandbox approval should become audited: ${JSON.stringify(approved)}`);
}
if (!deferred.ok || deferred.ran !== false || deferred.blocked !== true || deferred.reason !== "search_web_provider_runtime_sandbox_deferred") {
  throw new Error(`approved persisted provider sandbox should remain deferred: ${JSON.stringify(deferred)}`);
}
EOF

"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null

curl --silent --fail "$CORE_URL/tasks?limit=8" > "$POST_FINAL_RESTART_TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=8" > "$POST_FINAL_RESTART_APPROVALS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$POST_FINAL_RESTART_HISTORY_FILE"

node - <<'EOF' "$DENIED_FILE" "$RECOVERED_FILE" "$POST_FINAL_RESTART_TASKS_FILE" "$POST_FINAL_RESTART_APPROVALS_FILE" "$POST_FINAL_RESTART_HISTORY_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const denied = readJson(2);
const recovered = readJson(3);
const tasks = readJson(4);
const approvals = readJson(5);
const history = readJson(6);
const querySecret = process.argv[7];
const raw = JSON.stringify({ denied, recovered, tasks, approvals, history });

const sourceAfter = (tasks.items ?? []).find((task) => task.id === denied.task?.id);
const recoveredAfter = (tasks.items ?? []).find((task) => task.id === recovered.task?.id);
if (!sourceAfter || sourceAfter.status !== "failed" || sourceAfter.recoveredByTaskId !== recovered.task?.id || sourceAfter.restorable !== true) {
  throw new Error(`failed provider sandbox source should persist after final restart: ${JSON.stringify(sourceAfter)}`);
}
if (!recoveredAfter || recoveredAfter.status !== "queued" || recoveredAfter.executionPhase !== "provider_runtime_sandbox_deferred" || recoveredAfter.recovery?.recoveredFromTaskId !== sourceAfter.id) {
  throw new Error(`deferred recovered provider sandbox should persist after final restart: ${JSON.stringify(recoveredAfter)}`);
}
if (tasks.summary?.counts?.failed !== 1 || tasks.summary?.counts?.queued !== 1 || tasks.summary?.counts?.recoverable !== 1) {
  throw new Error(`final task summary mismatch: ${JSON.stringify(tasks.summary)}`);
}
if (approvals.summary?.counts?.denied !== 1 || approvals.summary?.counts?.approved !== 1 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`final approval summary mismatch: ${JSON.stringify(approvals.summary)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`provider sandbox persistence must not invoke capabilities or network providers: ${JSON.stringify(history.summary)}`);
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_SANDBOX_PERSISTENCE_ROOT_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_PERSISTENCE_SDK_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_PERSISTENCE_SDK_SECRET_SOURCE_CONTENT",
  "SEARCH_WEB_SANDBOX_PERSISTENCE_SECRET_ENDPOINT",
  "SEARCH_WEB_SANDBOX_PERSISTENCE_SECRET_AUTH_ENV",
  "0.0.0-search-web-sandbox-persistence-fixture",
  "0.0.0-search-web-sandbox-persistence-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`provider sandbox persistence leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterProviderRuntimeSandboxPersistence: {
    failedSource: sourceAfter.id,
    recoveredTask: recoveredAfter.id,
    executionPhase: recoveredAfter.executionPhase,
    approvals: approvals.summary,
    history: history.summary,
  },
}, null, 2));
EOF
