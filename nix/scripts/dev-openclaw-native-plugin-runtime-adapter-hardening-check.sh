#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-adapter-hardening-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9420}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9421}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9422}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9423}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9424}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9425}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9426}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9427}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9490}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-runtime-adapter-hardening-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"


post_json_status() {
  curl --silent --output "$3" --write-out "%{http_code}" -X POST "$1" -H 'content-type: application/json' -d "$2"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/extensions/provider-a" "$WORKSPACE_DIR/extensions/provider-b" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_EVENT_LOG_FILE"
for index in $(seq 1 9); do mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"; done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-runtime-adapter-hardening-fixture",
  "private": true,
  "scripts": {
    "build": "echo RUNTIME_ADAPTER_HARDENING_ROOT_SECRET_BUILD_BODY"
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
  "version": "0.0.0-runtime-adapter-hardening-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "echo RUNTIME_ADAPTER_HARDENING_SDK_SECRET_BUILD_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-runtime-adapter-hardening-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const RUNTIME_ADAPTER_HARDENING_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${SUMMARY_FILE:-}" \
    "${APPROVE_EXPIRED_FILE:-}" \
    "${DENY_EXPIRED_FILE:-}" \
    "${TASKS_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${DUP_APPROVE_FILE:-}" \
    "${DUP_DENY_FILE:-}" \
    "${DEFERRED_FILE:-}" \
    "${DENIED_ONE_FILE:-}" \
    "${RECOVERED_ONE_FILE:-}" \
    "${DUP_RECOVERY_FILE:-}" \
    "${DENIED_TWO_FILE:-}" \
    "${RECOVERED_TWO_FILE:-}" \
    "${RECOVERED_TWO_BLOCKED_FILE:-}" \
    "${RECOVERED_TWO_APPROVED_FILE:-}" \
    "${RECOVERED_TWO_DEFERRED_FILE:-}" \
    "${FINAL_TASKS_FILE:-}" \
    "${FINAL_APPROVALS_FILE:-}" \
    "${FINAL_HISTORY_FILE:-}" \
    "${FINAL_EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
APPROVE_EXPIRED_FILE="$(mktemp)"
DENY_EXPIRED_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"
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
FINAL_TASKS_FILE="$(mktemp)"
FINAL_APPROVALS_FILE="$(mktemp)"
FINAL_HISTORY_FILE="$(mktemp)"
FINAL_EVENTS_FILE="$(mktemp)"

export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-native-plugin-runtime-adapter-hardening-expiry-check.json"
export OPENCLAW_APPROVAL_TTL_MS="80"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"
"$SCRIPT_DIR/dev-up.sh" >/dev/null

post_json "$CORE_URL/plugins/native-adapter/runtime-adapter-tasks" '{"capabilityId":"act.plugin.capability.invoke","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"
openclaw_wait_for_approval_summary_counts "$CORE_URL" "$SUMMARY_FILE" 1 0

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE" "$SUMMARY_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const summary = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`expiry fixture should create native adapter task: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.ok || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block before native adapter approval expiry: ${JSON.stringify(blocked)}`);
}
if (summary.summary?.counts?.expired !== 1 || summary.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should expire stale native adapter request: ${JSON.stringify(summary.summary)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

approve_expired_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check"}' "$APPROVE_EXPIRED_FILE")"
deny_expired_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check"}' "$DENY_EXPIRED_FILE")"
curl --silent --fail "$CORE_URL/tasks?limit=4" > "$TASKS_FILE"

node - <<'EOF' "$APPROVE_EXPIRED_FILE" "$DENY_EXPIRED_FILE" "$TASKS_FILE" "$approve_expired_status" "$deny_expired_status" "$approval_id"
const fs = require("node:fs");
const approveExpired = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const denyExpired = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const tasks = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const approveStatus = process.argv[5];
const denyStatus = process.argv[6];
const approvalId = process.argv[7];
if (approveStatus !== "409" || !String(approveExpired.error ?? "").includes("expired")) {
  throw new Error(`approving expired native adapter approval should return 409: ${JSON.stringify({ approveStatus, approveExpired })}`);
}
if (denyStatus !== "409" || !String(denyExpired.error ?? "").includes("expired")) {
  throw new Error(`denying expired native adapter approval should return 409: ${JSON.stringify({ denyStatus, denyExpired })}`);
}
const expiredTask = (tasks.items ?? []).find((task) => task.approval?.requestId === approvalId);
if (!expiredTask || expiredTask.status !== "failed" || expiredTask.approval?.status !== "expired" || expiredTask.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`expired native adapter approval should fail its active task: ${JSON.stringify(expiredTask)}`);
}
EOF

"$SCRIPT_DIR/dev-down.sh" >/dev/null
unset OPENCLAW_APPROVAL_TTL_MS
export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-native-plugin-runtime-adapter-hardening-chain-check.json"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"
"$SCRIPT_DIR/dev-up.sh" >/dev/null

post_json "$CORE_URL/plugins/native-adapter/runtime-adapter-tasks" '{"capabilityId":"act.plugin.capability.invoke","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`chain fixture should create native adapter task: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked step should expose native adapter task approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"approve first native adapter task"}' > "$APPROVED_FILE"
dup_approve_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check"}' "$DUP_APPROVE_FILE")"
dup_deny_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check"}' "$DUP_DENY_FILE")"
post_json "$CORE_URL/operator/step" '{}' > "$DEFERRED_FILE"

node - <<'EOF' "$APPROVED_FILE" "$DUP_APPROVE_FILE" "$DUP_DENY_FILE" "$DEFERRED_FILE" "$dup_approve_status" "$dup_deny_status"
const fs = require("node:fs");
const approved = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const duplicateApprove = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicateDeny = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const deferred = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const duplicateApproveStatus = process.argv[6];
const duplicateDenyStatus = process.argv[7];
if (approved.approval?.status !== "approved") {
  throw new Error(`first native adapter approval should succeed: ${JSON.stringify(approved)}`);
}
if (duplicateApproveStatus !== "409" || !String(duplicateApprove.error ?? "").includes("approved")) {
  throw new Error(`duplicate native adapter approve should return 409: ${JSON.stringify({ duplicateApproveStatus, duplicateApprove })}`);
}
if (duplicateDenyStatus !== "409" || !String(duplicateDeny.error ?? "").includes("approved")) {
  throw new Error(`deny after native adapter approval should return 409: ${JSON.stringify({ duplicateDenyStatus, duplicateDeny })}`);
}
if (!deferred.ok || deferred.ran !== false || deferred.blocked !== true || deferred.reason !== "native_plugin_runtime_adapter_implementation_deferred") {
  throw new Error(`approved native adapter task should remain deferred: ${JSON.stringify(deferred)}`);
}
EOF

post_json "$CORE_URL/plugins/native-adapter/runtime-adapter-tasks" '{"capabilityId":"act.plugin.capability.invoke","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

chain_approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`recovery chain fixture should create native adapter task: ${JSON.stringify(taskResponse)}`);
}
if (blocked.approval?.id !== taskResponse.approval?.id) {
  throw new Error(`recovery chain blocked step should expose approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$chain_approval_id/deny" '{"deniedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"deny native adapter chain source"}' > "$DENIED_ONE_FILE"

denied_one_task_id="$(node - <<'EOF' "$DENIED_ONE_FILE"
const fs = require("node:fs");
const deniedOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!deniedOne.ok || deniedOne.task?.status !== "failed" || deniedOne.task?.restorable !== true) {
  throw new Error(`first native adapter denial should fail as recoverable: ${JSON.stringify(deniedOne)}`);
}
process.stdout.write(deniedOne.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_one_task_id/recover" '{}' > "$RECOVERED_ONE_FILE"
dup_recovery_status="$(post_json_status "$CORE_URL/tasks/$denied_one_task_id/recover" '{}' "$DUP_RECOVERY_FILE")"

recovered_one_approval_id="$(node - <<'EOF' "$DENIED_ONE_FILE" "$RECOVERED_ONE_FILE" "$DUP_RECOVERY_FILE" "$dup_recovery_status"
const fs = require("node:fs");
const deniedOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicateRecovery = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const duplicateRecoveryStatus = process.argv[5];
if (!recoveredOne.ok || recoveredOne.task?.status !== "queued" || recoveredOne.task?.recovery?.attempt !== 1 || recoveredOne.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`first native adapter recovery should create attempt 1: ${JSON.stringify(recoveredOne)}`);
}
if (recoveredOne.task?.recovery?.recoveredFromTaskId !== deniedOne.task?.id) {
  throw new Error(`first native adapter recovery should link to denied source: ${JSON.stringify(recoveredOne.task?.recovery)}`);
}
if (duplicateRecoveryStatus !== "409" || duplicateRecovery.recoveredByTaskId !== recoveredOne.task?.id) {
  throw new Error(`duplicate native adapter recovery should return 409 with existing recovery: ${JSON.stringify({ duplicateRecoveryStatus, duplicateRecovery })}`);
}
process.stdout.write(recoveredOne.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/approvals/$recovered_one_approval_id/deny" '{"deniedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"deny first recovered native adapter"}' > "$DENIED_TWO_FILE"

denied_two_task_id="$(node - <<'EOF' "$RECOVERED_ONE_FILE" "$DENIED_TWO_FILE"
const fs = require("node:fs");
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const deniedTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!deniedTwo.ok || deniedTwo.task?.id !== recoveredOne.task?.id || deniedTwo.task?.status !== "failed" || deniedTwo.task?.recovery?.attempt !== 1) {
  throw new Error(`denying first recovered native adapter should fail attempt 1: ${JSON.stringify(deniedTwo)}`);
}
process.stdout.write(deniedTwo.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$denied_two_task_id/recover" '{}' > "$RECOVERED_TWO_FILE"

recovered_two_approval_id="$(node - <<'EOF' "$DENIED_TWO_FILE" "$RECOVERED_TWO_FILE"
const fs = require("node:fs");
const deniedTwo = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!recoveredTwo.ok || recoveredTwo.task?.status !== "queued" || recoveredTwo.task?.recovery?.attempt !== 2 || recoveredTwo.task?.type !== "native_plugin_runtime_adapter_implementation") {
  throw new Error(`second native adapter recovery should create attempt 2: ${JSON.stringify(recoveredTwo)}`);
}
if (recoveredTwo.task?.recovery?.recoveredFromTaskId !== deniedTwo.task?.id) {
  throw new Error(`second native adapter recovery should link to failed attempt 1: ${JSON.stringify(recoveredTwo.task?.recovery)}`);
}
process.stdout.write(recoveredTwo.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_BLOCKED_FILE"
post_json "$CORE_URL/approvals/$recovered_two_approval_id/approve" '{"approvedBy":"dev-openclaw-native-plugin-runtime-adapter-hardening-check","reason":"approve second recovered native adapter"}' > "$RECOVERED_TWO_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_DEFERRED_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=20" > "$FINAL_TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=20" > "$FINAL_APPROVALS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=20" > "$FINAL_HISTORY_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?limit=200" > "$FINAL_EVENTS_FILE"

node - <<'EOF' "$RECOVERED_TWO_BLOCKED_FILE" "$RECOVERED_TWO_APPROVED_FILE" "$RECOVERED_TWO_DEFERRED_FILE" "$FINAL_TASKS_FILE" "$FINAL_APPROVALS_FILE" "$FINAL_HISTORY_FILE" "$FINAL_EVENTS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const recoveredTwoBlocked = readJson(2);
const recoveredTwoApproved = readJson(3);
const recoveredTwoDeferred = readJson(4);
const tasks = readJson(5);
const approvals = readJson(6);
const history = readJson(7);
const events = readJson(8);
const raw = JSON.stringify({ recoveredTwoBlocked, recoveredTwoApproved, recoveredTwoDeferred, tasks, approvals, history, events });

if (recoveredTwoBlocked.blocked !== true || recoveredTwoBlocked.reason !== "policy_requires_approval") {
  throw new Error(`second recovered native adapter should block before approval: ${JSON.stringify(recoveredTwoBlocked)}`);
}
if (recoveredTwoApproved.approval?.status !== "approved" || recoveredTwoApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`second recovered native adapter approval should become audited: ${JSON.stringify(recoveredTwoApproved)}`);
}
if (recoveredTwoDeferred.blocked !== true || recoveredTwoDeferred.reason !== "native_plugin_runtime_adapter_implementation_deferred") {
  throw new Error(`second recovered native adapter should remain deferred: ${JSON.stringify(recoveredTwoDeferred)}`);
}
if (history.summary?.total !== 0 || history.summary?.invoked !== 0 || history.summary?.blocked !== 0) {
  throw new Error(`native adapter hardening must not invoke capabilities: ${JSON.stringify(history.summary)}`);
}
if (approvals.summary?.counts?.denied !== 2 || approvals.summary?.counts?.approved !== 2 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should show duplicate-safe approvals and recovery chain: ${JSON.stringify(approvals.summary)}`);
}
if (
  tasks.summary?.counts?.failed !== 2
  || tasks.summary?.counts?.queued !== 1
  || tasks.summary?.counts?.superseded !== 1
  || tasks.summary?.counts?.recoverable < 3
) {
  throw new Error(`task summary should show failed chain plus deferred recovered native adapter task: ${JSON.stringify(tasks.summary)}`);
}
const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["approval.created", "approval.denied", "approval.approved", "task.recovered", "task.failed", "task.blocked"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}
for (const secret of [
  "RUNTIME_ADAPTER_HARDENING_ROOT_SECRET_BUILD_BODY",
  "RUNTIME_ADAPTER_HARDENING_SDK_SECRET_BUILD_BODY",
  "RUNTIME_ADAPTER_HARDENING_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-runtime-adapter-hardening-secret-version",
  "0.0.0-runtime-adapter-hardening-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`native adapter hardening leaked source, script, dependency, or package detail: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginRuntimeAdapterHardening: {
    duplicateApprovalSafety: "verified",
    duplicateRecoverySafety: "verified",
    recoveryChain: {
      failed: tasks.summary.counts.failed,
      queued: tasks.summary.counts.queued,
      recoverable: tasks.summary.counts.recoverable,
      deferredReason: recoveredTwoDeferred.reason,
    },
    approvals: approvals.summary,
  },
}, null, 2));
EOF
