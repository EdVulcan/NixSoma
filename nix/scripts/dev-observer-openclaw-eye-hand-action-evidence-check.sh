#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/observer-eye-hand-action-evidence"
INPUT_TEXT="observer sees eye hand action evidence"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5770}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5771}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5772}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5773}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5774}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5775}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5776}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5777}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5840}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-eye-hand-action-evidence-check.json}"

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
  "taskActionEvidence",
  "Action Evidence:",
  "Action Evidence Observed URL",
  "Action Evidence Kinds",
];
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Observer records eye-hand action evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":710,\"y\":430,\"button\":\"left\"}}]}")"
task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="completed"){throw new Error(`observer eye-hand task did not complete: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$execution")"
latest_finished="$(curl --silent "$CORE_URL/tasks/focus/latest-finished")"
task_detail="$(curl --silent "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$execution" "$latest_finished" "$task_detail" "$TARGET_URL" "$INPUT_TEXT"
const execution = JSON.parse(process.argv[2]);
const latestFinished = JSON.parse(process.argv[3]);
const taskDetail = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const inputText = process.argv[6];

const responseEvidence = execution.execution?.actionEvidence;
const latestEvidence = latestFinished.task?.outcome?.details?.actionEvidence;
const detailEvidence = taskDetail.task?.outcome?.details?.actionEvidence;

for (const [label, evidence] of [
  ["response", responseEvidence],
  ["latest finished", latestEvidence],
  ["task detail", detailEvidence],
]) {
  if (evidence?.actionCount !== 2 || evidence?.observedAfterActions?.url !== targetUrl) {
    throw new Error(`${label} should expose observer-visible action evidence: ${JSON.stringify(evidence)}`);
  }
  if (!evidence?.observedAfterActions?.visibleTextBlocks?.includes(inputText)) {
    throw new Error(`${label} should include observed text evidence: ${JSON.stringify(evidence?.observedAfterActions)}`);
  }
}

console.log(JSON.stringify({
  observerActionEvidence: {
    taskId: taskDetail.task?.id ?? execution.task?.id ?? null,
    actionCount: latestEvidence?.actionCount ?? null,
    degradedCount: latestEvidence?.degradedCount ?? null,
    observedUrl: latestEvidence?.observedAfterActions?.url ?? null,
    kinds: (latestEvidence?.actions ?? []).map((action) => action.kind),
  },
}, null, 2));
EOF
