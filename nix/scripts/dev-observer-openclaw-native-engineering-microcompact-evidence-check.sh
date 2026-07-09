#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-microcompact-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PROMPT_SECRET="OBSERVER_ENGINEERING_MICROCOMPACT_EVIDENCE_PROMPT_SECRET_DO_NOT_LEAK"
TOOL_SECRET="OBSERVER_ENGINEERING_MICROCOMPACT_EVIDENCE_TOOL_SECRET_DO_NOT_LEAK"

source "$SCRIPT_DIR/openclaw-engineering-verification-evidence-fixture.sh"
source "$SCRIPT_DIR/openclaw-engineering-microcompact-evidence-fixture.sh"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10160}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10161}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10162}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10163}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10164}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10165}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10166}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10167}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10168}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_COMMAND_ALLOWLIST="npm"
export OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS="15000"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-microcompact-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-microcompact-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
prepare_engineering_microcompact_evidence_fixture "$WORKSPACE_DIR" "$PROMPT_SECRET" "$TOOL_SECRET"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
    "${MICROCOMPACT_FILE:-}"
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
MICROCOMPACT_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" '{"proposalId":"openclaw:typecheck","query":"verify","confirm":true}' > "$TASK_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_FILE"

read -r approval_id task_id < <(node - <<'EOF' "$TASK_FILE" "$BLOCKED_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

if (!taskResponse.ok || taskResponse.registry !== "openclaw-source-command-task-v0" || taskResponse.task?.status !== "queued") {
  throw new Error(`observer microcompact task should be queued behind approval: ${JSON.stringify(taskResponse)}`);
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error(`operator should block before observer microcompact approval: ${JSON.stringify(blocked)}`);
}
process.stdout.write(`${blocked.approval.id} ${taskResponse.task.id}\n`);
EOF
)

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-observer-openclaw-native-engineering-microcompact-evidence-check","reason":"approve observer microcompact evidence large-output fixture command"}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/engineering-microcompact/evidence?limit=8&thresholdChars=256&protectRecentItems=0" > "$MICROCOMPACT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASK_FILE" "$STEP_FILE" "$MICROCOMPACT_FILE" "$PROMPT_SECRET" "$TOOL_SECRET"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const taskResponse = readJson(4);
const step = readJson(5);
const microcompact = readJson(6);
const promptSecret = process.argv[7];
const toolSecret = process.argv[8];
const rawEndpoint = JSON.stringify({ microcompact });

for (const token of [
  "Engineering Microcompact Evidence",
  "engineering-microcompact-registry",
  "engineering-microcompact-items",
  "engineering-microcompact-compactable",
  "engineering-microcompact-reclaimed",
  "engineering-microcompact-mutation",
  "engineering-microcompact-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering microcompact token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-microcompact/evidence",
  "refreshEngineeringMicrocompactEvidence",
  "renderEngineeringMicrocompactEvidence",
  "Native engineering microcompact evidence",
  "sense.openclaw.engineering_context.microcompact_evidence",
  "context-management-evidence-only",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering microcompact token: ${token}`);
  }
}
if (!step.ok || step.ran !== true || step.task?.status !== "completed") {
  throw new Error(`observer microcompact fixture should complete after approval: ${JSON.stringify(step)}`);
}
if (
  !microcompact.ok
  || microcompact.registry !== "openclaw-native-engineering-microcompact-evidence-v0"
  || microcompact.summary?.compactableItems < 1
  || microcompact.summary?.reclaimedChars <= 0
  || microcompact.governance?.canMutatePersistedLogs !== false
  || microcompact.bounds?.noRawOutputText !== true
) {
  throw new Error(`Observer microcompact evidence mismatch: ${JSON.stringify(microcompact)}`);
}
const candidate = microcompact.candidates?.find((item) => item.taskId === taskResponse.task?.id);
if (
  !candidate
  || candidate.output?.rawTextReturned !== false
  || candidate.output?.sourceTextExposed !== false
  || candidate.microcompactPreview?.compactable !== true
) {
  throw new Error(`Observer microcompact candidate mismatch: ${JSON.stringify(candidate)}`);
}
if (rawEndpoint.includes("MMMMMMMMMMMMMMMMMMMM") || rawEndpoint.includes(promptSecret) || rawEndpoint.includes(toolSecret)) {
  throw new Error("Observer microcompact evidence leaked raw output or fixture secrets");
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringMicrocompactEvidence: {
    html: "visible",
    client: "visible",
    registry: microcompact.registry,
    compactable: microcompact.summary.compactableItems,
    reclaimedChars: microcompact.summary.reclaimedChars,
  },
}, null, 2));
EOF
