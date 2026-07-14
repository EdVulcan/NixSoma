#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${OPENCLAW_CONTEXT_PACKET_CHECK_KIND:?OPENCLAW_CONTEXT_PACKET_CHECK_KIND is required}"
OBSERVER_CHECK="${OPENCLAW_CONTEXT_PACKET_OBSERVER_CHECK:-false}"
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
    "${PACKET_FILE:-}" "${ADAPTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

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
post_json "$CORE_URL/plugins/native-adapter/engineering-context/packet" "{\"limit\":8,\"maxOutputChars\":2000,\"thresholdChars\":256,\"protectRecentAssistantTurns\":0,\"includeWorkView\":true}" > "$PACKET_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'NODE' "$TASK_FILE" "$STEP_FILE" "$SECOND_STEP_FILE" "$PACKET_FILE" "$ADAPTER_FILE" "$HTML_FILE" "$CLIENT_FILE" "$OUTPUT_SECRET" "$OBSERVER_CHECK"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const taskResponse = readJson(2);
const step = readJson(3);
const secondStep = readJson(4);
const packet = readJson(5);
const adapter = readJson(6);
const htmlPath = process.argv[7];
const clientPath = process.argv[8];
const outputSecret = process.argv[9];
const observerCheck = process.argv[10] === "true";
const packetRaw = JSON.stringify({ packet, adapter });

if (!step.ok || step.ran !== true || step.task?.status !== "completed" || !secondStep.ok || secondStep.ran !== true || secondStep.task?.status !== "completed") {
  throw new Error(`context packet fixture command should complete after approval: ${JSON.stringify(step)}`);
}
if (!String(step.execution?.commandTranscript?.[0]?.stdout ?? "").includes(`password=${outputSecret}`)) {
  throw new Error(`context packet fixture should produce the redaction test output: ${JSON.stringify(step.execution?.commandTranscript)}`);
}
if (
  !packet.ok
  || packet.registry !== "openclaw-native-engineering-context-packet-v0"
  || packet.mode !== "local_governed_engineering_context_assembly"
  || packet.capability?.id !== "sense.openclaw.engineering_context.packet"
  || packet.summary?.sourceTranscriptRecords !== 2
  || packet.summary?.redactions < 1
  || packet.summary?.compactedMessages < 1
  || packet.summary?.verificationEvidenceProtected !== true
  || packet.summary?.recoveryEvidenceProtected !== true
  || packet.summary?.workViewAssociationIncluded !== true
  || !packet.workViewAssociation?.registry
  || packet.workViewAssociation?.source?.owner !== "openclaw-session-manager"
  || packet.workViewAssociation?.governance?.exposesLeaseId !== false
  || packet.workViewAssociation?.governance?.exposesActiveUrl !== false
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
    "engineering-context-packet-build-button",
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
    "includeWorkView",
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
