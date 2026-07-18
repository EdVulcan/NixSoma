#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-write-closed-loop-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="src/write-closed-loop.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
WRITE_SECRET="OPENCLAW_WRITE_CLOSED_LOOP_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-verification-evidence-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10400}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10401}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10402}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10403}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10404}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10405}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10406}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10407}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10408}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_AUTONOMY_MODE="${OPENCLAW_AUTONOMY_MODE:-guardian}"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-write-closed-loop-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-write-closed-loop-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_verification_evidence_fixture "$WORKSPACE_DIR" \
  "ENGINEERING_WRITE_CLOSED_LOOP_PROMPT_SECRET_DO_NOT_LEAK" \
  "ENGINEERING_WRITE_CLOSED_LOOP_TOOL_SECRET_DO_NOT_LEAK"
cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true,
  "scripts": {
    "typecheck": "test -f src/write-closed-loop.txt && grep -q OPENCLAW_WRITE_CLOSED_LOOP src/write-closed-loop.txt && printf engineering-write-closed-loop-ok"
  }
}
JSON
rm -f "$TARGET_FILE" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${READ_FILE:-}" \
    "${GLOB_FILE:-}" \
    "${GREP_FILE:-}" \
    "${WRITE_TASK_FILE:-}" \
    "${WRITE_BLOCKED_FILE:-}" \
    "${WRITE_APPROVE_FILE:-}" \
    "${WRITE_STEP_FILE:-}" \
    "${WRITE_HISTORY_FILE:-}" \
    "${WRITE_LEDGER_FILE:-}" \
    "${WRITE_EVIDENCE_FILE:-}" \
    "${VERIFY_TASK_FILE:-}" \
    "${VERIFY_BLOCKED_FILE:-}" \
    "${VERIFY_APPROVE_FILE:-}" \
    "${VERIFY_STEP_FILE:-}" \
    "${VERIFY_EVIDENCE_FILE:-}" \
    "${RECOVERY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
READ_FILE="$(mktemp)"
GLOB_FILE="$(mktemp)"
GREP_FILE="$(mktemp)"
WRITE_TASK_FILE="$(mktemp)"
WRITE_BLOCKED_FILE="$(mktemp)"
WRITE_APPROVE_FILE="$(mktemp)"
WRITE_STEP_FILE="$(mktemp)"
WRITE_HISTORY_FILE="$(mktemp)"
WRITE_LEDGER_FILE="$(mktemp)"
WRITE_EVIDENCE_FILE="$(mktemp)"
VERIFY_TASK_FILE="$(mktemp)"
VERIFY_BLOCKED_FILE="$(mktemp)"
VERIFY_APPROVE_FILE="$(mktemp)"
VERIFY_STEP_FILE="$(mktemp)"
VERIFY_EVIDENCE_FILE="$(mktemp)"
RECOVERY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-read-search/read?relativePath=package.json&maxOutputChars=4000" > "$READ_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-read-search/glob?pattern=src/**/*.ts&limit=8" > "$GLOB_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-read-search/grep?query=createVerificationEvidenceContract&include=packages/plugin-sdk/src/*.ts&literal=true&limit=8&maxOutputChars=2000" > "$GREP_FILE"

node - <<'EOF' "$READ_FILE" "$GLOB_FILE" "$GREP_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const read = readJson(2);
const glob = readJson(3);
const grep = readJson(4);

if (
  !read.ok
  || read.operation !== "read"
  || read.capability?.id !== "sense.openclaw.engineering_tool.read"
  || read.target?.relativePath !== "package.json"
  || read.summary?.blocked !== false
) {
  throw new Error(`closed-loop read/search read step mismatch: ${JSON.stringify(read)}`);
}
if (
  !glob.ok
  || glob.operation !== "glob"
  || glob.capability?.id !== "sense.openclaw.engineering_tool.glob"
  || glob.summary?.matchedResults < 1
  || !glob.matches?.some((match) => match.relativePath === "src/agents/tools/verify-tool.ts" && match.contentRead === false)
) {
  throw new Error(`closed-loop read/search glob step mismatch: ${JSON.stringify(glob)}`);
}
if (
  !grep.ok
  || grep.operation !== "grep"
  || grep.capability?.id !== "sense.openclaw.engineering_tool.grep"
  || grep.summary?.matchedResults < 1
  || !grep.matches?.some((match) => match.relativePath === "packages/plugin-sdk/src/index.ts")
) {
  throw new Error(`closed-loop read/search grep step mismatch: ${JSON.stringify(grep)}`);
}
EOF

post_json "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks" "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"content\":\"$WRITE_SECRET\",\"overwrite\":false,\"confirm\":true}" > "$WRITE_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$WRITE_BLOCKED_FILE"

read -r write_approval_id write_task_id < <(node - <<'EOF' "$WRITE_TASK_FILE" "$WRITE_BLOCKED_FILE" "$TARGET_FILE" "$WRITE_SECRET"
const fs = require("node:fs");
const task = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const targetFile = process.argv[4];
const secret = process.argv[5];
const raw = JSON.stringify({ task, blocked });

if (
  !task.ok
  || task.registry !== "openclaw-native-engineering-write-proposal-task-v0"
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.engineeringWriteProposal?.contentExposed !== false
  || task.workspaceTextWrite?.registry !== "openclaw-native-workspace-text-write-task-v0"
) {
  throw new Error(`write task bridge mismatch: ${JSON.stringify(task)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`write should block before approval: ${JSON.stringify(blocked)}`);
}
if (fs.existsSync(targetFile)) {
  throw new Error("write target existed before approval");
}
if (raw.includes(secret)) {
  throw new Error("write setup leaked proposed content");
}
process.stdout.write(`${task.approval.id} ${task.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$write_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-write-closed-loop-check","reason":"approve closed-loop write fixture"}' > "$WRITE_APPROVE_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$WRITE_STEP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=10" > "$WRITE_HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=20" > "$WRITE_LEDGER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-execution/evidence?taskId=$write_task_id&limit=10" > "$WRITE_EVIDENCE_FILE"

verify_approval_id=""
verify_task_id=""
if [[ "$OPENCLAW_AUTONOMY_MODE" == "sovereign_body" ]]; then
  printf '%s\n' '{"skipped":true}' > "$VERIFY_TASK_FILE"
  printf '%s\n' '{"skipped":true}' > "$VERIFY_BLOCKED_FILE"
  printf '%s\n' '{"skipped":true}' > "$VERIFY_APPROVE_FILE"
  printf '%s\n' '{"skipped":true}' > "$VERIFY_STEP_FILE"
  printf '%s\n' '{"skipped":true}' > "$VERIFY_EVIDENCE_FILE"
  printf '%s\n' '{"skipped":true}' > "$RECOVERY_FILE"
else
post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"verify","confirm":true}' > "$VERIFY_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$VERIFY_BLOCKED_FILE"

read -r verify_approval_id verify_task_id < <(node - <<'EOF' "$VERIFY_TASK_FILE" "$VERIFY_BLOCKED_FILE"
const fs = require("node:fs");
const task = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!task.ok || task.registry !== "openclaw-source-command-task-v0" || task.task?.status !== "queued") {
  throw new Error(`verification task should be queued behind approval: ${JSON.stringify(task)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`verification should block before approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(`${task.approval.id} ${task.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$verify_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-write-closed-loop-check","reason":"approve closed-loop verification fixture"}' > "$VERIFY_APPROVE_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$VERIFY_STEP_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-verification/evidence?taskId=$verify_task_id&maxOutputChars=1000" > "$VERIFY_EVIDENCE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-recovery/evidence?taskId=$verify_task_id&limit=10" > "$RECOVERY_FILE"
fi

node - <<'EOF' \
  "$HTML_FILE" \
  "$CLIENT_FILE" \
  "$WRITE_APPROVE_FILE" \
  "$WRITE_STEP_FILE" \
  "$WRITE_HISTORY_FILE" \
  "$WRITE_LEDGER_FILE" \
  "$WRITE_EVIDENCE_FILE" \
  "$VERIFY_APPROVE_FILE" \
  "$VERIFY_STEP_FILE" \
  "$VERIFY_EVIDENCE_FILE" \
  "$RECOVERY_FILE" \
  "$TARGET_FILE" \
  "$WRITE_SECRET" \
  "$write_task_id" \
  "$verify_task_id" \
  "$OPENCLAW_AUTONOMY_MODE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const writeApprove = readJson(4);
const writeStep = readJson(5);
const history = readJson(6);
const ledger = readJson(7);
const writeEvidence = readJson(8);
const verifyApprove = readJson(9);
const verifyStep = readJson(10);
const verifyEvidence = readJson(11);
const recovery = readJson(12);
const targetFile = process.argv[13];
const secret = process.argv[14];
const writeTaskId = process.argv[15];
const verifyTaskId = process.argv[16];
const autonomyMode = process.argv[17];
const autonomous = autonomyMode === "sovereign_body";
const raw = JSON.stringify({
  writeApprove,
  writeStep,
  history,
  ledger,
  writeEvidence,
  verifyApprove,
  verifyStep,
  verifyEvidence,
  recovery,
});

for (const token of [
  "engineering-write-proposal-registry",
  "engineering-write-execution-registry",
  "engineering-verification-registry",
  "engineering-recovery-registry",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing closed-loop token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-write-proposal-tasks",
  "/plugins/native-adapter/engineering-write-execution/evidence",
  "/plugins/native-adapter/engineering-verification/evidence",
  "/plugins/native-adapter/engineering-recovery/evidence",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing closed-loop token: ${token}`);
  }
}
if (writeApprove.approval?.status !== "approved" || writeApprove.task?.approval?.required !== false) {
  throw new Error(`write approval mismatch: ${JSON.stringify(writeApprove)}`);
}
if (!writeStep.ok || writeStep.ran !== true || writeStep.task?.id !== writeTaskId || writeStep.task?.status !== "completed") {
  throw new Error(`approved write step mismatch: ${JSON.stringify(writeStep)}`);
}
if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, "utf8") !== secret) {
  throw new Error("approved write did not create the expected target content");
}
if (
  history.summary?.byCapability?.["act.filesystem.write_text"] < 1
  || !history.items?.some((entry) => entry.capability?.id === "act.filesystem.write_text" && entry.invoked === true && entry.policy?.approved === true)
) {
  throw new Error(`write invocation history mismatch: ${JSON.stringify(history)}`);
}
if (
  ledger.summary?.write_text < 1
  || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === targetFile && entry.taskId === writeTaskId)
) {
  throw new Error(`filesystem ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (
  !writeEvidence.ok
  || writeEvidence.summary?.passed !== 1
  || writeEvidence.evidence?.[0]?.taskId !== writeTaskId
  || writeEvidence.evidence?.[0]?.proposal?.approvedMutationCapabilityId !== "act.openclaw.workspace_text_write"
  || writeEvidence.governance?.canWriteFile !== false
) {
  throw new Error(`write execution readback mismatch: ${JSON.stringify(writeEvidence)}`);
}
if (!autonomous && (verifyApprove.approval?.status !== "approved" || verifyApprove.task?.policy?.decision?.decision !== "audit_only")) {
  throw new Error(`verification approval mismatch: ${JSON.stringify(verifyApprove)}`);
}
if (!autonomous && (
  !verifyStep.ok
  || verifyStep.ran !== true
  || verifyStep.task?.id !== verifyTaskId
  || verifyStep.task?.status !== "completed"
  || !String(verifyStep.execution?.commandTranscript?.[0]?.stdout ?? "").includes("engineering-write-closed-loop-ok")
)) {
  throw new Error(`approved verification step mismatch: ${JSON.stringify(verifyStep)}`);
}
if (autonomous) {
  const followup = writeStep.task?.outcome?.details?.verificationFollowup;
  if (
    followup?.triggered !== true
    || followup?.executed !== true
    || followup?.ok !== true
    || followup?.sourceTaskId !== writeTaskId
    || followup?.scriptName !== "typecheck"
  ) {
    throw new Error(`sovereign automatic verification followup mismatch: ${JSON.stringify(followup)}`);
  }
}
if (!autonomous && (
  !verifyEvidence.ok
  || verifyEvidence.summary?.passed !== 1
  || verifyEvidence.summary?.attachedToCompletedTasks !== 1
  || verifyEvidence.evidence?.[0]?.taskId !== verifyTaskId
  || verifyEvidence.evidence?.[0]?.result?.exitCode !== 0
  || !String(verifyEvidence.evidence?.[0]?.result?.stdout ?? "").includes("engineering-write-closed-loop-ok")
)) {
  throw new Error(`verification evidence mismatch: ${JSON.stringify(verifyEvidence)}`);
}
if (!autonomous && (
  !recovery.ok
  || recovery.registry !== "openclaw-native-engineering-recovery-evidence-v0"
  || recovery.summary?.totalFailures !== 0
  || recovery.governance?.canCreateRecoveryTask !== false
)) {
  throw new Error(`recovery readback mismatch: ${JSON.stringify(recovery)}`);
}
if (raw.includes(secret)) {
  throw new Error("closed-loop public responses leaked write content");
}

console.log(JSON.stringify({
  openclawNativeEngineeringWriteClosedLoop: {
    writeTaskId,
    verifyTaskId,
    autonomyMode,
    writeLedgerRecords: ledger.summary.write_text,
    verificationPassed: autonomous ? 1 : verifyEvidence.summary.passed,
    recoveryFailures: autonomous ? 0 : recovery.summary.totalFailures,
  },
}, null, 2));
EOF
