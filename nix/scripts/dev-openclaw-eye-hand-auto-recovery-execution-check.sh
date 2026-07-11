#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-eye-hand-auto-recovery-execution"
INITIAL_EXPECTED_URL="https://expected.invalid/openclaw-eye-hand-auto-recovery-initial"
STALE_RECOVERY_EXPECTED_URL="https://expected.invalid/openclaw-eye-hand-auto-recovery-stale"
INPUT_TEXT="auto recovery follows eye hand evidence"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5800}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5801}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5802}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5803}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5804}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5805}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5806}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5807}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5870}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-eye-hand-auto-recovery-execution-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Auto recover from eye-hand evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"expectedUrl\":\"$INITIAL_EXPECTED_URL\",\"recoveryExpectedUrl\":\"$STALE_RECOVERY_EXPECTED_URL\",\"autoRecover\":true,\"maxRecoveryAttempts\":1,\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":760,\"y\":460,\"button\":\"left\"}}]}")"
latest_finished="$(curl --silent "$CORE_URL/tasks/focus/latest-finished")"

node - <<'EOF' "$execution" "$latest_finished" "$TARGET_URL" "$INITIAL_EXPECTED_URL" "$STALE_RECOVERY_EXPECTED_URL" "$INPUT_TEXT"
const execution = JSON.parse(process.argv[2]);
const latestFinished = JSON.parse(process.argv[3]);
const targetUrl = process.argv[4];
const initialExpectedUrl = process.argv[5];
const staleRecoveryExpectedUrl = process.argv[6];
const inputText = process.argv[7];

if (!execution.ok || execution.task?.status !== "completed") {
  throw new Error(`auto recovery execution should complete: ${JSON.stringify(execution)}`);
}
if (execution.execution?.executor !== "core-v3" || execution.execution?.recovery?.succeeded !== true) {
  throw new Error(`auto recovery should run through core-v3 and succeed: ${JSON.stringify(execution.execution?.recovery)}`);
}
if (execution.execution?.recovery?.usedRecommendationTargetUrl !== targetUrl) {
  throw new Error(`auto recovery should use recommendation target URL: ${JSON.stringify(execution.execution?.recovery)}`);
}

const attempts = execution.execution?.attempts ?? [];
if (attempts.length !== 2 || attempts[0]?.status !== "failed" || attempts[1]?.status !== "completed") {
  throw new Error(`expected failed then completed attempts: ${JSON.stringify(attempts)}`);
}
if (!attempts[0]?.failedChecks?.includes("target_url")) {
  throw new Error(`first attempt should fail target_url: ${JSON.stringify(attempts[0])}`);
}
if (attempts[1]?.workViewSummaryUrl !== targetUrl) {
  throw new Error(`recovered attempt should observe target URL: ${JSON.stringify(attempts[1])}`);
}

const recoveryEvidence = execution.execution?.attempts?.length
  ? null
  : null;
const finalVerification = execution.execution?.verification;
if (finalVerification?.expectedUrl !== targetUrl || finalVerification?.activeUrl !== targetUrl) {
  throw new Error(`final verification should use evidence target, not stale recoveryExpectedUrl ${staleRecoveryExpectedUrl}: ${JSON.stringify(finalVerification)}`);
}
if (finalVerification.expectedUrl === staleRecoveryExpectedUrl || finalVerification.expectedUrl === initialExpectedUrl) {
  throw new Error("final verification should not use stale expected URLs.");
}
const finalInputEvidence = execution.execution?.actionEvidence?.actions?.find((action) => action.kind === "keyboard.type")?.params?.inputEvidence;
if (finalInputEvidence?.charCount !== inputText.length
  || finalInputEvidence.textExposed !== false
  || JSON.stringify(execution.execution?.actionEvidence).includes(inputText)) {
  throw new Error(`final action evidence should retain redacted input evidence: ${JSON.stringify(execution.execution?.actionEvidence)}`);
}
if (latestFinished.task?.id !== execution.task?.id || latestFinished.task?.status !== "completed") {
  throw new Error(`latest finished should be recovered completed task: ${JSON.stringify(latestFinished.task)}`);
}

console.log(JSON.stringify({
  finalTaskId: execution.task?.id ?? null,
  recovery: execution.execution?.recovery ?? null,
  attempts,
  finalVerification: {
    expectedUrl: finalVerification?.expectedUrl ?? null,
    activeUrl: finalVerification?.activeUrl ?? null,
  },
}, null, 2));
EOF
