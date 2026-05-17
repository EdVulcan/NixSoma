#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-task-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="SEARCH_WEB_TASK_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10010}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10011}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10012}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10013}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10014}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10015}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10016}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10017}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10018}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-plugin-search-web-adapter-task-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-plugin-search-web-adapter-task-check-events.jsonl}"

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
  "$EXTENSIONS_DIR/brave" \
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
export interface SearchWebAdapterTaskContract {
  adapterId: string;
  requiresApproval: boolean;
}
export function createSearchWebAdapterTaskContract(): SearchWebAdapterTaskContract {
  return {
    adapterId: "openclaw.search_web.native-adapter",
    requiresApproval: true,
  };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SearchWebAdapterTaskManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export interface SearchWebAdapterTaskSourceContract {
  adapterId: string;
  networkDeferred: boolean;
}
export function defineSearchWebAdapterTaskSourceContract(): SearchWebAdapterTaskSourceContract {
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
      "hosts": ["SEARCH_WEB_TASK_SECRET_ENDPOINT_TOKEN.example.test"]
    }
  ],
  "syntheticAuthRefs": ["web-search-key"],
  "contracts": {
    "tools": ["search", "fetch"],
    "web": ["query"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/brave/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.brave",
  "providers": ["brave"],
  "syntheticAuthRefs": ["brave-key"],
  "contracts": {
    "webSearchProviders": ["brave"]
  }
}
JSON
cat > "$EXTENSIONS_DIR/memory/openclaw.plugin.json" <<'JSON'
{
  "id": "openclaw.memory",
  "providers": ["lancedb"],
  "providerAuthEnvVars": {
    "lancedb": ["SEARCH_WEB_TASK_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${DRAFT_FILE:-}" "${REJECTED_FILE:-}" "${TASK_FILE:-}" "${BLOCKED_STEP_FILE:-}" "${PENDING_FILE:-}" "${TASKS_BEFORE_FILE:-}" "${TASKS_AFTER_FILE:-}" "${APPROVALS_BEFORE_FILE:-}" "${APPROVALS_AFTER_FILE:-}" "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

DRAFT_FILE="$(mktemp)"
REJECTED_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_STEP_FILE="$(mktemp)"
PENDING_FILE="$(mktemp)"
TASKS_BEFORE_FILE="$(mktemp)"
TASKS_AFTER_FILE="$(mktemp)"
APPROVALS_BEFORE_FILE="$(mktemp)"
APPROVALS_AFTER_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-task-draft?providerContractId=openclaw.web-search&query=$QUERY_SECRET" > "$DRAFT_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_BEFORE_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_BEFORE_FILE"
curl --silent --output "$REJECTED_FILE" --write-out "%{http_code}" \
  -X POST "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-tasks" \
  -H 'content-type: application/json' \
  -d "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\"}" | grep -qx "400"
post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$PENDING_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_AFTER_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_AFTER_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"

node - <<'EOF' "$DRAFT_FILE" "$REJECTED_FILE" "$TASK_FILE" "$BLOCKED_STEP_FILE" "$PENDING_FILE" "$TASKS_BEFORE_FILE" "$TASKS_AFTER_FILE" "$APPROVALS_BEFORE_FILE" "$APPROVALS_AFTER_FILE" "$HISTORY_FILE" "$QUERY_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const draft = readJson(2);
const rejected = readJson(3);
const taskResponse = readJson(4);
const blockedStep = readJson(5);
const pending = readJson(6);
const tasksBefore = readJson(7);
const tasksAfter = readJson(8);
const approvalsBefore = readJson(9);
const approvalsAfter = readJson(10);
const history = readJson(11);
const querySecret = process.argv[12];
const raw = JSON.stringify({ draft, taskResponse, blockedStep, pending, history });

if (rejected.ok !== false || !String(rejected.error ?? "").includes("confirm=true")) {
  throw new Error(`search/web adapter task creation should require explicit confirmation: ${JSON.stringify(rejected)}`);
}
if (
  !draft.ok
  || draft.registry !== "openclaw-plugin-search-web-adapter-task-draft-v0"
  || draft.mode !== "approval-gated-search-web-task-draft"
  || draft.providerContract?.manifestId !== "openclaw.web-search"
  || draft.policy?.decision?.decision !== "require_approval"
  || draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canUseNetwork !== false
) {
  throw new Error(`search/web adapter task draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-plugin-search-web-adapter-task-v0"
  || taskResponse.mode !== "approval-gated-search-web-task"
  || taskResponse.sourceRegistry !== "openclaw-plugin-search-web-adapter-task-draft-v0"
  || taskResponse.providerContract?.manifestId !== "openclaw.web-search"
) {
  throw new Error(`search/web adapter task response mismatch: ${JSON.stringify(taskResponse)}`);
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
  || taskResponse.governance?.requiresExplicitApprovalBeforeNetworkUse !== true
) {
  throw new Error(`search/web adapter task governance mismatch: ${JSON.stringify(taskResponse.governance)}`);
}
const task = taskResponse.task ?? {};
if (
  task.status !== "queued"
  || task.type !== "openclaw_search_web_adapter_invocation"
  || task.policy?.decision?.decision !== "require_approval"
  || task.policy?.decision?.domain !== "cross_boundary"
  || task.approval?.required !== true
  || task.plan?.capabilitySummary?.ids?.includes("boundary.cross_domain.approval") !== true
  || task.plan?.governance?.canUseNetwork !== false
  || task.plan?.governance?.canExecutePluginCode !== false
) {
  throw new Error(`search/web adapter task should be queued behind explicit approval: ${JSON.stringify(task)}`);
}
if (!taskResponse.approval?.id || taskResponse.approval?.status !== "pending" || taskResponse.approval?.taskId !== task.id) {
  throw new Error(`search/web adapter task should create a linked pending approval: ${JSON.stringify(taskResponse.approval)}`);
}
if (!blockedStep.ok || blockedStep.ran !== false || blockedStep.blocked !== true || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`operator should block instead of executing search/web task: ${JSON.stringify(blockedStep)}`);
}
if (blockedStep.task?.id !== task.id || blockedStep.approval?.id !== taskResponse.approval.id) {
  throw new Error(`blocked operator step should point at search/web approval: ${JSON.stringify(blockedStep)}`);
}
if (pending.items?.length !== 1 || pending.items[0].id !== taskResponse.approval.id) {
  throw new Error(`approval inbox should contain search/web pending approval: ${JSON.stringify(pending.items)}`);
}
if (tasksAfter.summary?.counts?.total !== (tasksBefore.summary?.counts?.total ?? 0) + 1) {
  throw new Error(`search/web adapter task should create one task: ${JSON.stringify({ before: tasksBefore.summary, after: tasksAfter.summary })}`);
}
if (
  approvalsAfter.summary?.counts?.total !== (approvalsBefore.summary?.counts?.total ?? 0) + 1
  || approvalsAfter.summary?.counts?.pending !== (approvalsBefore.summary?.counts?.pending ?? 0) + 1
) {
  throw new Error(`search/web adapter task should create one pending approval: ${JSON.stringify({ before: approvalsBefore.summary, after: approvalsAfter.summary })}`);
}
if ((history.items ?? []).length !== 0) {
  throw new Error(`search/web adapter task must not invoke capabilities or network providers: ${JSON.stringify(history.items)}`);
}
for (const secret of [
  querySecret,
  "SEARCH_WEB_TASK_SECRET_ENDPOINT_TOKEN",
  "SEARCH_WEB_TASK_SECRET_AUTH_ENV",
]) {
  if (raw.includes(secret)) {
    throw new Error(`search/web adapter task leaked query, manifest body, auth env var name, or endpoint detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawPluginSearchWebAdapterTask: {
    registry: taskResponse.registry,
    mode: taskResponse.mode,
    provider: taskResponse.providerContract.manifestId,
    task: {
      id: task.id,
      status: task.status,
      approval: task.approval,
      capabilitySummary: task.plan.capabilitySummary,
    },
    approval: {
      id: taskResponse.approval.id,
      status: taskResponse.approval.status,
      reason: taskResponse.approval.reason,
    },
    operatorGate: {
      blocked: blockedStep.blocked,
      reason: blockedStep.reason,
    },
  },
}, null, 2));
EOF
