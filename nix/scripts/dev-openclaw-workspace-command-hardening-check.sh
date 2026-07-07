#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-workspace-command-hardening-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-8930}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-8931}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-8932}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-8933}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-8934}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-8935}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-8936}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-8937}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9000}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-workspace-command-hardening-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/apps" "$WORKSPACE_DIR/packages" "$WORKSPACE_DIR/.git"
rm -f "$OPENCLAW_EVENT_LOG_FILE"

write_package_json() {
  local script_body="$1"
  cat > "$WORKSPACE_DIR/package.json" <<JSON
{
  "name": "openclaw",
  "version": "0.0.0-command-hardening-fixture",
  "private": true,
  "scripts": {
    "typecheck": "$script_body"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
JSON
}

write_package_json 'node -e \"process.stderr.write('\''workspace-command-hardening-fail'\''); process.exit(7)\"'
cat > "$WORKSPACE_DIR/package-lock.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-command-hardening-fixture",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "openclaw",
      "version": "0.0.0-command-hardening-fixture"
    }
  }
}
JSON

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${BLOCKED_STEP_FILE:-}" \
    "${SUMMARY_FILE:-}" \
    "${APPROVE_EXPIRED_FILE:-}" \
    "${DENY_EXPIRED_FILE:-}" \
    "${TASKS_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${DUP_APPROVE_FILE:-}" \
    "${DUP_DENY_FILE:-}" \
    "${FAIL_STEP_FILE:-}" \
    "${RECOVERED_ONE_FILE:-}" \
    "${DUP_RECOVERY_FILE:-}" \
    "${RECOVERED_ONE_APPROVED_FILE:-}" \
    "${RECOVERED_ONE_FAIL_FILE:-}" \
    "${RECOVERED_TWO_FILE:-}" \
    "${RECOVERED_TWO_APPROVED_FILE:-}" \
    "${RECOVERED_TWO_STEP_FILE:-}" \
    "${FINAL_TASKS_FILE:-}" \
    "${FINAL_APPROVALS_FILE:-}" \
    "${FINAL_TRANSCRIPTS_FILE:-}" \
    "${FINAL_HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"


post_json_status() {
  local url="$1"
  local body="$2"
  local output_file="$3"
  curl --silent --output "$output_file" --write-out "%{http_code}" -X POST "$url" -H 'content-type: application/json' -d "$body"
}

TASK_FILE="$(mktemp)"
BLOCKED_STEP_FILE="$(mktemp)"
SUMMARY_FILE="$(mktemp)"
APPROVE_EXPIRED_FILE="$(mktemp)"
DENY_EXPIRED_FILE="$(mktemp)"
TASKS_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
DUP_APPROVE_FILE="$(mktemp)"
DUP_DENY_FILE="$(mktemp)"
FAIL_STEP_FILE="$(mktemp)"
RECOVERED_ONE_FILE="$(mktemp)"
DUP_RECOVERY_FILE="$(mktemp)"
RECOVERED_ONE_APPROVED_FILE="$(mktemp)"
RECOVERED_ONE_FAIL_FILE="$(mktemp)"
RECOVERED_TWO_FILE="$(mktemp)"
RECOVERED_TWO_APPROVED_FILE="$(mktemp)"
RECOVERED_TWO_STEP_FILE="$(mktemp)"
FINAL_TASKS_FILE="$(mktemp)"
FINAL_APPROVALS_FILE="$(mktemp)"
FINAL_TRANSCRIPTS_FILE="$(mktemp)"
FINAL_HISTORY_FILE="$(mktemp)"

export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-workspace-command-hardening-expiry-check.json"
export OPENCLAW_APPROVAL_TTL_MS="80"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"
"$SCRIPT_DIR/dev-up.sh"

post_json "$CORE_URL/workspaces/command-proposals/tasks" '{"proposalId":"openclaw:typecheck","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"
openclaw_wait_for_approval_summary_counts "$CORE_URL" "$SUMMARY_FILE" 1 0

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_STEP_FILE" "$SUMMARY_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const summary = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

if (!taskResponse.ok || taskResponse.mode !== "approval-gated" || taskResponse.task?.status !== "queued") {
  throw new Error(`expiry fixture should create approval-gated queued task: ${JSON.stringify(taskResponse)}`);
}
if (!blockedStep.ok || blockedStep.blocked !== true || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`operator should block before approval expiry: ${JSON.stringify(blockedStep)}`);
}
if (summary.summary?.counts?.expired !== 1 || summary.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should expire the stale request: ${JSON.stringify(summary.summary)}`);
}

process.stdout.write(blockedStep.approval.id);
EOF
)"

approve_expired_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-workspace-command-hardening-check"}' "$APPROVE_EXPIRED_FILE")"
deny_expired_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-workspace-command-hardening-check"}' "$DENY_EXPIRED_FILE")"
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
  throw new Error(`approving expired approval should return 409: ${JSON.stringify({ approveStatus, approveExpired })}`);
}
if (denyStatus !== "409" || !String(denyExpired.error ?? "").includes("expired")) {
  throw new Error(`denying expired approval should return 409: ${JSON.stringify({ denyStatus, denyExpired })}`);
}
const expiredTask = (tasks.items ?? []).find((task) => task.approval?.requestId === approvalId);
if (!expiredTask || expiredTask.status !== "failed" || expiredTask.approval?.status !== "expired" || expiredTask.outcome?.reason !== "Approval expired.") {
  throw new Error(`expired approval should fail its active task: ${JSON.stringify(expiredTask)}`);
}
EOF

"$SCRIPT_DIR/dev-down.sh" >/dev/null
unset OPENCLAW_APPROVAL_TTL_MS
export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-workspace-command-hardening-chain-check.json"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"
"$SCRIPT_DIR/dev-up.sh" >/dev/null

post_json "$CORE_URL/workspaces/command-proposals/tasks" '{"proposalId":"openclaw:typecheck","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!taskResponse.ok || taskResponse.mode !== "approval-gated" || taskResponse.task?.status !== "queued") {
  throw new Error(`chain fixture should create approval-gated queued task: ${JSON.stringify(taskResponse)}`);
}
if (!blockedStep.approval?.id || blockedStep.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked step should expose the task approval: ${JSON.stringify(blockedStep)}`);
}

process.stdout.write(blockedStep.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-workspace-command-hardening-check","reason":"approve first failing command"}' > "$APPROVED_FILE"
dup_approve_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-workspace-command-hardening-check"}' "$DUP_APPROVE_FILE")"
dup_deny_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-workspace-command-hardening-check"}' "$DUP_DENY_FILE")"
post_json "$CORE_URL/operator/step" '{}' > "$FAIL_STEP_FILE"

failed_task_id="$(node - <<'EOF' "$APPROVED_FILE" "$DUP_APPROVE_FILE" "$DUP_DENY_FILE" "$FAIL_STEP_FILE" "$dup_approve_status" "$dup_deny_status"
const fs = require("node:fs");
const approved = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const duplicateApprove = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicateDeny = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const failStep = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const duplicateApproveStatus = process.argv[6];
const duplicateDenyStatus = process.argv[7];

if (approved.approval?.status !== "approved") {
  throw new Error(`first approval should succeed: ${JSON.stringify(approved)}`);
}
if (duplicateApproveStatus !== "409" || !String(duplicateApprove.error ?? "").includes("approved")) {
  throw new Error(`duplicate approve should return 409: ${JSON.stringify({ duplicateApproveStatus, duplicateApprove })}`);
}
if (duplicateDenyStatus !== "409" || !String(duplicateDeny.error ?? "").includes("approved")) {
  throw new Error(`deny after approval should return 409: ${JSON.stringify({ duplicateDenyStatus, duplicateDeny })}`);
}
if (!failStep.ok || failStep.ran !== true || failStep.task?.status !== "failed" || failStep.task?.restorable !== true) {
  throw new Error(`approved fixture command should fail as recoverable: ${JSON.stringify(failStep)}`);
}

process.stdout.write(failStep.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$failed_task_id/recover" '{}' > "$RECOVERED_ONE_FILE"
dup_recovery_status="$(post_json_status "$CORE_URL/tasks/$failed_task_id/recover" '{}' "$DUP_RECOVERY_FILE")"

recovered_one_approval_id="$(node - <<'EOF' "$FAIL_STEP_FILE" "$RECOVERED_ONE_FILE" "$DUP_RECOVERY_FILE" "$dup_recovery_status"
const fs = require("node:fs");
const failStep = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const duplicateRecovery = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const duplicateRecoveryStatus = process.argv[5];

if (!recoveredOne.ok || recoveredOne.task?.status !== "queued" || recoveredOne.task?.recovery?.attempt !== 1) {
  throw new Error(`first recovery should create attempt 1 queued task: ${JSON.stringify(recoveredOne)}`);
}
if (recoveredOne.task?.recovery?.recoveredFromTaskId !== failStep.task?.id) {
  throw new Error(`first recovery should link to failed source: ${JSON.stringify(recoveredOne.task?.recovery)}`);
}
if (recoveredOne.recoveredFromTask?.recoveredByTaskId !== recoveredOne.task?.id) {
  throw new Error(`failed source should link to first recovery: ${JSON.stringify(recoveredOne.recoveredFromTask)}`);
}
if (duplicateRecoveryStatus !== "409" || duplicateRecovery.recoveredByTaskId !== recoveredOne.task?.id) {
  throw new Error(`duplicate recovery should return existing recovery as 409: ${JSON.stringify({ duplicateRecoveryStatus, duplicateRecovery })}`);
}

process.stdout.write(recoveredOne.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/approvals/$recovered_one_approval_id/approve" '{"approvedBy":"dev-openclaw-workspace-command-hardening-check","reason":"approve first recovery, still failing"}' > "$RECOVERED_ONE_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_ONE_FAIL_FILE"

recovered_one_task_id="$(node - <<'EOF' "$RECOVERED_ONE_FILE" "$RECOVERED_ONE_FAIL_FILE"
const fs = require("node:fs");
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredOneFail = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!recoveredOneFail.ok || recoveredOneFail.ran !== true || recoveredOneFail.task?.status !== "failed" || recoveredOneFail.task?.id !== recoveredOne.task?.id) {
  throw new Error(`first recovery should fail and remain recoverable for a second recovery: ${JSON.stringify(recoveredOneFail)}`);
}

process.stdout.write(recoveredOneFail.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$recovered_one_task_id/recover" '{}' > "$RECOVERED_TWO_FILE"
write_package_json 'node -e \"process.stdout.write('\''workspace-command-hardening-ok'\'')\"'

recovered_two_approval_id="$(node - <<'EOF' "$RECOVERED_ONE_FAIL_FILE" "$RECOVERED_TWO_FILE"
const fs = require("node:fs");
const recoveredOneFail = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!recoveredTwo.ok || recoveredTwo.task?.status !== "queued" || recoveredTwo.task?.recovery?.attempt !== 2) {
  throw new Error(`second recovery should create attempt 2 queued task: ${JSON.stringify(recoveredTwo)}`);
}
if (recoveredTwo.task?.recovery?.recoveredFromTaskId !== recoveredOneFail.task?.id) {
  throw new Error(`second recovery should link to first recovery failure: ${JSON.stringify(recoveredTwo.task?.recovery)}`);
}
if (recoveredTwo.recoveredFromTask?.recoveredByTaskId !== recoveredTwo.task?.id) {
  throw new Error(`first recovery should link forward to second recovery: ${JSON.stringify(recoveredTwo.recoveredFromTask)}`);
}

process.stdout.write(recoveredTwo.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/approvals/$recovered_two_approval_id/approve" '{"approvedBy":"dev-openclaw-workspace-command-hardening-check","reason":"approve second recovery after fixture repair"}' > "$RECOVERED_TWO_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=8" > "$FINAL_TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=8" > "$FINAL_APPROVALS_FILE"
curl --silent --fail "$CORE_URL/commands/transcripts?limit=8" > "$FINAL_TRANSCRIPTS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.system.command.execute&limit=8" > "$FINAL_HISTORY_FILE"

node - <<'EOF' \
  "$FAIL_STEP_FILE" \
  "$RECOVERED_ONE_FAIL_FILE" \
  "$RECOVERED_TWO_STEP_FILE" \
  "$FINAL_TASKS_FILE" \
  "$FINAL_APPROVALS_FILE" \
  "$FINAL_TRANSCRIPTS_FILE" \
  "$FINAL_HISTORY_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const failStep = readJson(2);
const recoveredOneFail = readJson(3);
const recoveredTwoStep = readJson(4);
const tasks = readJson(5);
const approvals = readJson(6);
const transcripts = readJson(7);
const history = readJson(8);

if (!recoveredTwoStep.ok || recoveredTwoStep.ran !== true || recoveredTwoStep.task?.status !== "completed") {
  throw new Error(`second recovery should complete after repaired fixture: ${JSON.stringify(recoveredTwoStep)}`);
}
if (!String(recoveredTwoStep.execution?.commandTranscript?.[0]?.stdout ?? "").includes("workspace-command-hardening-ok")) {
  throw new Error(`second recovery should capture repaired command stdout: ${JSON.stringify(recoveredTwoStep.execution?.commandTranscript?.[0])}`);
}

const source = (tasks.items ?? []).find((task) => task.id === failStep.task?.id);
const recoveredOne = (tasks.items ?? []).find((task) => task.id === recoveredOneFail.task?.id);
const recoveredTwo = (tasks.items ?? []).find((task) => task.id === recoveredTwoStep.task?.id);
if (!source || source.status !== "failed" || source.recoveredByTaskId !== recoveredOne?.id) {
  throw new Error(`source should retain first recovery link: ${JSON.stringify(source)}`);
}
if (!recoveredOne || recoveredOne.status !== "failed" || recoveredOne.recoveredByTaskId !== recoveredTwo?.id || recoveredOne.recovery?.attempt !== 1) {
  throw new Error(`first recovery should retain second recovery link: ${JSON.stringify(recoveredOne)}`);
}
if (!recoveredTwo || recoveredTwo.status !== "completed" || recoveredTwo.recovery?.recoveredFromTaskId !== recoveredOne.id || recoveredTwo.recovery?.attempt !== 2) {
  throw new Error(`second recovery should complete with attempt 2 metadata: ${JSON.stringify(recoveredTwo)}`);
}
if (tasks.summary?.counts?.failed !== 2 || tasks.summary?.counts?.completed !== 1 || tasks.summary?.counts?.active !== 0) {
  throw new Error(`task summary should show two failed chain links and one completed recovery: ${JSON.stringify(tasks.summary)}`);
}
if (approvals.summary?.counts?.approved !== 3 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should show three approved gates and no pending approvals: ${JSON.stringify(approvals.summary)}`);
}
if (transcripts.summary?.total !== 3 || transcripts.summary?.failed !== 2 || transcripts.summary?.executed !== 1) {
  throw new Error(`transcript ledger should show two failed commands and one repaired execution: ${JSON.stringify(transcripts.summary)}`);
}
if (history.summary?.total !== 3 || history.summary?.invoked !== 3 || history.summary?.blocked !== 0) {
  throw new Error(`capability history should show exactly three governed invocations: ${JSON.stringify(history.summary)}`);
}

console.log(JSON.stringify({
  openclawWorkspaceCommandHardening: {
    approvalExpiry: "expired approvals fail active tasks and reject late clicks",
    duplicateApprovalClicks: "approve/deny after resolution return 409",
    duplicateRecovery: "a source task can materialize one direct recovery task",
    recoveryChain: [
      { id: source.id, status: source.status, recoveredByTaskId: source.recoveredByTaskId },
      { id: recoveredOne.id, status: recoveredOne.status, attempt: recoveredOne.recovery?.attempt, recoveredByTaskId: recoveredOne.recoveredByTaskId },
      { id: recoveredTwo.id, status: recoveredTwo.status, attempt: recoveredTwo.recovery?.attempt, recoveredFromTaskId: recoveredTwo.recovery?.recoveredFromTaskId },
    ],
    summaries: {
      tasks: tasks.summary?.counts ?? null,
      approvals: approvals.summary ?? null,
      transcripts: transcripts.summary ?? null,
      capabilityHistory: history.summary ?? null,
    },
  },
}, null, 2));
EOF
