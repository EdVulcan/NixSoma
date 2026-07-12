#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/observer-eye-hand-recovery-evidence"
EXPECTED_URL="https://expected.invalid/observer-eye-hand-recovery-evidence"
INPUT_TEXT="observer sees recovery evidence context"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5790}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5791}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5792}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5793}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5794}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5795}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5796}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5797}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5860}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-eye-hand-recovery-evidence-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

assert_json() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

"$SCRIPT_DIR/dev-up.sh"

CLIENT_FILE="$(mktemp)"
curl --silent "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$CLIENT_FILE"
const fs = require("node:fs");
const client = fs.readFileSync(process.argv[2], "utf8");
const requiredClient = [
  "taskRecoveryEvidence",
  "Recovery Evidence:",
  "Recovery Evidence Observed URL",
  "Recovery Recommendation",
];
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

failed_execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Observer fail with recoverable eye-hand evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"expectedUrl\":\"$EXPECTED_URL\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":740,\"y\":450,\"button\":\"left\"}}]}")"
failed_task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="failed"){throw new Error(`expected observer failed task: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$failed_execution")"
latest_failed="$(curl --silent "$CORE_URL/tasks/focus/latest-failed")"
recovered="$(post_json "$CORE_URL/tasks/$failed_task_id/recover" '{}')"

stop_task_create="$(post_json "$CORE_URL/tasks" "{\"goal\":\"Observer operator stop recovery for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"workViewStrategy\":\"ai-work-view\"}")"
stop_task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.task?.id){throw new Error(`expected stop task: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$stop_task_create")"
post_json "$CORE_URL/tasks/$stop_task_id/phase" "{\"phase\":\"preparing_work_view\",\"status\":\"running\",\"details\":{\"targetUrl\":\"$TARGET_URL\",\"displayTarget\":\"workspace-2\"}}" >/dev/null
stop_prepare="$(post_json "$SESSION_MANAGER_URL/work-view/prepare" "{\"displayTarget\":\"workspace-2\",\"entryUrl\":\"$TARGET_URL\"}")"
assert_json "$stop_prepare" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.session?.sessionId){throw new Error(`stop task work-view prepare failed: ${JSON.stringify(data)}`);}'
post_json "$CORE_URL/tasks/$stop_task_id/phase" "{\"phase\":\"opening_target\",\"status\":\"running\",\"details\":{\"targetUrl\":\"$TARGET_URL\"}}" >/dev/null
stop_reveal="$(post_json "$SESSION_MANAGER_URL/work-view/reveal" "{\"entryUrl\":\"$TARGET_URL\"}")"
assert_json "$stop_reveal" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.workView?.visibility!=="visible"){throw new Error(`stop task work-view reveal failed: ${JSON.stringify(data)}`);}'
stop_attach_body="$(node -e 'const data=JSON.parse(process.argv[1]); const payload={sessionId:data.session?.sessionId??null,status:data.workView?.status??"ready",visibility:data.workView?.visibility??"visible",mode:data.workView?.mode??"foreground-observable",helperStatus:data.workView?.helperStatus??"active",displayTarget:data.workView?.displayTarget??"workspace-2",activeUrl:data.workView?.activeUrl??data.browser?.activeUrl??data.tab?.url??null}; process.stdout.write(JSON.stringify(payload));' "$stop_reveal")"
stop_attach="$(post_json "$CORE_URL/tasks/$stop_task_id/attach-work-view" "$stop_attach_body")"
assert_json "$stop_attach" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.executionPhase!=="ready_for_action"){throw new Error(`stop task attach failed: ${JSON.stringify(data)}`);}'
stop_session_id="$(node -e 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task?.workView?.sessionId??"");' "$stop_attach")"
stopped="$(post_json "$CORE_URL/control/stop" '{}')"
stopped_recovered="$(post_json "$CORE_URL/tasks/$stop_task_id/recover" '{}')"

node - <<'EOF' "$failed_execution" "$latest_failed" "$recovered" "$TARGET_URL" "$INPUT_TEXT" "$stopped" "$stopped_recovered" "$stop_session_id"
const failedExecution = JSON.parse(process.argv[2]);
const latestFailed = JSON.parse(process.argv[3]);
const recovered = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const inputText = process.argv[6];
const stopped = JSON.parse(process.argv[7]);
const stoppedRecovered = JSON.parse(process.argv[8]);
const stopSessionId = process.argv[9];

const failedEvidence = failedExecution.task?.outcome?.details?.recoveryEvidence;
const latestEvidence = latestFailed.task?.outcome?.details?.recoveryEvidence;
const recoveredEvidence = recovered.task?.recovery?.recoveryEvidence;

for (const [label, evidence] of [
  ["failed response", failedEvidence],
  ["latest failed focus", latestEvidence],
  ["recovered task", recoveredEvidence],
]) {
  if (evidence?.observedUrl !== targetUrl || evidence?.recommendation?.strategy !== "retry_with_fresh_observation") {
    throw new Error(`${label} should expose observer-visible recovery evidence: ${JSON.stringify(evidence)}`);
  }
  const inputEvidence = evidence?.actionEvidence?.actions?.find((action) => action.kind === "keyboard.type")?.params?.inputEvidence;
  if (inputEvidence?.charCount !== inputText.length
    || inputEvidence.textExposed !== false
    || JSON.stringify(evidence).includes(inputText)) {
    throw new Error(`${label} should retain redacted input context: ${JSON.stringify(evidence)}`);
  }
}

const stoppedAuthority = stopped.task?.outcome?.details?.trustedWorkViewAuthority;
const stoppedEvidence = stopped.task?.outcome?.details?.recoveryEvidence;
const stoppedRecoveredEvidence = stoppedRecovered.task?.recovery?.recoveryEvidence;
if (!stopped.ok
  || stopped.task?.status !== "failed"
  || stoppedAuthority?.authorityRevoked !== true
  || stoppedAuthority?.actionAuthority !== "suspended"
  || stoppedEvidence?.kind !== "work-view-authority-recovery-evidence"
  || stoppedEvidence?.sourceTaskId !== stopped.task?.id
  || stoppedEvidence?.targetUrl !== targetUrl
  || stoppedEvidence?.interruption?.stage !== "operator_stop"
  || stoppedEvidence?.interruption?.authorityRevoked !== true
  || stoppedEvidence?.interruption?.actionAuthority !== "suspended"
  || stoppedEvidence?.recommendation?.strategy !== "restore_trusted_work_view_then_recover_task") {
  throw new Error(`operator stop should expose authority recovery evidence: ${JSON.stringify(stopped)}`);
}
if (!stoppedRecovered.ok
  || stoppedRecovered.task?.recovery?.recoveredFromTaskId !== stopped.task?.id
  || stoppedRecoveredEvidence?.kind !== "work-view-authority-recovery-evidence"
  || stoppedRecoveredEvidence?.sourceTaskId !== stopped.task?.id
  || stoppedRecoveredEvidence?.interruption?.stage !== "operator_stop"
  || stoppedRecoveredEvidence?.recommendation?.strategy !== "restore_trusted_work_view_then_recover_task"
  || (stopSessionId && JSON.stringify(stoppedRecoveredEvidence).includes(stopSessionId))) {
  throw new Error(`recovered operator stop should retain compact provenance without the session lease: ${JSON.stringify(stoppedRecovered)}`);
}

console.log(JSON.stringify({
  observerRecoveryEvidence: {
    failedTaskId: failedExecution.task?.id ?? null,
    recoveredTaskId: recovered.task?.id ?? null,
    observedUrl: latestEvidence?.observedUrl ?? null,
    recommendation: latestEvidence?.recommendation ?? null,
  },
  operatorStopRecovery: {
    stoppedTaskId: stopped.task?.id ?? null,
    recoveredTaskId: stoppedRecovered.task?.id ?? null,
    stage: stoppedEvidence.interruption.stage,
    recommendation: stoppedRecoveredEvidence.recommendation,
  },
}, null, 2));
EOF
