#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-microcompact-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PROMPT_SECRET="ENGINEERING_MICROCOMPACT_EVIDENCE_PROMPT_SECRET_DO_NOT_LEAK"
TOOL_SECRET="ENGINEERING_MICROCOMPACT_EVIDENCE_TOOL_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-verification-evidence-fixture.sh"
source "$SCRIPT_DIR/openclaw-engineering-microcompact-evidence-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10140}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10141}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10142}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10143}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10144}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10145}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10146}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10147}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10148}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-microcompact-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-microcompact-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_microcompact_evidence_fixture "$WORKSPACE_DIR" "$PROMPT_SECRET" "$TOOL_SECRET"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
    "${MICROCOMPACT_FILE:-}" \
    "${ADAPTER_FILE:-}"
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
MICROCOMPACT_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"verify","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

read -r approval_id task_id < <(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!taskResponse.ok || taskResponse.registry !== "openclaw-source-command-task-v0" || taskResponse.task?.status !== "queued") {
  throw new Error(`source command task should be queued behind approval: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block before approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(`${blocked.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-microcompact-evidence-check","reason":"approve microcompact evidence large-output fixture command"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-microcompact/evidence?limit=8&thresholdChars=256&protectRecentItems=0" > "$MICROCOMPACT_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$TASK_FILE" "$APPROVED_FILE" "$STEP_FILE" "$MICROCOMPACT_FILE" "$ADAPTER_FILE" "$PROMPT_SECRET" "$TOOL_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const taskResponse = readJson(2);
const approved = readJson(3);
const step = readJson(4);
const microcompact = readJson(5);
const adapter = readJson(6);
const promptSecret = process.argv[7];
const toolSecret = process.argv[8];
const rawMicrocompact = JSON.stringify({ microcompact, adapter });

if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`approval should enable audited command execution: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false || step.task?.status !== "completed") {
  throw new Error(`approved microcompact fixture should complete: ${JSON.stringify(step)}`);
}
if (!String(step.execution?.commandTranscript?.[0]?.stdout ?? "").includes("engineering-microcompact-evidence-large-output")) {
  throw new Error(`execution transcript should contain large-output marker: ${JSON.stringify(step.execution?.commandTranscript)}`);
}
if (
  !microcompact.ok
  || microcompact.registry !== "openclaw-native-engineering-microcompact-evidence-v0"
  || microcompact.mode !== "context-management-evidence-only"
  || microcompact.capability?.id !== "sense.openclaw.engineering_context.microcompact_evidence"
  || microcompact.summary?.totalItems < 1
  || microcompact.summary?.compactableItems < 1
  || microcompact.summary?.reclaimedChars <= 0
  || microcompact.governance?.canMutatePersistedLogs !== false
  || microcompact.governance?.canMutateRuntimeMessages !== false
  || microcompact.governance?.canExecuteCommand !== false
  || microcompact.bounds?.noRawOutputText !== true
  || microcompact.auditEvidence?.operation !== "microcompact_evidence"
) {
  throw new Error(`microcompact evidence mismatch: ${JSON.stringify(microcompact)}`);
}
const candidate = microcompact.candidates?.find((item) => item.taskId === taskResponse.task?.id);
if (
  !candidate
  || candidate.output?.sourceTextExposed !== false
  || candidate.output?.rawTextReturned !== false
  || candidate.output?.totalChars < 1500
  || candidate.microcompactPreview?.compactable !== true
  || candidate.microcompactPreview?.wouldMutatePersistedLogs !== false
  || candidate.microcompactPreview?.wouldMutateRuntimeMessages !== false
) {
  throw new Error(`microcompact evidence candidate mismatch: ${JSON.stringify(candidate)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_context.microcompact_evidence")
  || adapter.summary?.canReadEngineeringMicrocompactEvidence !== true
) {
  throw new Error(`native adapter missing microcompact evidence capability: ${JSON.stringify(adapter)}`);
}
if (rawMicrocompact.includes("MMMMMMMMMMMMMMMMMMMM") || rawMicrocompact.includes(promptSecret) || rawMicrocompact.includes(toolSecret)) {
  throw new Error("microcompact evidence leaked raw output or fixture secrets");
}

console.log(JSON.stringify({
  openclawNativeEngineeringMicrocompactEvidence: {
    registry: microcompact.registry,
    taskId: taskResponse.task.id,
    compactable: microcompact.summary.compactableItems,
    reclaimedChars: microcompact.summary.reclaimedChars,
    rawTextReturned: candidate.output.rawTextReturned,
  },
}, null, 2));
EOF
