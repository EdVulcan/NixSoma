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
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local body="$2"
  curl --silent -X POST "$url" -H 'content-type: application/json' -d "$body"
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

node - <<'EOF' "$failed_execution" "$latest_failed" "$recovered" "$TARGET_URL" "$INPUT_TEXT"
const failedExecution = JSON.parse(process.argv[2]);
const latestFailed = JSON.parse(process.argv[3]);
const recovered = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const inputText = process.argv[6];

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
  if (!evidence?.actionEvidence?.observedAfterActions?.visibleTextBlocks?.includes(inputText)) {
    throw new Error(`${label} should retain observed text context: ${JSON.stringify(evidence?.actionEvidence?.observedAfterActions)}`);
  }
}

console.log(JSON.stringify({
  observerRecoveryEvidence: {
    failedTaskId: failedExecution.task?.id ?? null,
    recoveredTaskId: recovered.task?.id ?? null,
    observedUrl: latestEvidence?.observedUrl ?? null,
    recommendation: latestEvidence?.recommendation ?? null,
  },
}, null, 2));
EOF
