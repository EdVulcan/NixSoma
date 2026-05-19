#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/observer-ai-work-view-task-verification-summary"
INPUT_TEXT="observer sees task verification work view summary"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5750}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5751}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5752}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5753}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5754}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5755}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5756}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5757}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5820}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-ai-work-view-task-verification-summary-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local body="$2"
  curl --silent -X POST "$url" -H 'content-type: application/json' -d "$body"
}

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$CLIENT_FILE"
const fs = require("node:fs");
const client = fs.readFileSync(process.argv[2], "utf8");
const requiredClient = [
  "taskWorkViewSummary",
  "Verification Work View Summary",
  "Verification Visible Text",
];
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Observer verifies task work view summary for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}}]}")"
task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="completed"){throw new Error(`observer summary task did not complete: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$execution")"
task_detail="$(curl --silent "$CORE_URL/tasks/$task_id")"
latest_finished="$(curl --silent "$CORE_URL/tasks/focus/latest-finished")"

node - <<'EOF' "$execution" "$task_detail" "$latest_finished" "$TARGET_URL" "$INPUT_TEXT"
const execution = JSON.parse(process.argv[2]);
const taskDetail = JSON.parse(process.argv[3]);
const latestFinished = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const inputText = process.argv[6];

const executionSummary = execution.execution?.workViewSummary;
const taskSummary = taskDetail.task?.outcome?.details?.workViewSummary;
const latestSummary = latestFinished.task?.outcome?.details?.workViewSummary;

for (const [label, summary] of [
  ["execution", executionSummary],
  ["task detail", taskSummary],
  ["latest finished", latestSummary],
]) {
  if (summary?.url !== targetUrl || !summary?.visibleTextBlocks?.includes(inputText)) {
    throw new Error(`${label} should expose observer-visible verification work view summary: ${JSON.stringify(summary)}`);
  }
}

console.log(JSON.stringify({
  observerTaskVerificationSummary: {
    taskId: taskDetail.task?.id ?? null,
    latestFinishedId: latestFinished.task?.id ?? null,
    summaryUrl: latestSummary?.url ?? null,
    visibleTextBlocks: latestSummary?.visibleTextBlocks ?? [],
  },
}, null, 2));
EOF
