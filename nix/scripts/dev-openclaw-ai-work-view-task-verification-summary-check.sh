#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-ai-work-view-task-verification-summary"
INPUT_TEXT="task verification records the work view summary"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5740}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5741}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5742}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5743}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5744}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5745}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5746}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5747}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5810}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-ai-work-view-task-verification-summary-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local body="$2"
  curl --silent -X POST "$url" -H 'content-type: application/json' -d "$body"
}

"$SCRIPT_DIR/dev-up.sh"

execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Verify AI work view summary evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":420,\"y\":240,\"button\":\"left\"}}]}")"

task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="completed"){throw new Error(`task execution did not complete: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$execution")"
task_detail="$(curl --silent "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$execution" "$task_detail" "$TARGET_URL" "$INPUT_TEXT"
const execution = JSON.parse(process.argv[2]);
const taskDetail = JSON.parse(process.argv[3]);
const targetUrl = process.argv[4];
const inputText = process.argv[5];

const verificationSummary = execution.execution?.verification?.workViewSummary;
const executionSummary = execution.execution?.workViewSummary;
const taskSummary = execution.task?.outcome?.details?.workViewSummary;
const persistedSummary = taskDetail.task?.outcome?.details?.workViewSummary;

for (const [label, summary] of [
  ["verification", verificationSummary],
  ["execution", executionSummary],
  ["task", taskSummary],
  ["persisted", persistedSummary],
]) {
  if (summary?.url !== targetUrl) {
    throw new Error(`${label} summary should expose target URL: ${JSON.stringify(summary)}`);
  }
  if (!summary?.visibleTextBlocks?.includes(inputText)) {
    throw new Error(`${label} summary should include observed input text: ${JSON.stringify(summary?.visibleTextBlocks)}`);
  }
}

if (execution.execution?.verification?.ok !== true) {
  throw new Error("verification should pass for summary task.");
}
if (!execution.execution?.observedTextBlocks?.includes(inputText)) {
  throw new Error(`execution should expose observed text blocks: ${JSON.stringify(execution.execution?.observedTextBlocks)}`);
}
if (taskDetail.task?.outcome?.details?.verifiedScreen?.workViewSummary?.url !== targetUrl) {
  throw new Error(`verifiedScreen details should retain work view summary: ${JSON.stringify(taskDetail.task?.outcome?.details?.verifiedScreen)}`);
}

console.log(JSON.stringify({
  taskId: execution.task?.id ?? null,
  verification: {
    ok: execution.execution?.verification?.ok ?? null,
    summaryUrl: verificationSummary?.url ?? null,
    observedTextBlocks: execution.execution?.observedTextBlocks ?? [],
  },
  taskOutcome: {
    summaryUrl: persistedSummary?.url ?? null,
    recentInput: persistedSummary?.recentInteraction?.input ?? null,
  },
}, null, 2));
EOF
