#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-write-execution-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
TARGET_RELATIVE_PATH="src/observer-write-execution.txt"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
SECRET_CONTENT="OBSERVER_ENGINEERING_WRITE_EXECUTION_EVIDENCE_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-read-search-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10380}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10381}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10382}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10383}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10384}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10385}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10386}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10387}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10388}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-write-execution-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-write-execution-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_read_search_fixture "$WORKSPACE_DIR" "OBSERVER_ENGINEERING_WRITE_EXECUTION_EVIDENCE"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${TASK_FILE:-}" \
    "${APPROVAL_ID_FILE:-}" \
    "${APPROVE_FILE:-}" \
    "${STEP_FILE:-}" \
    "${EVIDENCE_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVAL_ID_FILE="$(mktemp)"
APPROVE_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/plugins/native-adapter/engineering-write-proposal-tasks" "{\"relativePath\":\"$TARGET_RELATIVE_PATH\",\"content\":\"$SECRET_CONTENT\",\"overwrite\":false,\"confirm\":true}" > "$TASK_FILE"

node - <<'EOF' "$TASK_FILE" "$APPROVAL_ID_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const task = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const approvalIdFile = process.argv[3];
const secret = process.argv[4];
if (!task.ok || task.approval?.status !== "pending") {
  throw new Error(`observer write execution setup mismatch: ${JSON.stringify(task)}`);
}
if (JSON.stringify(task).includes(secret)) {
  throw new Error("observer write execution setup leaked secret");
}
fs.writeFileSync(approvalIdFile, task.approval.id);
EOF

APPROVAL_ID="$(cat "$APPROVAL_ID_FILE")"
post_json "$CORE_URL/approvals/$APPROVAL_ID/approve" '{"approvedBy":"dev-observer-openclaw-native-engineering-write-execution-evidence-check","reason":"Approve observer bounded engineering write execution evidence fixture."}' > "$APPROVE_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
TASK_ID="$(node - <<'EOF' "$STEP_FILE"
const fs = require("node:fs");
const step = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!step.ok || step.ran !== true || step.task?.status !== "completed") {
  throw new Error(`observer approved write execution did not complete: ${JSON.stringify(step)}`);
}
process.stdout.write(step.task.id);
EOF
)"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-write-execution/evidence?taskId=$TASK_ID&limit=10" > "$EVIDENCE_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$STEP_FILE" "$EVIDENCE_FILE" "$TARGET_FILE" "$SECRET_CONTENT"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const step = readJson(4);
const evidence = readJson(5);
const targetFile = process.argv[6];
const secret = process.argv[7];
const raw = JSON.stringify({ step, evidence });

for (const token of [
  "OpenClaw Engineering Write Execution",
  "engineering-write-execution-registry",
  "engineering-write-execution-total",
  "engineering-write-execution-passed",
  "engineering-write-execution-proposal",
  "engineering-write-execution-mutation",
  "engineering-write-execution-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering write execution token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-write-execution/evidence",
  "refreshEngineeringWriteExecutionEvidence",
  "renderEngineeringWriteExecutionEvidence",
  "Native engineering write execution evidence",
  "sense.openclaw.engineering_tool.write_execution_evidence",
  "approved-workspace-text-write-execution-evidence",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering write execution token: ${token}`);
  }
}
if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, "utf8") !== secret) {
  throw new Error("observer approved engineering write did not create the expected file content");
}
if (
  !evidence.ok
  || evidence.registry !== "openclaw-native-engineering-write-execution-evidence-v0"
  || evidence.summary?.passed !== 1
  || evidence.summary?.withEngineeringProposal !== 1
  || evidence.evidence?.[0]?.taskId !== step.task?.id
  || evidence.governance?.canWriteFile !== false
  || evidence.governance?.canExecuteOperatorStep !== false
) {
  throw new Error(`Observer write execution evidence mismatch: ${JSON.stringify(evidence)}`);
}
if (raw.includes(secret)) {
  throw new Error("Observer write execution evidence leaked secret content");
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringWriteExecutionEvidence: {
    html: "visible",
    client: "visible",
    registry: evidence.registry,
    taskId: step.task.id,
    passed: evidence.summary.passed,
  },
}, null, 2));
EOF
