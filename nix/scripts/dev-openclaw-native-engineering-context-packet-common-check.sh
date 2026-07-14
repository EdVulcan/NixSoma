#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${OPENCLAW_CONTEXT_PACKET_CHECK_KIND:?OPENCLAW_CONTEXT_PACKET_CHECK_KIND is required}"
OBSERVER_CHECK="${OPENCLAW_CONTEXT_PACKET_OBSERVER_CHECK:-false}"
PAIR_RESET_SESSION="${OPENCLAW_CONTEXT_PACKET_PAIR_RESET_SESSION:-false}"
FIXTURE_DIR="$REPO_ROOT/.artifacts/${CHECK_KIND}-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
OUTPUT_SECRET="${CHECK_KIND}_OUTPUT_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-verification-evidence-fixture.sh"
source "$SCRIPT_DIR/openclaw-engineering-microcompact-evidence-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10100}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10101}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10102}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10103}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10104}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10105}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10106}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10107}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10108}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/${CHECK_KIND}-core-state.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/${CHECK_KIND}-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_microcompact_evidence_fixture "$WORKSPACE_DIR" "$OUTPUT_SECRET" "$OUTPUT_SECRET"

node - "$WORKSPACE_DIR/package.json" "$OUTPUT_SECRET" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const secret = process.argv[3];
const packageJson = JSON.parse(fs.readFileSync(file, "utf8"));
packageJson.scripts.typecheck = `node -e "process.stdout.write('password=${secret} ' + 'M'.repeat(1500))"`;
fs.writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
cleanup() {
  rm -f \
    "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${SECOND_TASK_FILE:-}" \
    "${SECOND_BLOCKED_FILE:-}" "${SECOND_APPROVED_FILE:-}" "${SECOND_STEP_FILE:-}" \
    "${PACKET_FILE:-}" "${ADAPTER_FILE:-}" "${PREPARE_FILE:-}" \
    "${PRE_RECOVERY_PACKET_FILE:-}" "${BIND_FILE:-}" \
    "${SESSION_RESTART_FILE:-}" "${REBIND_PREPARE_FILE:-}" \
    "${STALE_PACKET_FILE:-}" "${STALE_BIND_FILE:-}" \
    "${REBOUND_FILE:-}" "${REBOUND_PACKET_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" && "$PAIR_RESET_SESSION" == "true" ]]; then
  post_json "$SESSION_MANAGER_URL/session/restart" '{"displayTarget":"workspace-2"}' >/dev/null
fi

TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
SECOND_TASK_FILE="$(mktemp)"
SECOND_BLOCKED_FILE="$(mktemp)"
SECOND_APPROVED_FILE="$(mktemp)"
SECOND_STEP_FILE="$(mktemp)"
PACKET_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
PREPARE_FILE="$(mktemp)"
PRE_RECOVERY_PACKET_FILE="$(mktemp)"
BIND_FILE="$(mktemp)"
SESSION_RESTART_FILE="$(mktemp)"
REBIND_PREPARE_FILE="$(mktemp)"
STALE_PACKET_FILE="$(mktemp)"
STALE_BIND_FILE="$(mktemp)"
REBOUND_FILE="$(mktemp)"
REBOUND_PACKET_FILE="$(mktemp)"
HTML_FILE=""
CLIENT_FILE=""

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
fi

post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"verify","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

read -r approval_id task_id < <(node - <<'NODE' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || taskResponse.registry !== "openclaw-source-command-task-v0" || taskResponse.task?.status !== "queued") {
  throw new Error(`context packet fixture task should be queued: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`context packet fixture should block before approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(`${blocked.approval.id} ${taskResponse.task.id}\n`);
NODE
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-context-packet-check","reason":"approve bounded local context fixture command"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"verify-second","confirm":true}' > "$SECOND_TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$SECOND_BLOCKED_FILE"
read -r second_approval_id second_task_id < <(node - <<'NODE' "$SECOND_TASK_FILE" "$SECOND_BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!taskResponse.ok || !taskResponse.task?.id || !blocked.approval?.id || blocked.reason !== "policy_requires_approval") {
  throw new Error(`second context packet fixture task should be approval-gated: ${JSON.stringify({ taskResponse, blocked })}`);
}
process.stdout.write(`${blocked.approval.id} ${taskResponse.task.id}\n`);
NODE
)
post_json "$CORE_URL/approvals/$second_approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-context-packet-check","reason":"approve second bounded local context fixture command"}' > "$SECOND_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$SECOND_STEP_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-context/packet" "{\"taskId\":\"$second_task_id\",\"limit\":8,\"maxOutputChars\":2000,\"thresholdChars\":256,\"protectRecentAssistantTurns\":0,\"includeWorkView\":true,\"includeWorkViewObservation\":true,\"includePlanTodo\":true}" > "$PRE_RECOVERY_PACKET_FILE"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/engineering-context-bind"}' > "$PREPARE_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-context/work-view/bind" "{\"taskId\":\"$second_task_id\",\"confirm\":true}" > "$BIND_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-context/packet" "{\"limit\":8,\"maxOutputChars\":2000,\"thresholdChars\":256,\"protectRecentAssistantTurns\":0,\"includeWorkView\":true,\"includeWorkViewObservation\":true,\"includePlanTodo\":true}" > "$PACKET_FILE"
post_json "$SESSION_MANAGER_URL/session/restart" '{"displayTarget":"workspace-2"}' > "$SESSION_RESTART_FILE"
post_json "$SESSION_MANAGER_URL/work-view/prepare" '{"displayTarget":"workspace-2","entryUrl":"https://example.com/engineering-context-rebind"}' > "$REBIND_PREPARE_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-context/packet" "{\"taskId\":\"$second_task_id\",\"limit\":8,\"maxOutputChars\":2000,\"thresholdChars\":256,\"protectRecentAssistantTurns\":0,\"includeWorkView\":true,\"includeWorkViewObservation\":true,\"includePlanTodo\":true}" > "$STALE_PACKET_FILE"
OPENCLAW_POST_JSON_FAILURE=allow post_json "$CORE_URL/plugins/native-adapter/engineering-context/work-view/bind" "{\"taskId\":\"$second_task_id\",\"confirm\":true}" > "$STALE_BIND_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-context/work-view/bind" "{\"taskId\":\"$second_task_id\",\"confirm\":true,\"rebind\":true}" > "$REBOUND_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-context/packet" "{\"taskId\":\"$second_task_id\",\"limit\":8,\"maxOutputChars\":2000,\"thresholdChars\":256,\"protectRecentAssistantTurns\":0,\"includeWorkView\":true,\"includeWorkViewObservation\":true,\"includePlanTodo\":true}" > "$REBOUND_PACKET_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'NODE' "$TASK_FILE" "$STEP_FILE" "$SECOND_STEP_FILE" "$PRE_RECOVERY_PACKET_FILE" "$PREPARE_FILE" "$BIND_FILE" "$PACKET_FILE" "$SESSION_RESTART_FILE" "$REBIND_PREPARE_FILE" "$STALE_PACKET_FILE" "$STALE_BIND_FILE" "$REBOUND_FILE" "$REBOUND_PACKET_FILE" "$ADAPTER_FILE" "$HTML_FILE" "$CLIENT_FILE" "$OUTPUT_SECRET" "$OBSERVER_CHECK"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const taskResponse = readJson(2);
const step = readJson(3);
const secondStep = readJson(4);
const preRecoveryPacket = readJson(5);
const prepare = readJson(6);
const bind = readJson(7);
const packet = readJson(8);
const sessionRestart = readJson(9);
const rebindPrepare = readJson(10);
const stalePacket = readJson(11);
const staleBind = readJson(12);
const rebound = readJson(13);
const reboundPacket = readJson(14);
const adapter = readJson(15);
const htmlPath = process.argv[16];
const clientPath = process.argv[17];
const outputSecret = process.argv[18];
const observerCheck = process.argv[19] === "true";
const pairResetSession = process.env.OPENCLAW_CONTEXT_PACKET_PAIR_RESET_SESSION === "true";
const packetRaw = JSON.stringify({ packet, adapter });

if (!step.ok || step.ran !== true || step.task?.status !== "completed" || !secondStep.ok || secondStep.ran !== true || secondStep.task?.status !== "completed") {
  throw new Error(`context packet fixture command should complete after approval: ${JSON.stringify(step)}`);
}
if (!String(step.execution?.commandTranscript?.[0]?.stdout ?? "").includes(`password=${outputSecret}`)) {
  throw new Error(`context packet fixture should produce the redaction test output: ${JSON.stringify(step.execution?.commandTranscript)}`);
}
if (!prepare.ok || prepare.workView?.helperRuntime?.status !== "active") {
  throw new Error(`context packet bind fixture should prepare the trusted work view: ${JSON.stringify(prepare)}`);
}
if (
  !preRecoveryPacket.ok
  || preRecoveryPacket.summary?.workViewAssociationIncluded !== true
  || preRecoveryPacket.workViewAssociation?.summary?.recoveryAction !== "prepare_work_view"
  || preRecoveryPacket.summary?.workViewObservationIncluded !== true
  || preRecoveryPacket.summary?.planTodoEvidenceIncluded !== true
  || (!pairResetSession && preRecoveryPacket.workViewAssociation?.summary?.actionAuthority !== "inactive")
  || (pairResetSession && (
    preRecoveryPacket.workViewAssociation?.summary?.helperStatus !== "divergent"
    || preRecoveryPacket.workViewAssociation?.summary?.leaseMatched !== false
  ))
) {
  throw new Error(`context packet should expose the existing work-view recovery recommendation before prepare: ${JSON.stringify(preRecoveryPacket.workViewAssociation?.summary)}`);
}
if (
  !bind.ok
  || bind.changed !== true
  || bind.registry !== "openclaw-native-engineering-work-view-bind-v0"
  || bind.bind?.summary?.status !== "bound"
  || bind.bind?.governance?.changesTaskStatus !== false
  || bind.task?.status !== "completed"
  || bind.association?.summary?.status !== "bound"
  || JSON.stringify(bind.bind).includes("sessionId")
  || JSON.stringify(bind.bind).includes("leaseId")
  || JSON.stringify(bind.bind).includes("activeUrl")
) {
  throw new Error(`context packet bind fixture mismatch: ${JSON.stringify(bind)}`);
}
if (
  !packet.ok
  || packet.registry !== "openclaw-native-engineering-context-packet-v0"
  || packet.mode !== "local_governed_engineering_context_assembly"
  || packet.capability?.id !== "sense.openclaw.engineering_context.packet"
  || (!pairResetSession && packet.summary?.sourceTranscriptRecords !== 2)
  || (pairResetSession && packet.summary?.sourceTranscriptRecords < 2)
  || packet.summary?.redactions < 1
  || packet.summary?.compactedMessages < 1
  || packet.summary?.verificationEvidenceProtected !== true
  || packet.summary?.recoveryEvidenceProtected !== true
  || packet.summary?.workViewAssociationIncluded !== true
  || packet.summary?.workViewObservationIncluded !== true
  || packet.summary?.planTodoEvidenceIncluded !== true
  || packet.summary?.planTodoCurrentAction === null
  || !packet.messages?.some((message) => message.evidenceKind === "engineering_plan_todo_evidence")
  || !packet.workViewAssociation?.registry
  || packet.workViewAssociation?.observation?.registry !== "openclaw-native-engineering-work-view-observation-v0"
  || packet.workViewAssociation?.observation?.fullPayloadRetained !== false
  || packet.workViewAssociation?.observation?.desktopWideCapture !== false
  || packet.workViewAssociation?.observation?.semanticTargets?.itemsRetained !== false
  || packet.workViewAssociation?.observation?.semanticTargets?.inputValuesExposed !== false
  || packet.workViewAssociation?.observation?.semanticTargets?.selectorsExposed !== false
  || packet.workViewAssociation?.observation?.visualFrame?.pageUrl !== undefined
  || packet.workViewAssociation?.summary?.recoveryAction !== "reveal_work_view"
  || packet.workViewAssociation?.source?.owner !== "openclaw-session-manager"
  || packet.workViewAssociation?.governance?.exposesLeaseId !== false
  || packet.workViewAssociation?.governance?.exposesActiveUrl !== false
  || packet.workViewAssociation?.governance?.exposesVisualFrameBytes !== false
  || packet.workViewAssociation?.governance?.exposesSemanticTargetItems !== false
  || packet.workViewAssociation?.governance?.readsTrustedWorkViewObservation !== true
  || packet.provenance?.taskId !== null
  || packet.governance?.localAssemblyOnly !== true
  || packet.governance?.readsCredentialStore !== false
  || packet.governance?.mutatesTaskState !== false
  || packet.governance?.callsProvider !== false
  || packet.governance?.networkEgress !== false
  || packet.governance?.readsTrustedWorkViewState !== true
  || packet.governance?.localServiceReadOnly !== true
  || packet.governance?.createsTask !== false
  || packet.governance?.createsApproval !== false
  || packet.auditEvidence?.operation !== "engineering_context_packet_built"
  || packet.auditEvidence?.inputContentRecorded !== false
  || packet.auditEvidence?.outputContentRecorded !== false
) {
  throw new Error(`context packet evidence mismatch: ${JSON.stringify(packet)}`);
}
if (
  !sessionRestart.ok
  || sessionRestart.restarted !== true
  || !rebindPrepare.ok
  || rebindPrepare.workView?.helperRuntime?.status !== "active"
  || !stalePacket.ok
  || stalePacket.workViewAssociation?.summary?.status !== "stale_session_binding"
  || stalePacket.workViewAssociation?.binding?.sessionMatched !== false
  || staleBind.ok !== false
  || staleBind.bind?.summary?.status !== "stale_session_binding"
  || staleBind.bind?.summary?.operation !== "bind"
  || rebound.ok !== true
  || rebound.changed !== true
  || rebound.bind?.summary?.status !== "bound"
  || rebound.bind?.summary?.operation !== "rebind"
  || rebound.bind?.governance?.replacesExistingBinding !== true
  || rebound.association?.summary?.status !== "bound"
  || !reboundPacket.ok
  || reboundPacket.workViewAssociation?.summary?.status !== "bound"
  || reboundPacket.summary?.workViewObservationIncluded !== true
  || reboundPacket.summary?.planTodoEvidenceIncluded !== true
  || reboundPacket.provenance?.taskId !== secondStep.task?.id
) {
  throw new Error(`context packet stale binding recovery mismatch: ${JSON.stringify({ sessionRestart, rebindPrepare, stalePacket, staleBind, rebound, reboundPacket })}`);
}
if (packetRaw.includes(outputSecret)) {
  throw new Error("context packet leaked the fixture credential-like output");
}
if (packetRaw.includes("leaseId") || packetRaw.includes("activeUrl")) {
  throw new Error("context packet leaked trusted work-view lease or URL fields");
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_context.packet")
  || adapter.summary?.canExecutePluginCode !== false
  || adapter.summary?.canActivateRuntime !== false
) {
  throw new Error(`native adapter context packet boundary mismatch: ${JSON.stringify(adapter)}`);
}

if (observerCheck) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const client = fs.readFileSync(clientPath, "utf8");
  for (const token of [
    "Engineering Context Packet",
    "engineering-context-packet-registry",
    "engineering-context-packet-records",
    "engineering-context-packet-messages",
    "engineering-context-packet-redactions",
    "engineering-context-packet-provider",
    "engineering-context-packet-audit",
    "engineering-context-packet-work-view",
    "engineering-context-packet-binding",
    "engineering-context-packet-authority",
    "engineering-context-packet-capture",
    "engineering-context-packet-targets",
    "engineering-context-packet-plan-todo",
    "engineering-context-packet-recovery",
    "engineering-context-packet-build-button",
    "engineering-context-packet-bind-work-view-button",
    "engineering-context-packet-recovery-button",
    "engineering-context-packet-json",
    "engineering-loop-state-recommendation",
    "engineering-loop-state-recommendation-review",
    "engineering-loop-state-recommendation-control",
    "engineering-loop-recommendation-use-button",
    "engineering-loop-recommendation-json",
  ]) {
    if (!html.includes(token)) throw new Error(`Observer HTML missing context packet token: ${token}`);
  }
  for (const token of [
    "/plugins/native-adapter/engineering-context/packet",
    "refreshEngineeringContextPacket",
    "renderEngineeringContextPacket",
    "Local governed engineering context packet",
    "sense.openclaw.engineering_context.packet",
    "engineeringContextPacketBuildButton",
    "engineeringContextPacketBindWorkViewButton",
    "engineeringContextPacketRecovery",
    "engineeringContextPacketRecoveryButton",
    "Reveal Trusted Work View",
    "Rebind Task to Work View",
    "/plugins/native-adapter/engineering-context/work-view/bind",
    "bindEngineeringContextTaskToWorkView",
    "prepareEngineeringContextWorkView",
    "runRecommendedWorkViewAction",
    "prepare_work_view",
    "includeWorkView",
    "includeWorkViewObservation",
    "includePlanTodo",
    "engineering_plan_todo",
    "openclaw-native-engineering-work-view-observation-v0",
    "trusted_work_view",
    "renderEngineeringRecommendationFromOperatorResult",
    "useEngineeringRecommendation",
    "ENGINEERING_RECOMMENDATION_CONTRACT",
    "GOVERNED_PLAN_TODO_SUGGESTION_CONTROLS",
  ]) {
    if (!client.includes(token)) throw new Error(`Observer client missing context packet token: ${token}`);
  }
}

console.log(JSON.stringify({
  [observerCheck ? "observerOpenClawNativeEngineeringContextPacket" : "openclawNativeEngineeringContextPacket"]: {
    status: "passed",
    observer: observerCheck,
    registry: packet.registry,
    records: packet.summary.sourceTranscriptRecords,
    redactions: packet.summary.redactions,
    compactedMessages: packet.summary.compactedMessages,
    provider: packet.governance.callsProvider,
  },
}, null, 2));
NODE
