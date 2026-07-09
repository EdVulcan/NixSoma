#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-acpx-codex-bridge-compatibility-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10220}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10221}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10222}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10223}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10224}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10225}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10226}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10227}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10228}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-acpx-codex-bridge-compatibility-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-acpx-codex-bridge-compatibility-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

state_has_acpx_records() {
  node - <<'EOF' "$OPENCLAW_CORE_STATE_FILE"
const fs = require("node:fs");
const file = process.argv[2];
if (!fs.existsSync(file)) {
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, "utf8"));
process.exit((data.acpxBridgeSessionRecords ?? []).length === 2 ? 0 : 1);
EOF
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw/acpx/codex-bridge"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${INITIAL_FILE:-}" \
    "${FIRST_FILE:-}" \
    "${SECOND_FILE:-}" \
    "${OVERWRITE_FILE:-}" \
    "${BEFORE_RESTART_FILE:-}" \
    "${DRAFT_FILE:-}" \
    "${WRITE_PROPOSAL_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
    "${TASK_STATE_FILE:-}" \
    "${WRAPPER_WRITE_TASK_FILE:-}" \
    "${WRAPPER_WRITE_BLOCKED_FILE:-}" \
    "${WRAPPER_WRITE_APPROVED_FILE:-}" \
    "${WRAPPER_WRITE_STEP_FILE:-}" \
    "${WRAPPER_WRITE_TASK_STATE_FILE:-}" \
    "${WRAPPER_WRITE_HISTORY_FILE:-}" \
    "${WRAPPER_WRITE_LEDGER_FILE:-}" \
    "${WRAPPER_WRITE_EXECUTION_FILE:-}" \
    "${PROCESS_SPAWN_PROPOSAL_FILE:-}" \
    "${PROCESS_SPAWN_TASK_FILE:-}" \
    "${PROCESS_SPAWN_BLOCKED_FILE:-}" \
    "${PROCESS_SPAWN_APPROVED_FILE:-}" \
    "${PROCESS_SPAWN_STEP_FILE:-}" \
    "${PROCESS_SPAWN_TASK_STATE_FILE:-}" \
    "${AFTER_RESTART_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh" >/dev/null

INITIAL_FILE="$(mktemp)"
FIRST_FILE="$(mktemp)"
SECOND_FILE="$(mktemp)"
OVERWRITE_FILE="$(mktemp)"
BEFORE_RESTART_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
WRITE_PROPOSAL_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
TASK_STATE_FILE="$(mktemp)"
WRAPPER_WRITE_TASK_FILE="$(mktemp)"
WRAPPER_WRITE_BLOCKED_FILE="$(mktemp)"
WRAPPER_WRITE_APPROVED_FILE="$(mktemp)"
WRAPPER_WRITE_STEP_FILE="$(mktemp)"
WRAPPER_WRITE_TASK_STATE_FILE="$(mktemp)"
WRAPPER_WRITE_HISTORY_FILE="$(mktemp)"
WRAPPER_WRITE_LEDGER_FILE="$(mktemp)"
WRAPPER_WRITE_EXECUTION_FILE="$(mktemp)"
PROCESS_SPAWN_PROPOSAL_FILE="$(mktemp)"
PROCESS_SPAWN_TASK_FILE="$(mktemp)"
PROCESS_SPAWN_BLOCKED_FILE="$(mktemp)"
PROCESS_SPAWN_APPROVED_FILE="$(mktemp)"
PROCESS_SPAWN_STEP_FILE="$(mktemp)"
PROCESS_SPAWN_TASK_STATE_FILE="$(mktemp)"
AFTER_RESTART_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:missing" > "$INITIAL_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:one","agentId":"codex","recordId":"record-one","metadata":{"purpose":"first","authToken":"ACPX_CODEX_SECRET_TOKEN_SHOULD_NOT_LEAK"},"confirm":true}' > "$FIRST_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:two","agentId":"codex","recordId":"record-two","metadata":{"purpose":"second"},"confirm":true}' > "$SECOND_FILE"
post_json "$CORE_URL/plugins/native-adapter/acpx-codex-session-records" '{"sessionKey":"agent:codex:one","agentId":"codex","recordId":"record-one-updated","metadata":{"purpose":"updated","password":"ACPX_CODEX_SECRET_PASSWORD_SHOULD_NOT_LEAK"},"confirm":true}' > "$OVERWRITE_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:one" > "$BEFORE_RESTART_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-draft?sessionKey=agent:codex:one&command=npx.cmd&wrapperName=codex-acp-one" > "$DRAFT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal?sessionKey=agent:codex:one&command=npx.cmd&wrapperName=codex-acp-one" > "$WRITE_PROPOSAL_FILE"

node - <<'EOF' "$INITIAL_FILE" "$FIRST_FILE" "$SECOND_FILE" "$OVERWRITE_FILE" "$BEFORE_RESTART_FILE" "$DRAFT_FILE" "$WRITE_PROPOSAL_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const initial = readJson(2);
const first = readJson(3);
const second = readJson(4);
const overwrite = readJson(5);
const before = readJson(6);
const draft = readJson(7);
const writeProposal = readJson(8);
const raw = JSON.stringify({ initial, first, second, overwrite, before, draft, writeProposal });

if (
  !initial.ok
  || initial.registry !== "openclaw-native-acpx-codex-bridge-compatibility-v0"
  || initial.compatibility?.posixCommand !== "npx"
  || initial.compatibility?.windowsCommandLesson !== "npx.cmd"
  || initial.authIsolation?.authJsonRead !== false
  || initial.authIsolation?.credentialValueRead !== false
  || initial.governance?.canReadCredentialValue !== false
  || initial.governance?.canCopyAuthMaterial !== false
  || initial.governance?.canWriteWrapper !== false
  || initial.governance?.canSpawnCodexAcp !== false
  || initial.governance?.observerVisible !== true
  || initial.governance?.observerVisibilityDeferred !== false
  || initial.persistence?.missingSessionReturnsNull !== true
) {
  throw new Error(`initial ACPX/Codex bridge compatibility mismatch: ${JSON.stringify(initial)}`);
}
if (!first.ok || first.summary?.created !== true || first.session?.revision !== 1) {
  throw new Error(`first ACPX/Codex session record should be created: ${JSON.stringify(first)}`);
}
if (!second.ok || second.summary?.created !== true || second.session?.sessionKey !== "agent:codex:two") {
  throw new Error(`second ACPX/Codex session record should be independent: ${JSON.stringify(second)}`);
}
if (
  !overwrite.ok
  || overwrite.summary?.overwritten !== true
  || overwrite.session?.revision !== 2
  || overwrite.session?.acpxRecordId !== "record-one-updated"
  || overwrite.session?.metadata?.password !== "[redacted-key]"
) {
  throw new Error(`ACPX/Codex session overwrite mismatch: ${JSON.stringify(overwrite)}`);
}
if (
  before.persistence?.totalRecords !== 2
  || before.persistence?.selectedRecord?.acpxRecordId !== "record-one-updated"
  || before.persistence?.selectedRecord?.revision !== 2
  || before.persistence?.supportsIndependentSessions !== true
  || before.persistence?.supportsOverwrite !== true
) {
  throw new Error(`ACPX/Codex bridge persistence readback mismatch: ${JSON.stringify(before)}`);
}
if (
  !draft.ok
  || draft.registry !== "openclaw-native-acpx-codex-bridge-wrapper-draft-v0"
  || draft.proposal?.status !== "ready_for_approval_bridge"
  || draft.summary?.readyForApprovalBridge !== true
  || draft.proposal?.wrapper?.relativePath !== ".openclaw/acpx/codex-bridge/codex-acp-one.sh"
  || draft.proposal?.wrapper?.wrapperWritten !== false
  || draft.proposal?.command?.command !== "npx.cmd"
  || draft.proposal?.command?.commandExecuted !== false
  || draft.proposal?.command?.processSpawned !== false
  || draft.proposal?.authIsolation?.credentialValueRead !== false
  || draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canReadCredentialValue !== false
  || draft.governance?.canCopyAuthMaterial !== false
  || draft.governance?.canWriteWrapper !== false
  || draft.governance?.canExecuteWrapper !== false
  || draft.governance?.canSpawnCodexAcp !== false
  || draft.governance?.canCallProvider !== false
  || draft.governance?.canUseNetwork !== false
  || draft.governance?.futureWrapperWriteRequiresApproval !== true
  || draft.governance?.futureProcessSpawnRequiresApproval !== true
) {
  throw new Error(`ACPX/Codex wrapper draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !writeProposal.ok
  || writeProposal.registry !== "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0"
  || writeProposal.proposal?.status !== "ready_for_write_approval"
  || writeProposal.summary?.readyForWriteApproval !== true
  || writeProposal.proposal?.wrapper?.relativePath !== ".openclaw/acpx/codex-bridge/codex-acp-one.sh"
  || !/^sha256:[a-f0-9]{64}$/.test(writeProposal.proposal?.wrapper?.contentHash ?? "")
  || !String(writeProposal.proposal?.wrapper?.contentPreview ?? "").includes("__OPENCLAW_APPROVED_CODEX_HOME__")
  || !String(writeProposal.proposal?.wrapper?.contentPreview ?? "").includes("@zed-industries/codex-acp@^0.11.1")
  || writeProposal.proposal?.authIsolation?.credentialValueRead !== false
  || writeProposal.proposal?.authIsolation?.authMaterialCopied !== false
  || writeProposal.proposal?.wrapper?.wrapperWritten !== false
  || writeProposal.proposal?.wrapper?.directoryCreated !== false
  || writeProposal.proposal?.wrapper?.chmodApplied !== false
  || writeProposal.proposal?.command?.commandExecuted !== false
  || writeProposal.proposal?.command?.processSpawned !== false
  || writeProposal.proposal?.writeBoundary?.futureWriteCapabilityId !== "act.openclaw.workspace_text_write"
  || writeProposal.proposal?.writeBoundary?.writeTaskCreated !== false
  || writeProposal.governance?.createsTask !== false
  || writeProposal.governance?.createsApproval !== false
  || writeProposal.governance?.canReadCredentialValue !== false
  || writeProposal.governance?.canCopyAuthMaterial !== false
  || writeProposal.governance?.canWriteWrapper !== false
  || writeProposal.governance?.canExecuteWrapper !== false
  || writeProposal.governance?.canSpawnCodexAcp !== false
  || writeProposal.governance?.canCallProvider !== false
  || writeProposal.governance?.canUseNetwork !== false
  || writeProposal.governance?.futureWrapperWriteUsesWorkspaceTextWrite !== true
) {
  throw new Error(`ACPX/Codex wrapper write proposal mismatch: ${JSON.stringify(writeProposal)}`);
}
for (const secret of [
  "ACPX_CODEX_SECRET_TOKEN_SHOULD_NOT_LEAK",
  "ACPX_CODEX_SECRET_PASSWORD_SHOULD_NOT_LEAK",
]) {
  if (raw.includes(secret)) {
    throw new Error(`ACPX/Codex bridge leaked secret-like metadata: ${secret}`);
  }
}
EOF

post_json "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-tasks" '{"sessionKey":"agent:codex:one","command":"npx.cmd","wrapperName":"codex-acp-one","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

approval_id="$(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-acpx-codex-bridge-wrapper-task-v0"
  || taskResponse.task?.type !== "native_acpx_codex_bridge_wrapper_action"
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canWriteWrapper !== false
  || taskResponse.governance?.canSpawnCodexAcp !== false
) {
  throw new Error(`ACPX/Codex wrapper task response mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  !blocked.ok
  || blocked.ran !== false
  || blocked.blocked !== true
  || blocked.reason !== "policy_requires_approval"
  || blocked.approval?.id !== taskResponse.approval?.id
) {
  throw new Error(`ACPX/Codex wrapper task should block before approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(blocked.approval.id);
EOF
)"

task_id="$(node - <<'EOF' "$TASK_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(taskResponse.task.id);
EOF
)"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-acpx-codex-bridge-compatibility-check","reason":"Approve ACPX/Codex wrapper boundary without writing or spawning."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$task_id" > "$TASK_STATE_FILE"

node - <<'EOF' "$TASK_FILE" "$APPROVED_FILE" "$STEP_FILE" "$TASK_STATE_FILE" "$WORKSPACE_DIR"
const fs = require("node:fs");
const path = require("node:path");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const taskResponse = readJson(2);
const approved = readJson(3);
const step = readJson(4);
const taskState = readJson(5);
const workspaceDir = process.argv[6];
const execution = taskState.task?.nativeAcpxCodexBridgeWrapper?.execution;
const wrapperPath = path.join(workspaceDir, ".openclaw/acpx/codex-bridge/codex-acp-one.sh");
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`ACPX/Codex wrapper approval should be approved and audited: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false || step.task?.status !== "completed") {
  throw new Error(`approved ACPX/Codex wrapper task should complete as deferred: ${JSON.stringify(step)}`);
}
if (
  taskState.task?.id !== taskResponse.task?.id
  || taskState.task?.status !== "completed"
  || execution?.registry !== "openclaw-native-acpx-codex-bridge-wrapper-task-execution-v0"
  || execution.approved !== true
  || execution.wrapper?.wrapperWritten !== false
  || execution.command?.commandExecuted !== false
  || execution.command?.processSpawned !== false
  || execution.governance?.canReadCredentialValue !== false
  || execution.governance?.canCopyAuthMaterial !== false
  || execution.governance?.canWriteWrapper !== false
  || execution.governance?.canExecuteWrapper !== false
  || execution.governance?.canSpawnCodexAcp !== false
  || execution.governance?.canUseNetwork !== false
  || fs.existsSync(wrapperPath)
) {
  throw new Error(`ACPX/Codex wrapper task execution mismatch: ${JSON.stringify({ taskState, wrapperPathExists: fs.existsSync(wrapperPath) })}`);
}
EOF

post_json "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-write-tasks" '{"sessionKey":"agent:codex:one","command":"npx.cmd","wrapperName":"codex-acp-one","confirm":true}' > "$WRAPPER_WRITE_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$WRAPPER_WRITE_BLOCKED_FILE"

wrapper_write_approval_id="$(node - <<'EOF' "$WRITE_PROPOSAL_FILE" "$WRAPPER_WRITE_TASK_FILE" "$WRAPPER_WRITE_BLOCKED_FILE"
const fs = require("node:fs");
const proposal = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const taskResponse = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const raw = JSON.stringify({ taskResponse, blocked });
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0"
  || taskResponse.capability?.id !== "act.openclaw.acpx_codex_bridge.wrapper_write_bridge"
  || taskResponse.capability?.delegatesTo !== "act.openclaw.workspace_text_write"
  || taskResponse.target?.relativePath !== ".openclaw/acpx/codex-bridge/codex-acp-one.sh"
  || taskResponse.target?.contentHash !== proposal.proposal?.wrapper?.contentHash
  || taskResponse.target?.contentPreviewExposed !== false
  || taskResponse.wrapperWriteProposal?.target?.contentPreviewExposed !== false
  || taskResponse.workspaceTextWrite?.registry !== "openclaw-native-workspace-text-write-task-v0"
  || taskResponse.workspaceTextWrite?.contentExposed !== false
  || taskResponse.task?.nativeAcpxCodexBridgeWrapper?.registry !== "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0"
  || taskResponse.task?.nativeAcpxCodexBridgeWrapper?.approvedMutationCapabilityId !== "act.openclaw.workspace_text_write"
  || taskResponse.task?.nativeAcpxCodexBridgeWrapper?.target?.contentHash !== proposal.proposal?.wrapper?.contentHash
  || taskResponse.task?.nativeAcpxCodexBridgeWrapper?.command?.argsExposed !== false
  || taskResponse.approval?.status !== "pending"
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canMutateBeforeApproval !== false
  || taskResponse.governance?.delegatesApprovedMutationTo !== "act.openclaw.workspace_text_write"
  || taskResponse.governance?.canReadCredentialValue !== false
  || taskResponse.governance?.canCopyAuthMaterial !== false
  || taskResponse.governance?.canExecuteWrapper !== false
  || taskResponse.governance?.canSpawnCodexAcp !== false
  || taskResponse.governance?.canUseNetwork !== false
) {
  throw new Error(`ACPX/Codex wrapper write task response mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  blocked.ran !== false
  || blocked.blocked !== true
  || blocked.reason !== "policy_requires_approval"
  || blocked.approval?.id !== taskResponse.approval?.id
) {
  throw new Error(`ACPX/Codex wrapper write task should block before approval: ${JSON.stringify(blocked)}`);
}
if (raw.includes("__OPENCLAW_APPROVED_CODEX_HOME__") || raw.includes("@zed-industries/codex-acp@^0.11.1")) {
  throw new Error("ACPX/Codex wrapper write task leaked full content preview in public task response");
}
process.stdout.write(blocked.approval.id);
EOF
)"

wrapper_write_task_id="$(node - <<'EOF' "$WRAPPER_WRITE_TASK_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(taskResponse.task.id);
EOF
)"

post_json "$CORE_URL/approvals/$wrapper_write_approval_id/approve" '{"approvedBy":"dev-openclaw-native-acpx-codex-bridge-compatibility-check","reason":"Approve ACPX/Codex wrapper write through workspace_text_write."}' > "$WRAPPER_WRITE_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$WRAPPER_WRITE_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$wrapper_write_task_id" > "$WRAPPER_WRITE_TASK_STATE_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?capabilityId=act.filesystem.write_text&limit=5" > "$WRAPPER_WRITE_HISTORY_FILE"
curl --silent --fail "$CORE_URL/filesystem/changes?limit=10" > "$WRAPPER_WRITE_LEDGER_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-wrapper-write-execution/evidence?taskId=$wrapper_write_task_id" > "$WRAPPER_WRITE_EXECUTION_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-process-spawn-proposal?taskId=$wrapper_write_task_id" > "$PROCESS_SPAWN_PROPOSAL_FILE"

node - <<'EOF' "$WRITE_PROPOSAL_FILE" "$WRAPPER_WRITE_APPROVED_FILE" "$WRAPPER_WRITE_STEP_FILE" "$WRAPPER_WRITE_TASK_STATE_FILE" "$WRAPPER_WRITE_HISTORY_FILE" "$WRAPPER_WRITE_LEDGER_FILE" "$WRAPPER_WRITE_EXECUTION_FILE" "$PROCESS_SPAWN_PROPOSAL_FILE" "$WORKSPACE_DIR"
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const proposal = readJson(2);
const approved = readJson(3);
const step = readJson(4);
const taskState = readJson(5);
const history = readJson(6);
const ledger = readJson(7);
const executionEvidence = readJson(8);
const processSpawnProposal = readJson(9);
const workspaceDir = process.argv[10];
const content = proposal.proposal.wrapper.contentPreview;
const wrapperPath = path.join(workspaceDir, proposal.proposal.wrapper.relativePath);
const expectedHash = `sha256:${crypto.createHash("sha256").update(content, "utf8").digest("hex")}`;
const taskWrapper = taskState.task?.nativeAcpxCodexBridgeWrapper;

if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`ACPX/Codex wrapper write approval mismatch: ${JSON.stringify(approved)}`);
}
if (
  step.ran !== true
  || step.blocked !== false
  || step.task?.status !== "completed"
  || step.execution?.capabilityInvocations?.some((item) => item.capabilityId === "act.filesystem.write_text" && item.invoked === true) !== true
) {
  throw new Error(`approved ACPX/Codex wrapper write task should execute workspace_text_write: ${JSON.stringify(step)}`);
}
if (!fs.existsSync(wrapperPath) || fs.readFileSync(wrapperPath, "utf8") !== content) {
  throw new Error(`approved ACPX/Codex wrapper write did not create previewed content at ${wrapperPath}`);
}
if (
  taskState.task?.status !== "completed"
  || taskWrapper?.registry !== "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0"
  || taskWrapper?.target?.contentHash !== expectedHash
  || taskWrapper?.target?.contentPreviewExposed !== false
  || taskWrapper?.command?.argsExposed !== false
  || taskWrapper?.command?.commandExecuted !== false
  || taskWrapper?.command?.processSpawned !== false
  || taskWrapper?.governance?.canReadCredentialValue !== false
  || taskWrapper?.governance?.canCopyAuthMaterial !== false
  || taskWrapper?.governance?.canSpawnCodexAcp !== false
) {
  throw new Error(`ACPX/Codex wrapper write task state mismatch: ${JSON.stringify(taskState)}`);
}
if (
  history.summary?.byCapability?.["act.filesystem.write_text"] !== 1
  || !history.items?.some((entry) => entry.capability?.id === "act.filesystem.write_text" && entry.invoked === true && entry.policy?.approved === true)
) {
  throw new Error(`ACPX/Codex wrapper write capability history mismatch: ${JSON.stringify(history)}`);
}
if (
  ledger.summary?.write_text < 1
  || !ledger.items?.some((entry) => entry.change === "write_text" && entry.path === wrapperPath)
) {
  throw new Error(`ACPX/Codex wrapper write filesystem ledger mismatch: ${JSON.stringify(ledger)}`);
}
if (
  executionEvidence.registry !== "openclaw-native-acpx-codex-wrapper-write-execution-evidence-v0"
  || executionEvidence.capability?.id !== "sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence"
  || executionEvidence.summary?.total !== 1
  || executionEvidence.summary?.passed !== 1
  || executionEvidence.summary?.failed !== 0
  || executionEvidence.summary?.withWrapperProposal !== 1
  || executionEvidence.evidence?.[0]?.taskId !== taskState.task?.id
  || executionEvidence.evidence?.[0]?.wrapper?.target?.contentHash !== expectedHash
  || executionEvidence.evidence?.[0]?.wrapper?.target?.contentPreviewExposed !== false
  || executionEvidence.evidence?.[0]?.wrapper?.command?.argsExposed !== false
  || executionEvidence.evidence?.[0]?.wrapper?.command?.processSpawned !== false
  || executionEvidence.evidence?.[0]?.validation?.ok !== true
  || executionEvidence.recoveryRecommendation?.needed !== false
  || executionEvidence.governance?.canWriteFile !== false
  || executionEvidence.governance?.canCreateTask !== false
  || executionEvidence.governance?.canReadCredentialValue !== false
  || executionEvidence.governance?.canCopyAuthMaterial !== false
  || executionEvidence.governance?.canExecuteWrapper !== false
  || executionEvidence.governance?.canSpawnCodexAcp !== false
  || executionEvidence.governance?.canUseNetwork !== false
) {
  throw new Error(`ACPX/Codex wrapper write execution evidence mismatch: ${JSON.stringify(executionEvidence)}`);
}
if (
  processSpawnProposal.registry !== "openclaw-native-acpx-codex-bridge-process-spawn-proposal-v0"
  || processSpawnProposal.capability?.id !== "plan.openclaw.acpx_codex_bridge.process_spawn"
  || processSpawnProposal.capability?.futureExecutionCapabilityId !== "act.system.command.execute"
  || processSpawnProposal.proposal?.capabilityId !== "plan.openclaw.acpx_codex_bridge.process_spawn"
  || processSpawnProposal.proposal?.status !== "ready_for_spawn_approval_design"
  || processSpawnProposal.summary?.readyForSpawnApprovalDesign !== true
  || processSpawnProposal.summary?.selectedWrapperWriteTaskId !== taskState.task?.id
  || processSpawnProposal.proposal?.wrapper?.relativePath !== proposal.proposal?.wrapper?.relativePath
  || processSpawnProposal.proposal?.wrapper?.contentPreviewExposed !== false
  || processSpawnProposal.proposal?.commandContract?.futureCapabilityId !== "act.system.command.execute"
  || processSpawnProposal.proposal?.commandContract?.argsExposed !== false
  || processSpawnProposal.proposal?.commandContract?.commandExecuted !== false
  || processSpawnProposal.proposal?.commandContract?.processSpawned !== false
  || processSpawnProposal.recoveryRecommendation?.needed !== false
  || processSpawnProposal.governance?.createsTask !== false
  || processSpawnProposal.governance?.createsApproval !== false
  || processSpawnProposal.governance?.canExecuteOperatorStep !== false
  || processSpawnProposal.governance?.canReadCredentialValue !== false
  || processSpawnProposal.governance?.canCopyAuthMaterial !== false
  || processSpawnProposal.governance?.canExecuteWrapper !== false
  || processSpawnProposal.governance?.canSpawnCodexAcp !== false
  || processSpawnProposal.governance?.canUseNetwork !== false
) {
  throw new Error(`ACPX/Codex process spawn proposal mismatch: ${JSON.stringify(processSpawnProposal)}`);
}
EOF

post_json "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-process-spawn-tasks" "{\"taskId\":\"$wrapper_write_task_id\",\"confirm\":true}" > "$PROCESS_SPAWN_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$PROCESS_SPAWN_BLOCKED_FILE"

process_spawn_approval_id="$(node - <<'EOF' "$PROCESS_SPAWN_TASK_FILE" "$PROCESS_SPAWN_BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const raw = JSON.stringify({ taskResponse, blocked });
if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-acpx-codex-bridge-process-spawn-task-v0"
  || taskResponse.processSpawnProposal?.proposal?.status !== "ready_for_spawn_approval_design"
  || taskResponse.task?.type !== "native_acpx_codex_bridge_process_spawn"
  || taskResponse.task?.nativeAcpxCodexBridgeProcessSpawn?.registry !== "openclaw-native-acpx-codex-bridge-process-spawn-task-v0"
  || taskResponse.task?.nativeAcpxCodexBridgeProcessSpawn?.processSpawnProposal?.proposal?.commandContract?.argsExposed !== false
  || taskResponse.approval?.status !== "pending"
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canReadCredentialValue !== false
  || taskResponse.governance?.canCopyAuthMaterial !== false
  || taskResponse.governance?.canExecuteWrapper !== false
  || taskResponse.governance?.canSpawnCodexAcp !== false
  || taskResponse.governance?.canUseNetwork !== false
) {
  throw new Error(`ACPX/Codex process-spawn task response mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  blocked.ran !== false
  || blocked.blocked !== true
  || blocked.reason !== "policy_requires_approval"
  || blocked.approval?.id !== taskResponse.approval?.id
) {
  throw new Error(`ACPX/Codex process-spawn task should block before approval: ${JSON.stringify(blocked)}`);
}
if (raw.includes("@zed-industries/codex-acp@^0.11.1") || raw.includes("__OPENCLAW_APPROVED_CODEX_HOME__")) {
  throw new Error("ACPX/Codex process-spawn task leaked wrapper command material");
}
process.stdout.write(blocked.approval.id);
EOF
)"

process_spawn_task_id="$(node - <<'EOF' "$PROCESS_SPAWN_TASK_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(taskResponse.task.id);
EOF
)"

post_json "$CORE_URL/approvals/$process_spawn_approval_id/approve" '{"approvedBy":"dev-openclaw-native-acpx-codex-bridge-compatibility-check","reason":"Approve ACPX/Codex process-spawn preflight only."}' > "$PROCESS_SPAWN_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$PROCESS_SPAWN_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$process_spawn_task_id" > "$PROCESS_SPAWN_TASK_STATE_FILE"

node - <<'EOF' "$PROCESS_SPAWN_APPROVED_FILE" "$PROCESS_SPAWN_STEP_FILE" "$PROCESS_SPAWN_TASK_STATE_FILE" "$PROCESS_SPAWN_TASK_FILE"
const fs = require("node:fs");
const approved = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const step = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const taskState = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const taskResponse = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const preflight = taskState.task?.nativeAcpxCodexBridgeProcessSpawn?.execution;
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`ACPX/Codex process-spawn approval mismatch: ${JSON.stringify(approved)}`);
}
if (
  step.ran !== true
  || step.blocked !== false
  || step.task?.status !== "completed"
  || (step.execution?.capabilityInvocations ?? []).length !== 0
  || (step.execution?.commandTranscript ?? []).length !== 0
) {
  throw new Error(`approved ACPX/Codex process-spawn preflight should not invoke capabilities or commands: ${JSON.stringify(step)}`);
}
if (
  taskState.task?.status !== "completed"
  || preflight?.registry !== "openclaw-native-acpx-codex-bridge-process-spawn-preflight-v0"
  || preflight?.wrapper?.exists !== true
  || preflight?.wrapper?.isFile !== true
  || preflight?.wrapper?.hashMatches !== true
  || preflight?.wrapper?.contentPreviewExposed !== false
  || preflight?.command?.argsExposed !== false
  || preflight?.command?.commandExecuted !== false
  || preflight?.command?.processSpawned !== false
  || preflight?.governance?.canReadCredentialValue !== false
  || preflight?.governance?.canCopyAuthMaterial !== false
  || preflight?.governance?.canExecuteWrapper !== false
  || preflight?.governance?.canSpawnCodexAcp !== false
  || preflight?.governance?.canUseNetwork !== false
  || taskState.task?.outcome?.details?.verification?.ok !== true
  || taskResponse.task?.nativeAcpxCodexBridgeProcessSpawn?.processSpawnProposal?.proposal?.wrapper?.contentHash !== preflight?.wrapper?.contentHash
) {
  throw new Error(`ACPX/Codex process-spawn preflight task state mismatch: ${JSON.stringify(taskState)}`);
}
EOF

openclaw_wait_until 5 0.05 state_has_acpx_records
"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null
curl --silent --fail "$CORE_URL/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:one" > "$AFTER_RESTART_FILE"

node - <<'EOF' "$AFTER_RESTART_FILE"
const fs = require("node:fs");
const after = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (
  after.persistence?.totalRecords !== 2
  || after.persistence?.selectedRecord?.sessionKey !== "agent:codex:one"
  || after.persistence?.selectedRecord?.acpxRecordId !== "record-one-updated"
  || after.persistence?.selectedRecord?.revision !== 2
  || after.governance?.canReadCredentialValue !== false
  || after.governance?.canWriteWrapper !== false
  || after.governance?.canSpawnCodexAcp !== false
) {
  throw new Error(`ACPX/Codex persisted session records should restore after restart: ${JSON.stringify(after)}`);
}

console.log(JSON.stringify({
  openclawNativeAcpxCodexBridgeCompatibility: {
    registry: after.registry,
    totalRecords: after.persistence.totalRecords,
    selectedSession: after.persistence.selectedRecord.sessionKey,
    revision: after.persistence.selectedRecord.revision,
    credentialValueRead: after.governance.canReadCredentialValue,
    wrapperWritten: after.governance.canWriteWrapper,
    processSpawned: after.governance.canSpawnCodexAcp,
  },
}, null, 2));
EOF
