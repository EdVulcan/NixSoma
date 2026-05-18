#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
SDK_SOURCE_DIR="$WORKSPACE_DIR/src/plugin-sdk"
EXTENSIONS_DIR="$WORKSPACE_DIR/extensions"
QUERY_SECRET="OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_QUERY_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10240}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10241}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10242}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10243}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10244}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10245}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10246}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10247}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10248}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

post_json() {
  curl --silent --fail -X POST "$1" -H 'content-type: application/json' -d "$2"
}

post_json_status() {
  curl --silent --output "$3" --write-out "%{http_code}" -X POST "$1" -H 'content-type: application/json' -d "$2"
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
  "version": "0.0.0-observer-search-web-sandbox-hardening-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_ROOT_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-observer-search-web-sandbox-hardening-sdk-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverSearchWebSandboxHardeningManifest = { pluginId: string };
TS
cat > "$SDK_SOURCE_DIR/core.ts" <<'TS'
export function defineObserverSearchWebSandboxHardeningSourceContract() {
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
      "hosts": ["OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SECRET_ENDPOINT.example.test"]
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
    "lancedb": ["OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SECRET_AUTH_ENV"]
  },
  "contracts": {
    "tools": ["remember"],
    "memory": ["workspace-index"]
  }
}
JSON

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${BLOCKED_FILE:-}" "${APPROVED_FILE:-}" "${DUP_APPROVE_FILE:-}" "${DUP_DENY_FILE:-}" "${DEFERRED_FILE:-}" "${DENIED_ONE_FILE:-}" "${RECOVERED_ONE_FILE:-}" "${DUP_RECOVERY_FILE:-}" "${DENIED_TWO_FILE:-}" "${RECOVERED_TWO_FILE:-}" "${RECOVERED_TWO_BLOCKED_FILE:-}" "${RECOVERED_TWO_APPROVED_FILE:-}" "${RECOVERED_TWO_DEFERRED_FILE:-}" "${TASKS_FILE:-}" "${APPROVALS_FILE:-}" "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
DUP_APPROVE_FILE="$(mktemp)"
DUP_DENY_FILE="$(mktemp)"
DEFERRED_FILE="$(mktemp)"
DENIED_ONE_FILE="$(mktemp)"
RECOVERED_ONE_FILE="$(mktemp)"
DUP_RECOVERY_FILE="$(mktemp)"
DENIED_TWO_FILE="$(mktemp)"
RECOVERED_TWO_FILE="$(mktemp)"
RECOVERED_TWO_BLOCKED_FILE="$(mktemp)"
RECOVERED_TWO_APPROVED_FILE="$(mktemp)"
RECOVERED_TWO_DEFERRED_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "openclaw_search_web_provider_runtime_sandbox") {
  throw new Error(`observer hardening should create provider sandbox task: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`observer hardening blocked step should expose approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check","reason":"observer approve provider sandbox task"}' > "$APPROVED_FILE"
dup_approve_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check"}' "$DUP_APPROVE_FILE")"
dup_deny_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check"}' "$DUP_DENY_FILE")"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"

post_json "$CORE_URL/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks" "{\"providerContractId\":\"openclaw.web-search\",\"query\":\"$QUERY_SECRET\",\"confirm\":true}" > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

chain_approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "openclaw_search_web_provider_runtime_sandbox") {
  throw new Error(`observer recovery chain should create provider sandbox task: ${JSON.stringify(taskResponse)}`);
}
if (blocked.approval?.id !== taskResponse.approval?.id) {
  throw new Error(`observer recovery chain should block on linked approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$chain_approval_id/deny" '{"deniedBy":"dev-observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check","reason":"observer deny provider sandbox chain source"}' > "$DENIED_ONE_FILE"

denied_one_task_id="$(node - <<'EOF' "$DENIED_ONE_FILE"
const fs = require("node:fs");
const deniedOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!deniedOne.ok || deniedOne.task?.status !== "failed" || deniedOne.task?.restorable !== true) {
  throw new Error(`observer first denial should fail as recoverable: ${JSON.stringify(deniedOne)}`);
}
process.stdout.write(deniedOne.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_one_task_id/recover" '{}' > "$RECOVERED_ONE_FILE"
dup_recovery_status="$(post_json_status "$CORE_URL/tasks/$denied_one_task_id/recover" '{}' "$DUP_RECOVERY_FILE")"

recovered_one_approval_id="$(node - <<'EOF' "$RECOVERED_ONE_FILE" "$DUP_RECOVERY_FILE" "$dup_recovery_status"
const fs = require("node:fs");
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const duplicateRecovery = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicateRecoveryStatus = process.argv[4];
if (!recoveredOne.ok || recoveredOne.task?.status !== "queued" || recoveredOne.task?.recovery?.attempt !== 1) {
  throw new Error(`observer first recovery should create attempt 1: ${JSON.stringify(recoveredOne)}`);
}
if (duplicateRecoveryStatus !== "409" || duplicateRecovery.recoveredByTaskId !== recoveredOne.task?.id) {
  throw new Error(`observer duplicate recovery should return 409: ${JSON.stringify({ duplicateRecoveryStatus, duplicateRecovery })}`);
}
process.stdout.write(recoveredOne.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/approvals/$recovered_one_approval_id/deny" '{"deniedBy":"dev-observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check","reason":"observer deny first recovered provider sandbox"}' > "$DENIED_TWO_FILE"

denied_two_task_id="$(node - <<'EOF' "$RECOVERED_ONE_FILE" "$DENIED_TWO_FILE"
const fs = require("node:fs");
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const deniedTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!deniedTwo.ok || deniedTwo.task?.id !== recoveredOne.task?.id || deniedTwo.task?.status !== "failed" || deniedTwo.task?.recovery?.attempt !== 1) {
  throw new Error(`observer denying first recovered provider sandbox should fail attempt 1: ${JSON.stringify(deniedTwo)}`);
}
process.stdout.write(deniedTwo.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_two_task_id/recover" '{}' > "$RECOVERED_TWO_FILE"

recovered_two_approval_id="$(node - <<'EOF' "$DENIED_TWO_FILE" "$RECOVERED_TWO_FILE"
const fs = require("node:fs");
const deniedTwo = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!recoveredTwo.ok || recoveredTwo.task?.status !== "queued" || recoveredTwo.task?.recovery?.attempt !== 2) {
  throw new Error(`observer second recovery should create attempt 2: ${JSON.stringify(recoveredTwo)}`);
}
if (recoveredTwo.task?.recovery?.recoveredFromTaskId !== deniedTwo.task?.id) {
  throw new Error(`observer second recovery should link to failed attempt 1: ${JSON.stringify(recoveredTwo.task?.recovery)}`);
}
process.stdout.write(recoveredTwo.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_BLOCKED_FILE"
post_json "$CORE_URL/approvals/$recovered_two_approval_id/approve" '{"approvedBy":"dev-observer-openclaw-plugin-search-web-adapter-provider-runtime-sandbox-hardening-check","reason":"observer approve second recovered provider sandbox"}' > "$RECOVERED_TWO_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_DEFERRED_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=20" > "$TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=20" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=20" > "$HISTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$APPROVED_FILE" "$DUP_APPROVE_FILE" "$DUP_DENY_FILE" "$DEFERRED_FILE" "$RECOVERED_TWO_BLOCKED_FILE" "$RECOVERED_TWO_APPROVED_FILE" "$RECOVERED_TWO_DEFERRED_FILE" "$TASKS_FILE" "$APPROVALS_FILE" "$HISTORY_FILE" "$dup_approve_status" "$dup_deny_status" "$QUERY_SECRET"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));
const html = readText(2);
const client = readText(3);
const approved = readJson(4);
const duplicateApprove = readJson(5);
const duplicateDeny = readJson(6);
const deferred = readJson(7);
const recoveredTwoBlocked = readJson(8);
const recoveredTwoApproved = readJson(9);
const recoveredTwoDeferred = readJson(10);
const tasks = readJson(11);
const approvals = readJson(12);
const history = readJson(13);
const duplicateApproveStatus = process.argv[14];
const duplicateDenyStatus = process.argv[15];
const querySecret = process.argv[16];
const raw = JSON.stringify({ html, client, approved, duplicateApprove, duplicateDeny, deferred, recoveredTwoBlocked, recoveredTwoApproved, recoveredTwoDeferred, tasks, approvals, history });

for (const token of [
  "plugin-search-web-sandbox-task-button",
  "recover-selected-task-button",
  "approval-json",
  "approval-pending-count",
  "task-list-items",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks",
  "createPluginSearchWebProviderSandboxApprovalTask",
  "recoverSelectedTask",
  "refreshApprovalState",
  "refreshTaskList",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (approved.approval?.status !== "approved") {
  throw new Error(`observer first approval should succeed: ${JSON.stringify(approved)}`);
}
if (duplicateApproveStatus !== "409" || !String(duplicateApprove.error ?? "").includes("approved")) {
  throw new Error(`observer duplicate approve should return 409: ${JSON.stringify({ duplicateApproveStatus, duplicateApprove })}`);
}
if (duplicateDenyStatus !== "409" || !String(duplicateDeny.error ?? "").includes("approved")) {
  throw new Error(`observer deny after approve should return 409: ${JSON.stringify({ duplicateDenyStatus, duplicateDeny })}`);
}
if (deferred.blocked !== true || deferred.reason !== "search_web_provider_runtime_sandbox_deferred") {
  throw new Error(`observer approved provider sandbox task should remain deferred: ${JSON.stringify(deferred)}`);
}
if (recoveredTwoBlocked.blocked !== true || recoveredTwoBlocked.reason !== "policy_requires_approval") {
  throw new Error(`observer second recovered provider sandbox should block before approval: ${JSON.stringify(recoveredTwoBlocked)}`);
}
if (recoveredTwoApproved.approval?.status !== "approved" || recoveredTwoApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`observer second recovered approval should become audited: ${JSON.stringify(recoveredTwoApproved)}`);
}
if (recoveredTwoDeferred.blocked !== true || recoveredTwoDeferred.reason !== "search_web_provider_runtime_sandbox_deferred") {
  throw new Error(`observer second recovered provider sandbox should remain deferred: ${JSON.stringify(recoveredTwoDeferred)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`observer provider sandbox hardening must not invoke capabilities: ${JSON.stringify(history.summary)}`);
}
if (approvals.summary?.counts?.denied !== 2 || approvals.summary?.counts?.approved !== 2 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`observer approval summary should show hardened chain: ${JSON.stringify(approvals.summary)}`);
}
if (tasks.summary?.counts?.failed !== 2 || tasks.summary?.counts?.queued !== 1) {
  throw new Error(`observer tasks should show failed chain plus deferred recovered provider sandbox: ${JSON.stringify(tasks.summary)}`);
}
for (const secret of [
  querySecret,
  "OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SDK_SECRET_BUILD_BODY",
  "OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SDK_SECRET_SOURCE_CONTENT",
  "OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SECRET_ENDPOINT",
  "OBSERVER_SEARCH_WEB_SANDBOX_HARDENING_SECRET_AUTH_ENV",
  "0.0.0-observer-search-web-sandbox-hardening-fixture",
  "0.0.0-observer-search-web-sandbox-hardening-sdk-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer provider sandbox hardening leaked query, source, endpoint, auth env, or version detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawPluginSearchWebAdapterProviderRuntimeSandboxHardening: {
    html: "controls-visible",
    duplicateApprovalSafety: "verified",
    duplicateRecoverySafety: "verified",
    deferredReason: recoveredTwoDeferred.reason,
    approvals: approvals.summary,
  },
}, null, 2));
EOF
