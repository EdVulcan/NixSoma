#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_SANDBOX_TASK_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10190}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10191}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10192}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10193}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10194}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10195}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10196}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10197}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10198}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-provider-runtime-sandbox-task-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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
  "version": "0.0.0-search-web-sandbox-task-fixture",
  "private": true,
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_TASK_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-search-web-sandbox-task-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo SEARCH_WEB_SANDBOX_TASK_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const SEARCH_WEB_SANDBOX_TASK_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebSandboxTaskManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineSearchWebSandboxTaskSourceContract() {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    networkRuntimeDeferred: true,
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
      "hosts": ["SEARCH_WEB_SANDBOX_TASK_SECRET_ENDPOINT.example.test"]
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
    "lancedb": ["SEARCH_WEB_SANDBOX_TASK_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${DRAFT_FILE:-}" "${REJECTED_FILE:-}" "${TASK_FILE:-}" "${BLOCKED_FILE:-}" "${APPROVED_FILE:-}" "${DEFERRED_FILE:-}" "${HISTORY_FILE:-}" "${APPROVALS_FILE:-}" "${TASKS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

DRAFT_FILE="$(mktemp)"
REJECTED_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
DEFERRED_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-task-draft?providerContractId=openclaw.web-search&query=$QUERY_SECRET" > "$DRAFT_FILE"
curl --silent --output "$REJECTED_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks" \
  -H 'content-type: application/json' \
  -d "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\"}" | grep -qx "400"
post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!taskResponse.ok || taskResponse.registry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0") {
  throw new Error(`provider sandbox task response mismatch: ${JSON.stringify(taskResponse)}`);
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

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-check","reason":"approve search/web provider sandbox fixture"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=10" > "$TASKS_FILE"

node - <<'EOF' "$DRAFT_FILE" "$REJECTED_FILE" "$TASK_FILE" "$BLOCKED_FILE" "$APPROVED_FILE" "$DEFERRED_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$TASKS_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const draft = readJson(2);
const rejected = readJson(3);
const taskResponse = readJson(4);
const blocked = readJson(5);
const approved = readJson(6);
const deferred = readJson(7);
const history = readJson(8);
const approvals = readJson(9);
const tasks = readJson(10);
const querySecret = process.argv[11];
const raw = JSON.stringify({ draft, taskResponse, blocked, approved, deferred, history, approvals, tasks });

if (rejected.ok !== false || !String(rejected.error ?? "").includes("confirm=true")) {
  throw new Error(`provider sandbox task creation should require explicit confirmation: ${JSON.stringify(rejected)}`);
}
if (
  !draft.ok
  || draft.registry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-draft-v0"
  || draft.mode !== "approval-gated-search-web-provider-runtime-sandbox-task-draft"
  || draft.sourceRegistry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0"
  || draft.sandboxContract?.summary?.blockedRequired !== 2
  || draft.policy?.decision?.decision !== "require_approval"
  || draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canUseNetwork !== false
) {
  throw new Error(`provider sandbox task draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0"
  || taskResponse.mode !== "approval-gated-search-web-provider-runtime-sandbox-task"
  || taskResponse.sourceRegistry !== "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-draft-v0"
  || taskResponse.provider?.manifestId !== "openclaw.web-search"
  || taskResponse.sandboxContract?.summary?.blockedRequired !== 2
) {
  throw new Error(`provider sandbox task response mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canExecuteWithoutApproval !== false
  || taskResponse.governance?.canUseNetwork !== false
  || taskResponse.governance?.canImportModule !== false
  || taskResponse.governance?.canExecutePluginCode !== false
  || taskResponse.governance?.canActivateRuntime !== false
  || taskResponse.governance?.executed !== false
) {
  throw new Error(`provider sandbox task governance mismatch: ${JSON.stringify(taskResponse.governance)}`);
}
const task = taskResponse.task ?? {};
if (
  task.status !== "queued"
  || task.type !== "openclaw_search_web_provider_runtime_sandbox"
  || task.plan?.strategy !== "openclaw-search-web-provider-runtime-sandbox-v0"
  || task.policy?.decision?.decision !== "require_approval"
  || task.approval?.required !== true
  || task.plan?.governance?.canUseNetwork !== false
  || task.plan?.governance?.canExecutePluginCode !== false
  || task.plan?.governance?.canActivateRuntime !== false
) {
  throw new Error(`provider sandbox task should be queued behind explicit approval: ${JSON.stringify(task)}`);
}
if (!taskResponse.approval?.id || taskResponse.approval?.status !== "pending" || taskResponse.approval?.taskId !== task.id) {
  throw new Error(`provider sandbox task should create a linked pending approval: ${JSON.stringify(taskResponse.approval)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block provider sandbox task before approval: ${JSON.stringify(blocked)}`);
}
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`provider sandbox approval should convert task to audited deferred execution: ${JSON.stringify(approved)}`);
}
if (!deferred.ok || deferred.ran !== false || deferred.blocked !== true || deferred.reason !== "search_web_provider_runtime_sandbox_deferred") {
  throw new Error(`approved provider sandbox task should remain runtime-sandbox deferred: ${JSON.stringify(deferred)}`);
}
if (deferred.task?.id !== task.id || deferred.task?.status !== "queued") {
  throw new Error(`deferred provider sandbox task should stay queued for future runtime adapter: ${JSON.stringify(deferred.task)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`provider sandbox task must not invoke capabilities or network providers: ${JSON.stringify(history.summary)}`);
}
if (approvals.summary?.counts?.approved !== 1 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should show approved provider sandbox task only: ${JSON.stringify(approvals.summary)}`);
}
if (tasks.summary?.counts?.queued !== 1 || tasks.summary?.currentTaskId !== task.id) {
  throw new Error(`task summary should retain deferred provider sandbox task as current queued work: ${JSON.stringify(tasks.summary)}`);
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_SANDBOX_TASK_ROOT_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_TASK_SDK_SECRET_BUILD_BODY",
  "SEARCH_WEB_SANDBOX_TASK_SDK_SECRET_SOURCE_CONTENT",
  "SEARCH_WEB_SANDBOX_TASK_SECRET_ENDPOINT",
  "SEARCH_WEB_SANDBOX_TASK_SECRET_AUTH_ENV",
  "0.0.0-search-web-sandbox-task-fixture",
  "0.0.0-search-web-sandbox-task-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`provider sandbox task leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterProviderRuntimeSandboxTask: {
    registry: taskResponse.registry,
    provider: taskResponse.provider.manifestId,
    task: {
      id: task.id,
      status: task.status,
      strategy: task.plan.strategy,
    },
    approval: {
      id: taskResponse.approval.id,
      status: approved.approval.status,
    },
    operatorGate: {
      blocked: deferred.blocked,
      reason: deferred.reason,
    },
  },
}, null, 2));
EOF
