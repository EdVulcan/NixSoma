#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-edit-closed-loop-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="package.json"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
OLD_TEXT="OpenClaw on NixOS monorepo skeleton"
NEW_TEXT="OpenClaw on NixOS native engineering closed loop skeleton"
PROMPT_SECRET="ENGINEERING_EDIT_CLOSED_LOOP_PROMPT_SECRET_DO_NOT_LEAK"
TOOL_SECRET="ENGINEERING_EDIT_CLOSED_LOOP_TOOL_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10420}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10421}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10422}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10423}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10424}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10425}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10426}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10427}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10428}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-edit-closed-loop-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-edit-closed-loop-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$WORKSPACE_DIR/src/agents/tools" "$WORKSPACE_DIR/docs/tools"
cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true,
  "description": "OpenClaw on NixOS monorepo skeleton",
  "scripts": {
    "typecheck": "grep -q 'OpenClaw on NixOS native engineering closed loop skeleton' package.json && printf engineering-edit-closed-loop-ok"
  }
}
JSON
cat > "$WORKSPACE_DIR/src/agents/tools/edit-loop-tool.ts" <<TS
export function editLoopTool() {
  const secret = "$TOOL_SECRET";
  return { capabilityId: "engineering-edit-closed-loop", secret };
}
TS
cat > "$WORKSPACE_DIR/docs/tools/edit-loop.md" <<EOF
# Edit Loop
Engineering edit closed loop must remain approval gated.
$PROMPT_SECRET
EOF
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${READ_FILE:-}" \
    "${GLOB_FILE:-}" \
    "${GREP_FILE:-}" \
    "${EDIT_TASK_FILE:-}" \
    "${EDIT_BLOCKED_FILE:-}" \
    "${EDIT_APPROVE_FILE:-}" \
    "${EDIT_STEP_FILE:-}" \
    "${EDIT_HISTORY_FILE:-}" \
    "${EDIT_LEDGER_FILE:-}" \
    "${EDIT_EVIDENCE_FILE:-}" \
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
EDIT_TASK_FILE="$(mktemp)"
EDIT_BLOCKED_FILE="$(mktemp)"
EDIT_APPROVE_FILE="$(mktemp)"
EDIT_STEP_FILE="$(mktemp)"
EDIT_HISTORY_FILE="$(mktemp)"
EDIT_LEDGER_FILE="$(mktemp)"
EDIT_EVIDENCE_FILE="$(mktemp)"
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
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-read-search/grep?query=editLoopTool&include=src/**/*.ts&literal=true&limit=8&maxOutputChars=2000" > "$GREP_FILE"

node - <<'EOF' "$READ_FILE" "$GLOB_FILE" "$GREP_FILE" "$OLD_TEXT"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const read = readJson(2);
const glob = readJson(3);
const grep = readJson(4);
const oldText = process.argv[5];

if (
  !read.ok
  || read.operation !== "read"
  || read.capability?.id !== "sense.openclaw.engineering_tool.read"
  || !String(read.content ?? "").includes(oldText)
) {
  throw new Error(`edit closed-loop read step mismatch: ${JSON.stringify(read)}`);
}
if (
  !glob.ok
  || glob.operation !== "glob"
  || glob.capability?.id !== "sense.openclaw.engineering_tool.glob"
  || !glob.matches?.some((match) => match.relativePath === "src/agents/tools/edit-loop-tool.ts" && match.contentRead === false)
) {
  throw new Error(`edit closed-loop glob step mismatch: ${JSON.stringify(glob)}`);
}
if (
  !grep.ok
  || grep.operation !== "grep"
  || grep.capability?.id !== "sense.openclaw.engineering_tool.grep"
  || !grep.matches?.some((match) => match.relativePath === "src/agents/tools/edit-loop-tool.ts")
) {
  throw new Error(`edit closed-loop grep step mismatch: ${JSON.stringify(grep)}`);
}
EOF

post_json "$CORE_URL/plugins/native-adapter/engineering-edit-proposal-tasks" "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"oldString\":\"$OLD_TEXT\",\"newString\":\"$NEW_TEXT\",\"contextLines\":1,\"confirm\":true}" > "$EDIT_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$EDIT_BLOCKED_FILE"

read -r edit_approval_id edit_task_id < <(node - <<'EOF' "$EDIT_TASK_FILE" "$EDIT_BLOCKED_FILE" "$TARGET_FILE" "$OLD_TEXT" "$NEW_TEXT"
const fs = require("node:fs");
const task = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const targetFile = process.argv[4];
const oldText = process.argv[5];
const newText = process.argv[6];
const targetText = fs.readFileSync(targetFile, "utf8");
const targetPackage = JSON.parse(targetText);

if (
  !task.ok
  || task.registry !== "openclaw-native-engineering-edit-proposal-task-v0"
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.engineeringEditProposal?.contentExposed !== false
  || task.engineeringEditProposal?.diffPreviewExposed !== true
  || task.workspacePatchApply?.registry !== "openclaw-native-workspace-patch-apply-task-v0"
) {
  throw new Error(`edit task bridge mismatch: ${JSON.stringify(task)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`edit should block before approval: ${JSON.stringify(blocked)}`);
}
if (targetPackage.description !== oldText || targetPackage.description === newText) {
  throw new Error(`edit applied before approval: ${targetText}`);
}
process.stdout.write(`${task.approval.id} ${task.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$edit_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-edit-closed-loop-check","reason":"approve closed-loop edit fixture"}' > "$EDIT_APPROVE_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$EDIT_STEP_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=10" > "$EDIT_HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=20" > "$EDIT_LEDGER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-edit-execution/evidence?taskId=$edit_task_id&limit=10" > "$EDIT_EVIDENCE_FILE"

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

post_json "$CORE_URL/approvals/$verify_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-edit-closed-loop-check","reason":"approve closed-loop verification fixture"}' > "$VERIFY_APPROVE_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$VERIFY_STEP_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-verification/evidence?taskId=$verify_task_id&maxOutputChars=1000" > "$VERIFY_EVIDENCE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-recovery/evidence?taskId=$verify_task_id&limit=10" > "$RECOVERY_FILE"

node - <<'EOF' \
  "$HTML_FILE" \
  "$CLIENT_FILE" \
  "$EDIT_APPROVE_FILE" \
  "$EDIT_STEP_FILE" \
  "$EDIT_HISTORY_FILE" \
  "$EDIT_LEDGER_FILE" \
  "$EDIT_EVIDENCE_FILE" \
  "$VERIFY_APPROVE_FILE" \
  "$VERIFY_STEP_FILE" \
  "$VERIFY_EVIDENCE_FILE" \
  "$RECOVERY_FILE" \
  "$TARGET_FILE" \
  "$OLD_TEXT" \
  "$NEW_TEXT" \
  "$PROMPT_SECRET" \
  "$TOOL_SECRET" \
  "$edit_task_id" \
  "$verify_task_id"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const editApprove = readJson(4);
const editStep = readJson(5);
const history = readJson(6);
const ledger = readJson(7);
const editEvidence = readJson(8);
const verifyApprove = readJson(9);
const verifyStep = readJson(10);
const verifyEvidence = readJson(11);
const recovery = readJson(12);
const targetFile = process.argv[13];
const oldText = process.argv[14];
const newText = process.argv[15];
const promptSecret = process.argv[16];
const toolSecret = process.argv[17];
const editTaskId = process.argv[18];
const verifyTaskId = process.argv[19];
const finalText = fs.readFileSync(targetFile, "utf8");
const finalPackage = JSON.parse(finalText);
const raw = JSON.stringify({
  editApprove,
  editStep,
  history,
  ledger,
  editEvidence,
  verifyApprove,
  verifyStep,
  verifyEvidence,
  recovery,
});

for (const token of [
  "engineering-edit-proposal-registry",
  "workspace-patch-apply-capability",
  "engineering-verification-registry",
  "engineering-recovery-registry",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing edit closed-loop token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-edit-proposal-tasks",
  "/plugins/native-adapter/engineering-edit-execution/evidence",
  "/plugins/native-adapter/engineering-verification/evidence",
  "/plugins/native-adapter/engineering-recovery/evidence",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing edit closed-loop token: ${token}`);
  }
}
if (editApprove.approval?.status !== "approved" || editApprove.task?.approval?.required !== false) {
  throw new Error(`edit approval mismatch: ${JSON.stringify(editApprove)}`);
}
if (!editStep.ok || editStep.ran !== true || editStep.task?.id !== editTaskId || editStep.task?.status !== "completed") {
  throw new Error(`approved edit step mismatch: ${JSON.stringify(editStep)}`);
}
if (finalPackage.description !== newText) {
  throw new Error(`approved edit did not update the target content: ${finalText}`);
}
if (
  history.summary?.byCapability?.["act.filesystem.write_text"] < 1
  || !history.items?.some((entry) => entry.capability?.id === "act.filesystem.write_text" && entry.invoked === true && entry.policy?.approved === true)
) {
  throw new Error(`edit invocation history mismatch: ${JSON.stringify(history)}`);
}
if (
  ledger.summary?.write_text < 1
  || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === targetFile && entry.taskId === editTaskId)
) {
  throw new Error(`filesystem ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (
  !editEvidence.ok
  || editEvidence.summary?.passed !== 1
  || editEvidence.evidence?.[0]?.taskId !== editTaskId
  || editEvidence.evidence?.[0]?.proposal?.approvedMutationCapabilityId !== "act.openclaw.workspace_patch_apply"
  || editEvidence.governance?.canWriteFile !== false
) {
  throw new Error(`edit execution readback mismatch: ${JSON.stringify(editEvidence)}`);
}
if (verifyApprove.approval?.status !== "approved" || verifyApprove.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`verification approval mismatch: ${JSON.stringify(verifyApprove)}`);
}
if (
  !verifyStep.ok
  || verifyStep.ran !== true
  || verifyStep.task?.id !== verifyTaskId
  || verifyStep.task?.status !== "completed"
  || !String(verifyStep.execution?.commandTranscript?.[0]?.stdout ?? "").includes("engineering-edit-closed-loop-ok")
) {
  throw new Error(`approved verification step mismatch: ${JSON.stringify(verifyStep)}`);
}
if (
  !verifyEvidence.ok
  || verifyEvidence.summary?.passed !== 1
  || verifyEvidence.summary?.attachedToCompletedTasks !== 1
  || verifyEvidence.evidence?.[0]?.taskId !== verifyTaskId
  || verifyEvidence.evidence?.[0]?.result?.exitCode !== 0
  || !String(verifyEvidence.evidence?.[0]?.result?.stdout ?? "").includes("engineering-edit-closed-loop-ok")
) {
  throw new Error(`verification evidence mismatch: ${JSON.stringify(verifyEvidence)}`);
}
if (
  !recovery.ok
  || recovery.registry !== "openclaw-native-engineering-recovery-evidence-v0"
  || recovery.summary?.totalFailures !== 0
  || recovery.governance?.canCreateRecoveryTask !== false
) {
  throw new Error(`recovery readback mismatch: ${JSON.stringify(recovery)}`);
}
for (const secret of [promptSecret, toolSecret]) {
  if (raw.includes(secret)) {
    throw new Error(`edit closed-loop public responses leaked fixture secret: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringEditClosedLoop: {
    editTaskId,
    verifyTaskId,
    editLedgerRecords: ledger.summary.write_text,
    verificationPassed: verifyEvidence.summary.passed,
    recoveryFailures: recovery.summary.totalFailures,
  },
}, null, 2));
EOF
