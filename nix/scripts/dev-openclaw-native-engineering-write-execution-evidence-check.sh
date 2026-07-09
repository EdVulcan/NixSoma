#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-write-execution-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="src/write-execution.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
SECRET_CONTENT="ENGINEERING_WRITE_EXECUTION_EVIDENCE_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10360}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10361}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10362}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10363}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10364}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10365}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10366}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10367}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10368}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-write-execution-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-write-execution-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "ENGINEERING_WRITE_EXECUTION_EVIDENCE"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${APPROVAL_ID_FILE:-}" \
    "${APPROVE_FILE:-}" \
    "${STEP_FILE:-}" \
    "${EVIDENCE_FILE:-}" \
    "${ADAPTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

TASK_FILE="$(mktemp)"
APPROVAL_ID_FILE="$(mktemp)"
APPROVE_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks" "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"content\":\"$SECRET_CONTENT\",\"overwrite\":false,\"confirm\":true}" > "$TASK_FILE"

node - <<'EOF' "$TASK_FILE" "$APPROVAL_ID_FILE" "$TARGET_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const task = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const approvalIdFile = process.argv[3];
const targetFile = process.argv[4];
const secret = process.argv[5];
const raw = JSON.stringify(task);

if (
  !task.ok
  || task.registry !== "openclaw-native-engineering-write-proposal-task-v0"
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.task?.engineeringWriteProposal?.proposalId !== task.engineeringWriteProposal?.proposal?.id
  || task.task?.engineeringWriteProposal?.contentExposed !== false
) {
  throw new Error(`write execution task setup mismatch: ${JSON.stringify(task)}`);
}
if (fs.existsSync(targetFile)) {
  throw new Error("write execution target exists before approval");
}
if (raw.includes(secret)) {
  throw new Error("write execution task setup leaked secret");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
post_json "$CORE_URL/approvals/$APPROVAL_ID/approve" '{"approvedBy":"dev-openclaw-native-engineering-write-execution-evidence-check","reason":"Approve bounded engineering write execution evidence fixture."}' > "$APPROVE_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

TASK_ID="$(node - <<'EOF' "$STEP_FILE"
const fs = require("node:fs");
const step = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!step.ok || step.ran !== true || step.task?.status !== "completed") {
  throw new Error(`approved write execution did not complete: ${JSON.stringify(step)}`);
}
process.stdout.write(step.task.id);
EOF
)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-execution/evidence?taskId=$TASK_ID&limit=10" > "$EVIDENCE_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"

node - <<'EOF' "$APPROVE_FILE" "$STEP_FILE" "$EVIDENCE_FILE" "$ADAPTER_FILE" "$TARGET_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const approve = readJson(2);
const step = readJson(3);
const evidence = readJson(4);
const adapter = readJson(5);
const targetFile = process.argv[6];
const secret = process.argv[7];
const raw = JSON.stringify({ approve, step, evidence, adapter });

if (approve.approval?.status !== "approved") {
  throw new Error(`approval mismatch: ${JSON.stringify(approve)}`);
}
if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, "utf8") !== secret) {
  throw new Error("approved engineering write did not create the expected file content");
}
if (
  !evidence.ok
  || evidence.registry !== "openclaw-native-engineering-write-execution-evidence-v0"
  || evidence.capability?.id !== "sense.openclaw.engineering_tool.write_execution_evidence"
  || evidence.summary?.total !== 1
  || evidence.summary?.passed !== 1
  || evidence.summary?.withEngineeringProposal !== 1
  || evidence.summary?.completedTasks !== 1
  || evidence.evidence?.[0]?.taskId !== step.task?.id
  || evidence.evidence?.[0]?.validation?.ok !== true
  || evidence.evidence?.[0]?.proposal?.sourceCapabilityId !== "act.openclaw.engineering_tool.write_proposal"
  || evidence.evidence?.[0]?.proposal?.approvedMutationCapabilityId !== "act.openclaw.workspace_text_write"
  || evidence.governance?.canWriteFile !== false
  || evidence.governance?.canCreateTask !== false
  || evidence.governance?.canApproveTask !== false
  || evidence.governance?.canExecuteOperatorStep !== false
  || evidence.bounds?.noFilesystemWrite !== true
  || evidence.auditEvidence?.operation !== "write_execution_evidence"
) {
  throw new Error(`write execution evidence mismatch: ${JSON.stringify(evidence)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_tool.write_execution_evidence")
  || adapter.summary?.canReadEngineeringWriteExecutionEvidence !== true
) {
  throw new Error(`native adapter missing write execution evidence capability: ${JSON.stringify(adapter)}`);
}
if (raw.includes(secret)) {
  throw new Error("write execution evidence leaked secret content");
}

console.log(JSON.stringify({
  openclawNativeEngineeringWriteExecutionEvidence: {
    registry: evidence.registry,
    taskId: step.task.id,
    passed: evidence.summary.passed,
    bytes: evidence.summary.totalContentBytes,
  },
}, null, 2));
EOF
