#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-lsp-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
FAKE_BIN_DIR="$FIXTURE_DIR/bin"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-lsp-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-lsp-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "ENGINEERING_LSP_EVIDENCE"
mkdir -p "$WORKSPACE_DIR/scripts" "$WORKSPACE_DIR/python" "$FAKE_BIN_DIR"
cat > "$WORKSPACE_DIR/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext"
  }
}
JSON
cat > "$WORKSPACE_DIR/scripts/tool.mjs" <<'JS'
export const lspScriptMarker = "OpenClaw LSP evidence javascript";
JS
cat > "$WORKSPACE_DIR/pyproject.toml" <<'TOML'
[project]
name = "openclaw-lsp-evidence-fixture"
TOML
cat > "$WORKSPACE_DIR/python/agent.py" <<'PY'
def lsp_agent_marker():
    return "OpenClaw LSP evidence python"
PY
cat > "$FAKE_BIN_DIR/typescript-language-server" <<'SH'
#!/usr/bin/env bash
printf 'openclaw-fixture-typescript-lsp-ready\n' >&2
sleep 5
SH
chmod +x "$FAKE_BIN_DIR/typescript-language-server"
export PATH="$FAKE_BIN_DIR:$PATH"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${CHECK_FILE:-}" \
    "${POSITION_FILE:-}" \
    "${BAD_PATH_FILE:-}" \
    "${DRAFT_FILE:-}" \
    "${ADAPTER_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BLOCKED_STEP_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${EXEC_STEP_FILE:-}" \
    "${TASK_READBACK_FILE:-}" \
    "${PROCESS_TASK_FILE:-}" \
    "${PROCESS_BLOCKED_STEP_FILE:-}" \
    "${PROCESS_APPROVED_FILE:-}" \
    "${PROCESS_STEP_FILE:-}" \
    "${PROCESS_TASK_READBACK_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

CHECK_FILE="$(mktemp)"
POSITION_FILE="$(mktemp)"
BAD_PATH_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
BLOCKED_STEP_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
EXEC_STEP_FILE="$(mktemp)"
TASK_READBACK_FILE="$(mktemp)"
PROCESS_TASK_FILE="$(mktemp)"
PROCESS_BLOCKED_STEP_FILE="$(mktemp)"
PROCESS_APPROVED_FILE="$(mktemp)"
PROCESS_STEP_FILE="$(mktemp)"
PROCESS_TASK_READBACK_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=check&language=typescript&limit=200" > "$CHECK_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=definition&language=typescript&relativePath=src/app.ts&line=2&character=14&limit=200" > "$POSITION_FILE"
BAD_STATUS="$(curl --silent --output "$BAD_PATH_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/engineering-lsp/evidence?action=hover&language=typescript&relativePath=.cache/leak.ts")"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-draft?language=python&lifecycleAction=restart&limit=200" > "$DRAFT_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"python","lifecycleAction":"restart","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"

read -r approval_id lifecycle_task_id < <(node - <<'EOF' "$TASK_FILE" "$BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-engineering-lsp-lifecycle-task-v0"
  || taskResponse.mode !== "approval-gated-lsp-lifecycle-binary-gate"
  || taskResponse.engineeringLspLifecycle?.language !== "python"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "restart"
  || taskResponse.engineeringLspLifecycle?.server?.serverBinary !== "pylsp"
  || taskResponse.engineeringLspLifecycle?.server?.processStarted !== false
  || taskResponse.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
  || taskResponse.governance?.createsTask !== true
  || taskResponse.governance?.createsApproval !== true
  || taskResponse.governance?.canExecuteWithoutApproval !== false
  || taskResponse.governance?.canStartProcessWithoutApproval !== false
  || taskResponse.governance?.canSendJsonRpcRequest !== false
) {
  throw new Error(`LSP lifecycle task creation mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  !blockedStep.ok
  || blockedStep.ran !== false
  || blockedStep.blocked !== true
  || blockedStep.reason !== "policy_requires_approval"
  || blockedStep.approval?.id !== taskResponse.approval?.id
  || blockedStep.task?.engineeringLspLifecycle?.server?.processStarted !== false
  || blockedStep.task?.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
) {
  throw new Error(`LSP lifecycle task should block before approval: ${JSON.stringify(blockedStep)}`);
}

process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP lifecycle binary gate"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$EXEC_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$lifecycle_task_id" > "$TASK_READBACK_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-lsp/lifecycle-tasks" '{"language":"typescript","lifecycleAction":"start","confirm":true}' > "$PROCESS_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$PROCESS_BLOCKED_STEP_FILE"

read -r process_approval_id process_task_id < <(node - <<'EOF' "$PROCESS_TASK_FILE" "$PROCESS_BLOCKED_STEP_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blockedStep = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (
  !taskResponse.ok
  || taskResponse.registry !== "openclaw-native-engineering-lsp-lifecycle-task-v0"
  || taskResponse.engineeringLspLifecycle?.language !== "typescript"
  || taskResponse.engineeringLspLifecycle?.lifecycleAction !== "start"
  || taskResponse.engineeringLspLifecycle?.server?.serverBinary !== "typescript-language-server"
  || taskResponse.engineeringLspLifecycle?.server?.processStarted !== false
  || taskResponse.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
) {
  throw new Error(`LSP lifecycle process task creation mismatch: ${JSON.stringify(taskResponse)}`);
}
if (
  !blockedStep.ok
  || blockedStep.ran !== false
  || blockedStep.blocked !== true
  || blockedStep.reason !== "policy_requires_approval"
  || blockedStep.approval?.id !== taskResponse.approval?.id
) {
  throw new Error(`LSP lifecycle process task should block before approval: ${JSON.stringify(blockedStep)}`);
}

process.stdout.write(`${blockedStep.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$process_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-lsp-evidence-check","reason":"approve bounded LSP lifecycle process supervision probe"}' > "$PROCESS_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$PROCESS_STEP_FILE"
curl --silent --fail "$CORE_URL/tasks/$process_task_id" > "$PROCESS_TASK_READBACK_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?limit=120" > "$EVENTS_FILE"

node - <<'EOF' \
  "$CHECK_FILE" \
  "$POSITION_FILE" \
  "$BAD_PATH_FILE" \
  "$BAD_STATUS" \
  "$DRAFT_FILE" \
  "$ADAPTER_FILE" \
  "$TASK_FILE" \
  "$BLOCKED_STEP_FILE" \
  "$APPROVED_FILE" \
  "$EXEC_STEP_FILE" \
  "$TASK_READBACK_FILE" \
  "$PROCESS_TASK_FILE" \
  "$PROCESS_BLOCKED_STEP_FILE" \
  "$PROCESS_APPROVED_FILE" \
  "$PROCESS_STEP_FILE" \
  "$PROCESS_TASK_READBACK_FILE" \
  "$EVENTS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const check = readJson(2);
const position = readJson(3);
const bad = readJson(4);
const badStatus = process.argv[5];
const draft = readJson(6);
const adapter = readJson(7);
const taskResponse = readJson(8);
const blockedStep = readJson(9);
const approved = readJson(10);
const execStep = readJson(11);
const taskReadback = readJson(12);
const processTaskResponse = readJson(13);
const processBlockedStep = readJson(14);
const processApproved = readJson(15);
const processStep = readJson(16);
const processTaskReadback = readJson(17);
const events = readJson(18);
const raw = JSON.stringify({ check, position, bad, draft, adapter, taskResponse, blockedStep, approved, execStep, taskReadback, processTaskResponse, processBlockedStep, processApproved, processStep, processTaskReadback, events });

if (
  !check.ok
  || check.registry !== "openclaw-native-engineering-lsp-evidence-v0"
  || check.mode !== "lsp-contract-and-availability-evidence-only"
  || check.capability?.id !== "sense.openclaw.engineering_tool.lsp_evidence"
  || check.summary?.selectedAction !== "check"
  || !check.summary?.detectedLanguages?.includes("typescript")
  || !check.summary?.detectedLanguages?.includes("javascript")
  || !check.summary?.detectedLanguages?.includes("python")
  || check.serverReadiness?.status !== "not_checked"
  || check.serverReadiness?.wouldRunVersionCommand !== false
  || check.serverReadiness?.canStartServer !== false
  || check.serverReadiness?.canSendJsonRpcRequest !== false
  || check.governance?.canReadWorkspaceMetadata !== true
  || check.governance?.canReadSourceFileContent !== false
  || check.governance?.canCheckServerBinary !== false
  || check.governance?.canStartLspServer !== false
  || check.governance?.canOpenFileInServer !== false
  || check.governance?.canSendJsonRpcRequest !== false
  || check.governance?.canExecuteCommand !== false
  || check.governance?.canMutate !== false
  || check.governance?.canCreateTask !== false
  || check.governance?.canCreateApproval !== false
  || check.governance?.canCallProvider !== false
  || check.bounds?.workspaceRootConstrained !== true
  || check.bounds?.noSourceFileContentRead !== true
  || check.bounds?.noServerBinaryCheck !== true
  || check.bounds?.noLspServerStart !== true
  || check.bounds?.noJsonRpcRequest !== true
  || check.bounds?.noCommandExecution !== true
  || check.auditEvidence?.operation !== "lsp_evidence"
) {
  throw new Error(`LSP check evidence mismatch: ${JSON.stringify(check)}`);
}
if (
  !position.ok
  || position.summary?.selectedAction !== "definition"
  || position.requestedPosition?.required !== true
  || position.requestedPosition?.valid !== true
  || position.requestedPosition?.relativePath !== "src/app.ts"
  || position.requestedPosition?.contentRead !== false
  || position.summary?.canResolveSymbolNow !== false
) {
  throw new Error(`LSP position evidence mismatch: ${JSON.stringify(position)}`);
}
if (badStatus !== "400" || bad.ok !== false || !String(bad.error ?? "").includes("hidden/generated/cache")) {
  throw new Error(`LSP skipped-directory path should be rejected with 400: status=${badStatus} body=${JSON.stringify(bad)}`);
}
if (
  !draft.ok
  || draft.registry !== "openclaw-native-engineering-lsp-lifecycle-draft-v0"
  || draft.mode !== "lsp-lifecycle-readiness-draft-only"
  || draft.capability?.id !== "plan.openclaw.engineering_tool.lsp_lifecycle"
  || draft.summary?.selectedLanguage !== "python"
  || draft.summary?.lifecycleAction !== "restart"
  || !draft.summary?.detectedLanguages?.includes("python")
  || draft.summary?.executionReady !== false
  || draft.summary?.canCreateTaskNow !== false
  || draft.lifecycleDraft?.server?.serverBinary !== "pylsp"
  || draft.lifecycleDraft?.status !== "draft_only"
  || draft.lifecycleDraft?.workspaceScoped !== true
  || draft.lifecycleDraft?.createsTask !== false
  || draft.lifecycleDraft?.createsApproval !== false
  || draft.lifecycleDraft?.executesCommand !== false
  || draft.lifecycleDraft?.server?.binaryChecked !== false
  || draft.lifecycleDraft?.server?.processStarted !== false
  || draft.lifecycleDraft?.server?.jsonRpcHandshakeSent !== false
  || draft.governance?.canDraftLifecycleAction !== true
  || draft.governance?.canCheckServerBinary !== false
  || draft.governance?.canStartLspServer !== false
  || draft.governance?.canSendJsonRpcRequest !== false
  || draft.governance?.canCreateTask !== false
  || draft.governance?.canCreateApproval !== false
  || draft.bounds?.noTaskCreation !== true
  || draft.bounds?.noApprovalCreation !== true
  || draft.auditEvidence?.operation !== "lsp_lifecycle_readiness_draft"
  || !draft.readinessGates?.some((gate) => gate.id === "process_supervision" && gate.status === "deferred")
) {
  throw new Error(`LSP lifecycle draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.lsp_evidence")
  || !adapter.implementedCapabilities?.includes("plan.openclaw.engineering_tool.lsp_lifecycle")
  || !adapter.implementedCapabilities?.includes("act.openclaw.engineering_tool.lsp_lifecycle_task")
  || adapter.summary?.canReadEngineeringLspEvidence !== true
  || adapter.summary?.canDraftEngineeringLspLifecycleAction !== true
  || adapter.summary?.canCreateApprovalGatedEngineeringLspLifecycleTasks !== true
) {
  throw new Error(`native adapter missing LSP evidence/lifecycle capability: ${JSON.stringify(adapter)}`);
}
if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP lifecycle approval should convert task to audited execution: ${JSON.stringify(approved)}`);
}
if (
  !execStep.ok
  || !(
    (execStep.ran === true && execStep.blocked === false)
    || (execStep.ran === false && execStep.blocked === true && execStep.reason === "lsp_server_binary_missing")
  )
) {
  throw new Error(`approved LSP lifecycle task should run its binary gate: ${JSON.stringify(execStep)}`);
}
const lifecycleTask = execStep.task;
const lifecycle = lifecycleTask?.engineeringLspLifecycle ?? {};
const execution = execStep.execution?.execution ?? lifecycle.execution ?? lifecycleTask?.outcome?.details?.lspLifecycleExecution;
if (
  lifecycleTask?.id !== taskResponse.task?.id
  || lifecycle.language !== "python"
  || lifecycle.lifecycleAction !== "restart"
  || lifecycle.server?.binaryChecked !== true
  || lifecycle.server?.processStarted !== false
  || lifecycle.server?.jsonRpcHandshakeSent !== false
  || execution?.registry !== "openclaw-native-engineering-lsp-lifecycle-execution-v0"
  || execution?.mode !== "approved-lsp-lifecycle-binary-gate"
  || execution?.governance?.approved !== true
  || execution?.governance?.canStartProcessWithoutApproval !== false
  || execution?.governance?.processStarted !== false
  || execution?.governance?.jsonRpcEnabled !== false
  || execution?.governance?.contentExposed !== false
  || execution?.server?.binaryChecked !== true
  || execution?.server?.processStarted !== false
  || execution?.server?.jsonRpcHandshakeSent !== false
  || execution?.server?.serverBinary !== "pylsp"
) {
  throw new Error(`LSP lifecycle binary gate readback mismatch: ${JSON.stringify({ lifecycleTask, execution })}`);
}
if (execution.result?.ok === true) {
  if (lifecycleTask.status !== "completed" || execution.result?.state !== "binary_gate_passed_process_supervision_deferred") {
    throw new Error(`LSP lifecycle binary-present path should complete without process start: ${JSON.stringify({ lifecycleTask, execution })}`);
  }
} else if (execution.result?.failureKind === "lsp_server_binary_missing") {
  if (
    lifecycleTask.status !== "failed"
    || lifecycleTask.outcome?.details?.recoveryEvidence?.kind !== "lsp_lifecycle_recovery"
    || lifecycleTask.outcome?.details?.recoveryEvidence?.recoverable !== true
    || !String(execution.recoveryRecommendation?.nextAction ?? "").includes("pylsp")
  ) {
    throw new Error(`LSP lifecycle missing-binary path should attach recovery evidence: ${JSON.stringify({ lifecycleTask, execution })}`);
  }
} else {
  throw new Error(`LSP lifecycle binary gate returned unexpected result: ${JSON.stringify(execution)}`);
}
if (taskReadback.task?.id !== lifecycleTask.id || taskReadback.task?.engineeringLspLifecycle?.server?.processStarted !== false) {
  throw new Error(`LSP lifecycle task endpoint should preserve execution readback: ${JSON.stringify(taskReadback)}`);
}
if (processApproved.approval?.status !== "approved" || processApproved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`LSP process supervision approval should convert task to audited execution: ${JSON.stringify(processApproved)}`);
}
if (!processStep.ok || processStep.ran !== true || processStep.blocked !== false) {
  throw new Error(`approved LSP process supervision task should complete: ${JSON.stringify(processStep)}`);
}
const supervisedTask = processStep.task;
const supervisedExecution = supervisedTask?.outcome?.details?.lspLifecycleExecution ?? supervisedTask?.engineeringLspLifecycle?.execution;
if (
  processTaskResponse.registry !== "openclaw-native-engineering-lsp-lifecycle-task-v0"
  || processBlockedStep.reason !== "policy_requires_approval"
  || supervisedTask?.id !== processTaskResponse.task?.id
  || supervisedTask.status !== "completed"
  || supervisedExecution?.result?.state !== "process_supervision_probe_completed_json_rpc_deferred"
  || supervisedExecution?.server?.serverBinary !== "typescript-language-server"
  || supervisedExecution?.server?.binaryFound !== true
  || supervisedExecution?.server?.processStarted !== true
  || supervisedExecution?.server?.processAliveAtProbe !== true
  || supervisedExecution?.server?.processTerminated !== true
  || supervisedExecution?.server?.jsonRpcHandshakeSent !== false
  || supervisedExecution?.processSupervision?.attempted !== true
  || supervisedExecution?.processSupervision?.started !== true
  || supervisedExecution?.processSupervision?.terminationSent !== true
  || !String(supervisedExecution?.processSupervision?.stderr?.text ?? "").includes("openclaw-fixture-typescript-lsp-ready")
  || supervisedExecution?.governance?.approved !== true
  || supervisedExecution?.governance?.jsonRpcEnabled !== false
  || supervisedExecution?.governance?.contentExposed !== false
) {
  throw new Error(`LSP process supervision readback mismatch: ${JSON.stringify({ supervisedTask, supervisedExecution })}`);
}
if (
  processTaskReadback.task?.id !== supervisedTask.id
  || processTaskReadback.task?.engineeringLspLifecycle?.server?.processStarted !== true
  || processTaskReadback.task?.engineeringLspLifecycle?.server?.jsonRpcHandshakeSent !== false
) {
  throw new Error(`LSP process task endpoint should preserve supervision readback: ${JSON.stringify(processTaskReadback)}`);
}
const eventTypes = new Set((events.items ?? events.events ?? []).map((event) => event.type));
for (const type of ["approval.created", "approval.approved", "policy.evaluated"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`LSP lifecycle audit trail missing ${type}: ${JSON.stringify([...eventTypes])}`);
  }
}
if (!eventTypes.has("task.failed") && !eventTypes.has("task.completed")) {
  throw new Error(`LSP lifecycle audit trail should record terminal task event: ${JSON.stringify([...eventTypes])}`);
}
for (const token of [
  "no server binary version check",
  "no LSP server process start",
  "no lifecycle task creation",
  "approval-gated-lsp-lifecycle-binary-gate",
  "approved-lsp-lifecycle-binary-gate",
  "no file content read into LSP",
  "no definition/references/hover JSON-RPC request",
]) {
  if (!raw.includes(token)) {
    throw new Error(`LSP evidence missing boundary token: ${token}`);
  }
}
for (const token of [
  "ENGINEERING_LSP_EVIDENCE_NODE_MODULES_SECRET",
  "ENGINEERING_LSP_EVIDENCE_CACHE_SECRET",
  "ENGINEERING_LSP_EVIDENCE_GENERATED_SECRET",
]) {
  if (raw.includes(token)) {
    throw new Error(`LSP evidence leaked skipped fixture secret: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringLspEvidence: {
    registry: check.registry,
    lifecycleRegistry: draft.registry,
    lifecycleTaskRegistry: taskResponse.registry,
    lifecycleExecutionRegistry: execution.registry,
    lifecycleProcessState: supervisedExecution.result.state,
    languages: check.summary.detectedLanguages,
    lifecycleAction: draft.summary.lifecycleAction,
    serverStatus: check.serverReadiness.status,
    lifecycleTaskStatus: lifecycleTask.status,
    binaryFound: execution.server.binaryFound,
    processStarted: execution.server.processStarted,
    jsonRpcSent: execution.server.jsonRpcHandshakeSent,
    supervisedProcessStarted: supervisedExecution.server.processStarted,
    supervisedProcessTerminated: supervisedExecution.server.processTerminated,
    supervisedJsonRpcSent: supervisedExecution.server.jsonRpcHandshakeSent,
    badPathStatus: badStatus,
    lspEvidenceJsonRpcSent: check.summary.jsonRpcSent,
  },
}, null, 2));
EOF
