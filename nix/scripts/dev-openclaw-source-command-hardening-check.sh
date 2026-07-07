#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-source-command-hardening-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
DOCS_TOOLS_DIR="$WORKSPACE_DIR/docs/tools"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9880}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9881}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9882}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9883}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9884}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9885}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9886}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9887}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9950}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-source-command-hardening-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$TOOLS_DIR" "$DOCS_TOOLS_DIR"
rm -f "$OPENCLAW_EVENT_LOG_FILE"

write_package_json() {
  local script_body="$1"
  cat > "$WORKSPACE_DIR/package.json" <<JSON
{
  "name": "openclaw",
  "private": true,
  "scripts": {
    "typecheck": "$script_body"
  }
}
JSON
}

write_package_json 'node -e \"process.stderr.write('\''source-command-hardening-fail'\''); process.exit(7)\"'
cat > "$WORKSPACE_DIR/package-lock.json" <<'JSON'
{"name":"openclaw","lockfileVersion":3,"requires":true,"packages":{"":{"name":"openclaw"}}}
JSON
cat > "$WORKSPACE_DIR/TOOLS.md" <<'MD'
# Tools
Source command hardening requires expiry, duplicate-click safety, and recovery chains.
MD
cat > "$DOCS_TOOLS_DIR/command-runner.md" <<'MD'
# Command Runner
Harden source-derived command execution behind approval and recovery chains.
MD
cat > "$TOOLS_DIR/command-tool.ts" <<'TS'
export function sourceCommandHardeningTool() {
  return { kind: "source-command-hardening" };
}
TS
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{"name":"@openclaw/plugin-sdk","private":false,"types":"./types/index.d.ts","exports":{".":"./dist/index.js"}}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export function createSourceCommandHardeningContract() {
  return { capabilityId: "source-command-hardening" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SourceCommandHardeningManifest = { pluginId: string };
TS

cleanup() {
  rm -f "${TASK_FILE:-}" "${BLOCKED_STEP_FILE:-}" "${SUMMARY_FILE:-}" "${APPROVE_EXPIRED_FILE:-}" "${DENY_EXPIRED_FILE:-}" "${TASKS_FILE:-}" "${APPROVED_FILE:-}" "${DUP_APPROVE_FILE:-}" "${DUP_DENY_FILE:-}" "${FAIL_STEP_FILE:-}" "${RECOVERED_ONE_FILE:-}" "${DUP_RECOVERY_FILE:-}" "${RECOVERED_ONE_APPROVED_FILE:-}" "${RECOVERED_ONE_FAIL_FILE:-}" "${RECOVERED_TWO_FILE:-}" "${RECOVERED_TWO_APPROVED_FILE:-}" "${RECOVERED_TWO_STEP_FILE:-}" "${FINAL_TASKS_FILE:-}" "${FINAL_APPROVALS_FILE:-}" "${FINAL_TRANSCRIPTS_FILE:-}" "${FINAL_HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"


post_json_status() {
  curl --silent --output "$3" --write-out "%{http_code}" -X POST "$1" -H 'content-type: application/json' -d "$2"
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

export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-source-command-hardening-expiry-check.json"
export OPENCLAW_APPROVAL_TTL_MS="80"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"
"$SCRIPT_DIR/dev-up.sh" >/dev/null

post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"command","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"
openclaw_wait_for_approval_summary_counts "$CORE_URL" "$SUMMARY_FILE" 1 0

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_STEP_FILE" "$SUMMARY_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const summary = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
if (!taskResponse.ok || taskResponse.registry !== "openclaw-source-command-task-v0" || taskResponse.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`expiry fixture should create source command task: ${JSON.stringify(taskResponse)}`);
}
if (!blockedStep.ok || blockedStep.blocked !== true || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`operator should block before source approval expiry: ${JSON.stringify(blockedStep)}`);
}
if (summary.summary?.counts?.expired !== 1 || summary.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should expire the stale source request: ${JSON.stringify(summary.summary)}`);
}
process.stdout.write(blockedStep.approval.id);
EOF
)"

approve_expired_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-source-command-hardening-check"}' "$APPROVE_EXPIRED_FILE")"
deny_expired_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-source-command-hardening-check"}' "$DENY_EXPIRED_FILE")"
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
  throw new Error(`approving expired source approval should return 409: ${JSON.stringify({ approveStatus, approveExpired })}`);
}
if (denyStatus !== "409" || !String(denyExpired.error ?? "").includes("expired")) {
  throw new Error(`denying expired source approval should return 409: ${JSON.stringify({ denyStatus, denyExpired })}`);
}
const expiredTask = (tasks.items ?? []).find((task) => task.approval?.requestId === approvalId);
if (!expiredTask || expiredTask.status !== "failed" || expiredTask.approval?.status !== "expired" || expiredTask.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`expired source approval should fail its active task with provenance: ${JSON.stringify(expiredTask)}`);
}
EOF

"$SCRIPT_DIR/dev-down.sh" >/dev/null
unset OPENCLAW_APPROVAL_TTL_MS
export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-source-command-hardening-chain-check.json"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"
"$SCRIPT_DIR/dev-up.sh" >/dev/null

post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"command","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`chain fixture should create source command task: ${JSON.stringify(taskResponse)}`);
}
if (!blockedStep.approval?.id || blockedStep.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked step should expose source task approval: ${JSON.stringify(blockedStep)}`);
}
process.stdout.write(blockedStep.approval.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-source-command-hardening-check","reason":"approve first failing source command"}' > "$APPROVED_FILE"
dup_approve_status="$(post_json_status "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-source-command-hardening-check"}' "$DUP_APPROVE_FILE")"
dup_deny_status="$(post_json_status "$CORE_URL/approvals/$approval_id/deny" '{"deniedBy":"dev-openclaw-source-command-hardening-check"}' "$DUP_DENY_FILE")"
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
  throw new Error(`first source approval should succeed: ${JSON.stringify(approved)}`);
}
if (duplicateApproveStatus !== "409" || !String(duplicateApprove.error ?? "").includes("approved")) {
  throw new Error(`duplicate source approve should return 409: ${JSON.stringify({ duplicateApproveStatus, duplicateApprove })}`);
}
if (duplicateDenyStatus !== "409" || !String(duplicateDeny.error ?? "").includes("approved")) {
  throw new Error(`deny after source approval should return 409: ${JSON.stringify({ duplicateDenyStatus, duplicateDeny })}`);
}
if (!failStep.ok || failStep.ran !== true || failStep.task?.status !== "failed" || failStep.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0" || failStep.task?.restorable !== true) {
  throw new Error(`approved source fixture command should fail as recoverable: ${JSON.stringify(failStep)}`);
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
if (!recoveredOne.ok || recoveredOne.task?.status !== "queued" || recoveredOne.task?.recovery?.attempt !== 1 || recoveredOne.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`first source recovery should create provenance-preserving attempt 1: ${JSON.stringify(recoveredOne)}`);
}
if (recoveredOne.task?.recovery?.recoveredFromTaskId !== failStep.task?.id) {
  throw new Error(`first source recovery should link to failed source: ${JSON.stringify(recoveredOne.task?.recovery)}`);
}
if (duplicateRecoveryStatus !== "409" || duplicateRecovery.recoveredByTaskId !== recoveredOne.task?.id) {
  throw new Error(`duplicate source recovery should return existing recovery as 409: ${JSON.stringify({ duplicateRecoveryStatus, duplicateRecovery })}`);
}
process.stdout.write(recoveredOne.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/approvals/$recovered_one_approval_id/approve" '{"approvedBy":"dev-openclaw-source-command-hardening-check","reason":"approve first source recovery, still failing"}' > "$RECOVERED_ONE_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_ONE_FAIL_FILE"

recovered_one_task_id="$(node - <<'EOF' "$RECOVERED_ONE_FILE" "$RECOVERED_ONE_FAIL_FILE"
const fs = require("node:fs");
const recoveredOne = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredOneFail = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!recoveredOneFail.ok || recoveredOneFail.ran !== true || recoveredOneFail.task?.status !== "failed" || recoveredOneFail.task?.id !== recoveredOne.task?.id || recoveredOneFail.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`first source recovery should fail and remain recoverable: ${JSON.stringify(recoveredOneFail)}`);
}
process.stdout.write(recoveredOneFail.task.id);
EOF
)"

post_json "$CORE_URL/tasks/$recovered_one_task_id/recover" '{}' > "$RECOVERED_TWO_FILE"
write_package_json 'node -e \"process.stdout.write('\''source-command-hardening-ok'\'')\"'

recovered_two_approval_id="$(node - <<'EOF' "$RECOVERED_ONE_FAIL_FILE" "$RECOVERED_TWO_FILE"
const fs = require("node:fs");
const recoveredOneFail = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const recoveredTwo = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!recoveredTwo.ok || recoveredTwo.task?.status !== "queued" || recoveredTwo.task?.recovery?.attempt !== 2 || recoveredTwo.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`second source recovery should create provenance-preserving attempt 2: ${JSON.stringify(recoveredTwo)}`);
}
if (recoveredTwo.task?.recovery?.recoveredFromTaskId !== recoveredOneFail.task?.id) {
  throw new Error(`second source recovery should link to first recovery failure: ${JSON.stringify(recoveredTwo.task?.recovery)}`);
}
process.stdout.write(recoveredTwo.task.approval.requestId);
EOF
)"

post_json "$CORE_URL/approvals/$recovered_two_approval_id/approve" '{"approvedBy":"dev-openclaw-source-command-hardening-check","reason":"approve second source recovery after fixture repair"}' > "$RECOVERED_TWO_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$RECOVERED_TWO_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks?limit=8" > "$FINAL_TASKS_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=8" > "$FINAL_APPROVALS_FILE"
curl --silent --fail "$CORE_URL/commands/transcripts?limit=8" > "$FINAL_TRANSCRIPTS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.system.command.execute&limit=8" > "$FINAL_HISTORY_FILE"

node - <<'EOF' "$FAIL_STEP_FILE" "$RECOVERED_ONE_FAIL_FILE" "$RECOVERED_TWO_STEP_FILE" "$FINAL_TASKS_FILE" "$FINAL_APPROVALS_FILE" "$FINAL_TRANSCRIPTS_FILE" "$FINAL_HISTORY_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const failStep = readJson(2);
const recoveredOneFail = readJson(3);
const recoveredTwoStep = readJson(4);
const tasks = readJson(5);
const approvals = readJson(6);
const transcripts = readJson(7);
const history = readJson(8);
if (!recoveredTwoStep.ok || recoveredTwoStep.ran !== true || recoveredTwoStep.task?.status !== "completed" || recoveredTwoStep.task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
  throw new Error(`second source recovery should complete after repaired fixture: ${JSON.stringify(recoveredTwoStep)}`);
}
if (!String(recoveredTwoStep.execution?.commandTranscript?.[0]?.stdout ?? "").includes("source-command-hardening-ok")) {
  throw new Error(`second source recovery should capture repaired stdout: ${JSON.stringify(recoveredTwoStep.execution?.commandTranscript?.[0])}`);
}
const source = (tasks.items ?? []).find((task) => task.id === failStep.task?.id);
const recoveredOne = (tasks.items ?? []).find((task) => task.id === recoveredOneFail.task?.id);
const recoveredTwo = (tasks.items ?? []).find((task) => task.id === recoveredTwoStep.task?.id);
for (const task of [source, recoveredOne, recoveredTwo]) {
  if (task?.sourceCommand?.registry !== "openclaw-source-command-task-v0") {
    throw new Error(`source command provenance should survive hardening chain: ${JSON.stringify(task)}`);
  }
}
if (!source || source.status !== "failed" || source.recoveredByTaskId !== recoveredOne?.id) {
  throw new Error(`source should retain first recovery link: ${JSON.stringify(source)}`);
}
if (!recoveredOne || recoveredOne.status !== "failed" || recoveredOne.recoveredByTaskId !== recoveredTwo?.id || recoveredOne.recovery?.attempt !== 1) {
  throw new Error(`first source recovery should retain second recovery link: ${JSON.stringify(recoveredOne)}`);
}
if (!recoveredTwo || recoveredTwo.status !== "completed" || recoveredTwo.recovery?.attempt !== 2) {
  throw new Error(`second source recovery should complete with attempt 2 metadata: ${JSON.stringify(recoveredTwo)}`);
}
if (tasks.summary?.counts?.failed !== 2 || tasks.summary?.counts?.completed !== 1 || tasks.summary?.counts?.active !== 0) {
  throw new Error(`task summary should show two failed source chain links and one completed recovery: ${JSON.stringify(tasks.summary)}`);
}
if (approvals.summary?.counts?.approved !== 3 || approvals.summary?.counts?.pending !== 0) {
  throw new Error(`approval summary should show three approved source gates and no pending approvals: ${JSON.stringify(approvals.summary)}`);
}
if (transcripts.summary?.total !== 3 || transcripts.summary?.failed !== 2 || transcripts.summary?.executed !== 1 || !(transcripts.items ?? []).every((item) => item.sourceCommand?.registry === "openclaw-source-command-task-v0")) {
  throw new Error(`transcript ledger should show three source command invocations with provenance: ${JSON.stringify(transcripts)}`);
}
if (history.summary?.total !== 3 || history.summary?.invoked !== 3 || history.summary?.blocked !== 0) {
  throw new Error(`capability history should show exactly three governed source invocations: ${JSON.stringify(history.summary)}`);
}
console.log(JSON.stringify({
  openclawSourceCommandHardening: {
    approvalExpiry: "expired source approvals fail active tasks and reject late clicks",
    duplicateApprovalClicks: "approve/deny after resolution return 409",
    duplicateRecovery: "a source command task can materialize one direct recovery task",
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
