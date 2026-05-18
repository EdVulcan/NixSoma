#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-plugin-runtime-adapter-hardening-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9430}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9431}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9432}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9433}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9434}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9435}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9436}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9437}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9500}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-native-plugin-runtime-adapter-hardening-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-native-plugin-runtime-adapter-hardening-check-events.jsonl}"

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
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$WORKSPACE_DIR/extensions/provider-b" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
for index in $(seq 1 9); do mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"; done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-runtime-adapter-hardening-fixture",
  "private": true,
  "scripts": {
    "build": "echo OBSERVER_RUNTIME_ADAPTER_HARDENING_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-observer-runtime-adapter-hardening-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo OBSERVER_RUNTIME_ADAPTER_HARDENING_SDK_SECRET_BUILD_BODY"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const OBSERVER_RUNTIME_ADAPTER_HARDENING_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

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

post_json "$CORE_URL/plugins/native-adapter/runtime-adapter-tasks" '{"capabilityId":"act.plugin.capability.invoke","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`observer hardening should create native adapter task: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`observer hardening blocked step should expose approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"observer approve native adapter task"}' > "$APPROVED_FILE"
dup_approve_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-native-plugin-runtime-adapter-hardening-check"}' "$DUP_APPROVE_FILE")"
dup_deny_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-observer-openclaw-native-plugin-runtime-adapter-hardening-check"}' "$DUP_DENY_FILE")"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"

post_json "$CORE_URL/plugins/native-adapter/runtime-adapter-tasks" '{"capabilityId":"act.plugin.capability.invoke","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

chain_approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`observer recovery chain should create native adapter task: ${JSON.stringify(taskResponse)}`);
}
if (blocked.approval?.id !== taskResponse.approval?.id) {
  throw new Error(`observer recovery chain should block on linked approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$chain_approval_id/deny" '{"deniedBy":"dev-observer-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"observer deny native adapter chain source"}' > "$DENIED_ONE_FILE"

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

post_json "$CORE_URL/approvals/$recovered_one_approval_id/deny" '{"deniedBy":"dev-observer-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"observer deny first recovered native adapter"}' > "$DENIED_TWO_FILE"

denied_two_task_id="$(node - <<'EOF' "$RECOVERED_ONE_FILE" "$DENIED_TWO_FILE"
const fs = require("node:fs");
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const deniedTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!deniedTwo.ok || deniedTwo.task?.id !== recoveredOne.task?.id || deniedTwo.task?.status !== "failed" || deniedTwo.task?.recovery?.attempt !== 1) {
  throw new Error(`observer denying first recovered native adapter should fail attempt 1: ${JSON.stringify(deniedTwo)}`);
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
post_json "$CORE_URL/approvals/$recovered_two_approval_id/approve" '{"approvedBy":"dev-observer-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"observer approve second recovered native adapter"}' > "$RECOVERED_TWO_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_DEFERRED_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=20" > "$TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=20" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=20" > "$HISTORY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$APPROVED_FILE" "$DUP_APPROVE_FILE" "$DUP_DENY_FILE" "$DEFERRED_FILE" "$RECOVERED_TWO_BLOCKED_FILE" "$RECOVERED_TWO_APPROVED_FILE" "$RECOVERED_TWO_DEFERRED_FILE" "$TASKS_FILE" "$APPROVALS_FILE" "$HISTORY_FILE" "$dup_approve_status" "$dup_deny_status"
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
const raw = JSON.stringify({ html, client, approved, duplicateApprove, duplicateDeny, deferred, recoveredTwoBlocked, recoveredTwoApproved, recoveredTwoDeferred, tasks, approvals, history });

for (const token of [
  "native-plugin-runtime-adapter-task-button",
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
  "/plugins/native-adapter/runtime-adapter-tasks",
  "createNativePluginRuntimeAdapterApprovalTask",
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
if (deferred.blocked !== true || deferred.reason !== "native_plugin_runtime_adapter_implementation_deferred") {
  throw new Error(`observer approved native adapter task should remain deferred: ${JSON.stringify(deferred)}`);
}
if (recoveredTwoBlocked.blocked !== true || recoveredTwoBlocked.reason !== "policy_requires_approval") {
  throw new Error(`observer second recovered native adapter should block before approval: ${JSON.stringify(recoveredTwoBlocked)}`);
}
if (recoveredTwoApproved.approval?.status !== "approved" || recoveredTwoApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`observer second recovered approval should become audited: ${JSON.stringify(recoveredTwoApproved)}`);
}
if (recoveredTwoDeferred.blocked !== true || recoveredTwoDeferred.reason !== "native_plugin_runtime_adapter_implementation_deferred") {
  throw new Error(`observer second recovered native adapter should remain deferred: ${JSON.stringify(recoveredTwoDeferred)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`observer native adapter hardening must not invoke capabilities: ${JSON.stringify(history.summary)}`);
}
if (approvals.summary?.counts?.denied !== 2 || approvals.summary?.counts?.approved !== 2 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`observer approval summary should show hardened chain: ${JSON.stringify(approvals.summary)}`);
}
if (tasks.summary?.counts?.failed !== 2 || tasks.summary?.counts?.queued !== 1) {
  throw new Error(`observer tasks should show failed chain plus deferred recovered native adapter: ${JSON.stringify(tasks.summary)}`);
}
for (const secret of [
  "OBSERVER_RUNTIME_ADAPTER_HARDENING_ROOT_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_ADAPTER_HARDENING_SDK_SECRET_BUILD_BODY",
  "OBSERVER_RUNTIME_ADAPTER_HARDENING_SDK_SECRET_SOURCE_CONTENT",
  "0.0.0-observer-runtime-adapter-hardening-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer native adapter hardening leaked source, script, or package detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativePluginRuntimeAdapterHardening: {
    html: "controls-visible",
    duplicateApprovalSafety: "verified",
    duplicateRecoverySafety: "verified",
    deferredReason: recoveredTwoDeferred.reason,
    approvals: approvals.summary,
  },
}, null, 2));
EOF
