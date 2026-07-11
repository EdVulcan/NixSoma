#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/observer-eye-hand-auto-recovery-execution"
INITIAL_EXPECTED_URL="https://expected.invalid/observer-eye-hand-auto-recovery-initial"
STALE_RECOVERY_EXPECTED_URL="https://expected.invalid/observer-eye-hand-auto-recovery-stale"
INPUT_TEXT="observer sees auto recovery evidence execution"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5810}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5811}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5812}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5813}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5814}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5815}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5816}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5817}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5880}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-eye-hand-auto-recovery-execution-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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


"$SCRIPT_DIR/dev-up.sh"

CLIENT_FILE="$(mktemp)"
curl --silent "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$CLIENT_FILE"
const fs = require("node:fs");
const client = fs.readFileSync(process.argv[2], "utf8");
const requiredClient = [
  "Recovery Evidence:",
  "Recovery Recommendation",
  "Action Evidence:",
  "Verification Work View Summary",
];
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Observer auto recover from eye-hand evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"expectedUrl\":\"$INITIAL_EXPECTED_URL\",\"recoveryExpectedUrl\":\"$STALE_RECOVERY_EXPECTED_URL\",\"autoRecover\":true,\"maxRecoveryAttempts\":1,\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":770,\"y\":470,\"button\":\"left\"}}]}")"
latest_finished="$(curl --silent "$CORE_URL/tasks/focus/latest-finished")"
latest_failed="$(curl --silent "$CORE_URL/tasks/focus/latest-failed")"

node - <<'EOF' "$execution" "$latest_finished" "$latest_failed" "$TARGET_URL" "$INPUT_TEXT"
const execution = JSON.parse(process.argv[2]);
const latestFinished = JSON.parse(process.argv[3]);
const latestFailed = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const inputText = process.argv[6];

if (execution.execution?.recovery?.usedRecommendationTargetUrl !== targetUrl) {
  throw new Error(`Observer-facing execution should expose evidence-driven recovery URL: ${JSON.stringify(execution.execution?.recovery)}`);
}
if (latestFinished.task?.id !== execution.task?.id || latestFinished.task?.status !== "completed") {
  throw new Error(`Observer latest finished should track recovered task: ${JSON.stringify(latestFinished.task)}`);
}
const failedEvidence = latestFailed.task?.outcome?.details?.recoveryEvidence;
if (failedEvidence?.observedUrl !== targetUrl || failedEvidence?.recommendation?.targetUrl !== targetUrl) {
  throw new Error(`Observer latest failed should expose recovery evidence: ${JSON.stringify(failedEvidence)}`);
}
const inputEvidence = failedEvidence?.actionEvidence?.actions?.find((action) => action.kind === "keyboard.type")?.params?.inputEvidence;
if (inputEvidence?.charCount !== inputText.length
  || inputEvidence.textExposed !== false
  || JSON.stringify(failedEvidence).includes(inputText)) {
  throw new Error(`Observer latest failed evidence should retain redacted input: ${JSON.stringify(failedEvidence)}`);
}
if (execution.execution?.verification?.expectedUrl !== targetUrl) {
  throw new Error(`Observer final verification should use recommendation target URL: ${JSON.stringify(execution.execution?.verification)}`);
}

console.log(JSON.stringify({
  observerAutoRecoveryExecution: {
    finalTaskId: execution.task?.id ?? null,
    failedTaskId: latestFailed.task?.id ?? null,
    usedRecommendationTargetUrl: execution.execution?.recovery?.usedRecommendationTargetUrl ?? null,
    finalStatus: latestFinished.task?.status ?? null,
    failedEvidenceObservedUrl: failedEvidence?.observedUrl ?? null,
  },
}, null, 2));
EOF
