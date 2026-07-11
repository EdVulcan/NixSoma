#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-eye-hand-recovery-evidence"
EXPECTED_URL="https://expected.invalid/openclaw-eye-hand-recovery-evidence"
INPUT_TEXT="recovery evidence remembers eye hand context"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5780}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5781}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5782}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5783}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5784}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5785}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5786}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5787}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5850}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-eye-hand-recovery-evidence-check.json}"

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

failed_execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Fail with recoverable eye-hand evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"expectedUrl\":\"$EXPECTED_URL\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":730,\"y\":440,\"button\":\"left\"}}]}")"
failed_task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="failed"){throw new Error(`expected failed task: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$failed_execution")"
latest_failed="$(curl --silent "$CORE_URL/tasks/latest-failed")"
recovered="$(post_json "$CORE_URL/tasks/$failed_task_id/recover" '{}')"

node - <<'EOF' "$failed_execution" "$latest_failed" "$recovered" "$TARGET_URL" "$EXPECTED_URL" "$INPUT_TEXT"
const failedExecution = JSON.parse(process.argv[2]);
const latestFailed = JSON.parse(process.argv[3]);
const recovered = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const expectedUrl = process.argv[6];
const inputText = process.argv[7];

const recoveryEvidence = failedExecution.task?.outcome?.details?.recoveryEvidence;
const latestRecoveryEvidence = latestFailed.task?.outcome?.details?.recoveryEvidence;
const recoveredEvidence = recovered.task?.recovery?.recoveryEvidence;

for (const [label, evidence] of [
  ["failed response", recoveryEvidence],
  ["latest failed", latestRecoveryEvidence],
  ["recovered task", recoveredEvidence],
]) {
  if (evidence?.kind !== "eye-hand-recovery-evidence") {
    throw new Error(`${label} should expose eye-hand recovery evidence: ${JSON.stringify(evidence)}`);
  }
  if (evidence.observedUrl !== targetUrl || evidence.recommendation?.targetUrl !== targetUrl) {
    throw new Error(`${label} should recommend retrying the observed work view URL: ${JSON.stringify(evidence)}`);
  }
  const inputEvidence = evidence.actionEvidence?.actions?.find((action) => action.kind === "keyboard.type")?.params?.inputEvidence;
  if (inputEvidence?.charCount !== inputText.length
    || inputEvidence.textExposed !== false
    || JSON.stringify(evidence).includes(inputText)) {
    throw new Error(`${label} should retain redacted input evidence: ${JSON.stringify(evidence)}`);
  }
  if (!evidence.failedChecks?.some((check) => check.name === "target_url" && check.expected === expectedUrl && check.actual === targetUrl)) {
    throw new Error(`${label} should retain target_url failure check: ${JSON.stringify(evidence.failedChecks)}`);
  }
}

if (recovered.task?.recovery?.recoveredFromTaskId !== failedExecution.task?.id) {
  throw new Error("recovered task should point back to failed source task.");
}

console.log(JSON.stringify({
  failedTaskId: failedExecution.task?.id ?? null,
  recoveredTaskId: recovered.task?.id ?? null,
  recoveryEvidence: {
    kind: recoveryEvidence.kind,
    reason: recoveryEvidence.reason,
    observedUrl: recoveryEvidence.observedUrl,
    recommendation: recoveryEvidence.recommendation,
    failedChecks: recoveryEvidence.failedChecks,
  },
}, null, 2));
EOF
