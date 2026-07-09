#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-recovery-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PROMPT_SECRET="OBSERVER_ENGINEERING_RECOVERY_EVIDENCE_PROMPT_SECRET_DO_NOT_LEAK"
TOOL_SECRET="OBSERVER_ENGINEERING_RECOVERY_EVIDENCE_TOOL_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-verification-evidence-fixture.sh"
source "$SCRIPT_DIR/openclaw-engineering-recovery-evidence-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10120}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10121}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10122}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10123}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10124}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10125}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10126}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10127}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10128}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-recovery-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-recovery-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_recovery_evidence_fixture "$WORKSPACE_DIR" "$PROMPT_SECRET" "$TOOL_SECRET"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
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
TASK_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
RECOVERY_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"verify","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

read -r approval_id task_id < <(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!taskResponse.ok || taskResponse.registry !== "openclaw-source-command-task-v0" || taskResponse.task?.status !== "queued") {
  throw new Error(`observer recovery task should be queued behind approval: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block before observer recovery approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(`${blocked.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-native-engineering-recovery-evidence-check","reason":"approve observer recovery evidence failing fixture command"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-recovery/evidence?taskId=$task_id&maxOutputChars=1000" > "$RECOVERY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASK_FILE" "$STEP_FILE" "$RECOVERY_FILE" "$PROMPT_SECRET" "$TOOL_SECRET"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const taskResponse = readJson(4);
const step = readJson(5);
const recovery = readJson(6);
const promptSecret = process.argv[7];
const toolSecret = process.argv[8];
const raw = JSON.stringify({ html, client, taskResponse, step, recovery });

for (const token of [
  "Engineering Recovery Evidence",
  "engineering-recovery-registry",
  "engineering-recovery-failures",
  "engineering-recovery-recoverable",
  "engineering-recovery-recovered",
  "engineering-recovery-execution",
  "engineering-recovery-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering recovery token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-recovery/evidence",
  "refreshEngineeringRecoveryEvidence",
  "renderEngineeringRecoveryEvidence",
  "Native engineering recovery evidence",
  "sense.openclaw.engineering_tool.recovery_evidence",
  "failed-native-engineering-tool-recovery-evidence",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering recovery token: ${token}`);
  }
}
if (!step.ok || step.ran !== true || step.task?.status !== "failed") {
  throw new Error(`observer recovery fixture should fail after approval: ${JSON.stringify(step)}`);
}
if (
  !recovery.ok
  || recovery.registry !== "openclaw-native-engineering-recovery-evidence-v0"
  || recovery.summary?.totalFailures !== 1
  || recovery.summary?.recoverableFailures !== 1
  || recovery.governance?.canCreateRecoveryTask !== false
  || recovery.governance?.canExecuteCommand !== false
) {
  throw new Error(`Observer recovery evidence mismatch: ${JSON.stringify(recovery)}`);
}
const failure = recovery.failures?.[0];
if (
  failure?.taskId !== taskResponse.task?.id
  || failure.kind !== "verification_command_exit_nonzero"
  || failure.recoverable !== true
  || !failure.recommendations?.some((item) => item.id === "recover_task_after_review")
) {
  throw new Error(`Observer recovery evidence failure mismatch: ${JSON.stringify(failure)}`);
}
for (const secret of [promptSecret, toolSecret]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer recovery evidence leaked prompt/tool content: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringRecoveryEvidence: {
    html: "visible",
    client: "visible",
    registry: recovery.registry,
    failures: recovery.summary.totalFailures,
    recoverable: recovery.summary.recoverableFailures,
  },
}, null, 2));
EOF
