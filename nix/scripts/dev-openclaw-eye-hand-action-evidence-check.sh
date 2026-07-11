#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-eye-hand-action-evidence"
INPUT_TEXT="eye hand evidence records what happened"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5760}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5761}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5762}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5763}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5764}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5765}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5766}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5767}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5830}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-eye-hand-action-evidence-check.json}"

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

execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Record eye-hand action evidence for $TARGET_URL\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"$INPUT_TEXT\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":700,\"y\":420,\"button\":\"left\"}}]}")"
task_id="$(node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="completed"){throw new Error(`eye-hand task did not complete: ${JSON.stringify(data)}`);} process.stdout.write(data.task.id);' "$execution")"
task_detail="$(curl --silent "$CORE_URL/tasks/$task_id")"

node - <<'EOF' "$execution" "$task_detail" "$TARGET_URL" "$INPUT_TEXT"
const execution = JSON.parse(process.argv[2]);
const taskDetail = JSON.parse(process.argv[3]);
const targetUrl = process.argv[4];
const inputText = process.argv[5];

const evidence = execution.execution?.actionEvidence;
const verificationEvidence = execution.execution?.verification?.actionEvidence;
const taskEvidence = taskDetail.task?.outcome?.details?.actionEvidence;

for (const [label, item] of [
  ["execution", evidence],
  ["verification", verificationEvidence],
  ["task", taskEvidence],
]) {
  if (item?.kind !== "eye-hand-action-evidence") {
    throw new Error(`${label} should expose eye-hand action evidence: ${JSON.stringify(item)}`);
  }
  if (item.actionCount !== 2 || item.degradedCount !== 0) {
    throw new Error(`${label} should record two non-degraded actions: ${JSON.stringify(item)}`);
  }
  if (item.observedAfterActions?.url !== targetUrl) {
    throw new Error(`${label} should link actions to final observed work view URL: ${JSON.stringify(item.observedAfterActions)}`);
  }
  const inputEvidence = item.actions?.find((action) => action.kind === "keyboard.type")?.params?.inputEvidence;
  if (inputEvidence?.registry !== "openclaw-write-only-input-evidence-v0"
    || inputEvidence.charCount !== inputText.length
    || inputEvidence.textExposed !== false
    || JSON.stringify(item).includes(inputText)) {
    throw new Error(`${label} should retain redacted input evidence: ${JSON.stringify(item)}`);
  }
}

const kinds = evidence.actions.map((action) => action.kind);
if (kinds.join(",") !== "keyboard.type,mouse.click") {
  throw new Error(`expected keyboard then mouse action evidence: ${JSON.stringify(kinds)}`);
}
if ("text" in (evidence.actions[0]?.params ?? {}) || evidence.actions[1]?.params?.x !== 700) {
  throw new Error(`action evidence should retain only bounded action params: ${JSON.stringify(evidence.actions)}`);
}
if (!evidence.actions.every((action) => action.screenContext?.readiness === "ready")) {
  throw new Error(`action evidence should retain ready screen context: ${JSON.stringify(evidence.actions)}`);
}

console.log(JSON.stringify({
  taskId: execution.task?.id ?? taskDetail.task?.id ?? null,
  actionEvidence: {
    kind: evidence.kind,
    actionCount: evidence.actionCount,
    degradedCount: evidence.degradedCount,
    kinds,
    observedUrl: evidence.observedAfterActions?.url ?? null,
  },
}, null, 2));
EOF
