#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-recovery-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PROMPT_SECRET="ENGINEERING_RECOVERY_EVIDENCE_PROMPT_SECRET_DO_NOT_LEAK"
TOOL_SECRET="ENGINEERING_RECOVERY_EVIDENCE_TOOL_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-verification-evidence-fixture.sh"
source "$SCRIPT_DIR/openclaw-engineering-recovery-evidence-fixture.sh"

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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-recovery-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-recovery-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_recovery_evidence_fixture "$WORKSPACE_DIR" "$PROMPT_SECRET" "$TOOL_SECRET"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
    "${RECOVERY_FILE:-}" \
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
RECOVERY_FILE="$(mktemp)"
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
if (!blocked.approval?.id || blocked.approval.id !== taskResponse.approval?.id) {
  throw new Error(`blocked step should expose matching approval: ${JSON.stringify(blocked.approval)}`);
}
process.stdout.write(`${blocked.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-openclaw-native-engineering-recovery-evidence-check","reason":"approve recovery evidence failing fixture command"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-recovery/evidence?taskId=$task_id&maxOutputChars=1000" > "$RECOVERY_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$TASK_FILE" "$APPROVED_FILE" "$STEP_FILE" "$RECOVERY_FILE" "$ADAPTER_FILE" "$PROMPT_SECRET" "$TOOL_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const taskResponse = readJson(2);
const approved = readJson(3);
const step = readJson(4);
const recovery = readJson(5);
const adapter = readJson(6);
const promptSecret = process.argv[7];
const toolSecret = process.argv[8];
const raw = JSON.stringify({ taskResponse, approved, step, recovery, adapter });

if (approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error(`approval should enable audited command execution: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false || step.task?.status !== "failed") {
  throw new Error(`approved recovery fixture should fail after command execution: ${JSON.stringify(step)}`);
}
if (!String(step.execution?.commandTranscript?.[0]?.stdout ?? "").includes("engineering-recovery-evidence-failed")) {
  throw new Error(`execution transcript should contain failing verification output: ${JSON.stringify(step.execution?.commandTranscript)}`);
}
if (
  !recovery.ok
  || recovery.registry !== "openclaw-native-engineering-recovery-evidence-v0"
  || recovery.mode !== "failed-native-engineering-tool-recovery-evidence"
  || recovery.capability?.id !== "sense.openclaw.engineering_tool.recovery_evidence"
  || recovery.summary?.totalFailures !== 1
  || recovery.summary?.recoverableFailures !== 1
  || recovery.summary?.workStandardsCoveredFailures !== 1
  || recovery.summary?.workStandardsRecoveryRecommended !== 1
  || recovery.workStandardsCoverage?.registry !== "openclaw-engineering-recovery-work-standards-coverage-v0"
  || recovery.workStandardsCoverage?.status !== "covered"
  || recovery.workStandardsCoverage?.governance?.canExecuteCommand !== false
  || recovery.governance?.canCreateRecoveryTask !== false
  || recovery.governance?.canExecuteCommand !== false
  || recovery.bounds?.noCommandExecution !== true
  || recovery.auditEvidence?.operation !== "recovery_evidence"
) {
  throw new Error(`recovery evidence mismatch: ${JSON.stringify(recovery)}`);
}
const failure = recovery.failures?.[0];
if (
  failure?.taskId !== taskResponse.task?.id
  || failure.kind !== "verification_command_exit_nonzero"
  || failure.recoverable !== true
  || failure.alreadyRecovered !== false
  || failure.workStandardsCoverage?.status !== "covered"
  || failure.workStandardsCoverage?.reportReadiness?.canReportWithEvidence !== true
  || failure.workStandardsCoverage?.reportReadiness?.recoveryEvidenceRecommended !== true
  || failure.result?.exitCode !== 7
  || !failure.recommendations?.some((item) => item.id === "recover_task_after_review" && item.endpoint === `/tasks/${taskResponse.task.id}/recover`)
  || failure.recommendations?.some((item) => item.executesCommand === true)
) {
  throw new Error(`recovery evidence failure mismatch: ${JSON.stringify(failure)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.recovery_evidence")
  || adapter.summary?.canReadEngineeringRecoveryEvidence !== true
) {
  throw new Error(`native adapter missing recovery evidence capability: ${JSON.stringify(adapter)}`);
}
for (const secret of [promptSecret, toolSecret]) {
  if (raw.includes(secret)) {
    throw new Error(`recovery evidence leaked prompt/tool content: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringRecoveryEvidence: {
    registry: recovery.registry,
    taskId: taskResponse.task.id,
    failures: recovery.summary.totalFailures,
    recoverable: recovery.summary.recoverableFailures,
    standardsCovered: recovery.summary.workStandardsCoveredFailures,
    recommendation: failure.recommendations.find((item) => item.id === "recover_task_after_review")?.endpoint,
  },
}, null, 2));
EOF
