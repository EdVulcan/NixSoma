#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/direct-actuator-grant-fixture"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10100}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10101}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10102}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10103}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10104}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10105}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10106}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10107}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10170}"
export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-direct-actuator-grant-check}"
export OPENCLAW_DEV_STATE_FILE="${OPENCLAW_DEV_STATE_FILE:-$REPO_ROOT/.artifacts/dev-services-unix-$OPENCLAW_DEV_RUN_ID.tsv}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-$OPENCLAW_DEV_RUN_ID.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-$OPENCLAW_DEV_RUN_ID-events.jsonl}"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="${OPENCLAW_SYSTEM_ALLOWED_ROOTS:-$FIXTURE_DIR}"
export OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE="${OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE:-$REPO_ROOT/.artifacts/openclaw-execution-grant-$OPENCLAW_DEV_RUN_ID-private.pem}"
export OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE="${OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE:-$REPO_ROOT/.artifacts/openclaw-execution-grant-$OPENCLAW_DEV_RUN_ID-public.pem}"

cd "$REPO_ROOT"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_SENSE_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"

rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"

cleanup() {
  rm -f \
    "${UNSIGNED_SYSTEM_FILE:-}" \
    "${UNSIGNED_SCREEN_FILE:-}" \
    "${CROSS_AUDIENCE_FILE:-}" \
    "${REPLAY_FIRST_FILE:-}" \
    "${REPLAY_SECOND_FILE:-}" \
    "${TAMPER_FILE:-}" \
    "${TAMPER_CORRECT_FILE:-}" \
    "${CORE_PLAN_FILE:-}" \
    "${CORE_BLOCKED_FILE:-}" \
    "${CORE_APPROVED_FILE:-}" \
    "${CORE_EXECUTION_FILE:-}"
  rm -rf "$FIXTURE_DIR"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

json_write_body() {
  node -e '
    console.log(JSON.stringify({
      path: process.argv[1],
      content: process.argv[2],
      overwrite: false,
      intent: "filesystem.write",
    }));
  ' "$1" "$2"
}

issue_grant() {
  node --input-type=module - \
    "$OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE" \
    "$1" \
    "$2" \
    "$3" \
    "${4:-}" \
    "${5:-}" \
    "${6:-}" \
    "${7:-}" <<'NODE'
import { createExecutionGrantSigner } from "./packages/shared-utils/src/execution-grants.mjs";

const [privateKeyFilePath, audience, path, bodyJson, taskId, stepId, capabilityId, intent] = process.argv.slice(2);
const signer = createExecutionGrantSigner({ privateKeyFilePath, required: true });
process.stdout.write(signer.issue({
  audience,
  method: "POST",
  path,
  body: JSON.parse(bodyJson),
  context: { taskId, stepId, capabilityId, intent },
}));
NODE
}

expect_direct_status() {
  local url="$1"
  local body="$2"
  local expected_status="$3"
  local output="$4"
  local token="${5:-}"
  local task_id="${6:-}"
  local step_id="${7:-}"
  local capability_id="${8:-}"
  local intent="${9:-}"
  local status
  local headers=(-H 'content-type: application/json')
  [[ -n "$token" ]] && headers+=(-H "x-openclaw-execution-grant: $token")
  [[ -n "$task_id" ]] && headers+=(-H "x-openclaw-task-id: $task_id")
  [[ -n "$step_id" ]] && headers+=(-H "x-openclaw-step-id: $step_id")
  [[ -n "$capability_id" ]] && headers+=(-H "x-openclaw-capability-id: $capability_id")
  [[ -n "$intent" ]] && headers+=(-H "x-openclaw-intent: $intent")
  status="$(command curl --silent --output "$output" --write-out '%{http_code}' \
    -X POST "${headers[@]}" -d "$body" "$url")"
  if [[ "$status" != "$expected_status" ]]; then
    echo "Expected HTTP $expected_status from $url, got $status." >&2
    cat "$output" >&2
    exit 1
  fi
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
"$SCRIPT_DIR/dev-up.sh"

UNSIGNED_SYSTEM_FILE="$(mktemp)"
UNSIGNED_SCREEN_FILE="$(mktemp)"
CROSS_AUDIENCE_FILE="$(mktemp)"
REPLAY_FIRST_FILE="$(mktemp)"
REPLAY_SECOND_FILE="$(mktemp)"
TAMPER_FILE="$(mktemp)"
TAMPER_CORRECT_FILE="$(mktemp)"
CORE_PLAN_FILE="$(mktemp)"
CORE_BLOCKED_FILE="$(mktemp)"
CORE_APPROVED_FILE="$(mktemp)"
CORE_EXECUTION_FILE="$(mktemp)"

UNSIGNED_SYSTEM_PATH="$FIXTURE_DIR/unsigned-system.txt"
UNSIGNED_SYSTEM_BODY="$(json_write_body "$UNSIGNED_SYSTEM_PATH" "unsigned must not write")"
expect_direct_status \
  "$SYSTEM_SENSE_URL/system/files/write-text" \
  "$UNSIGNED_SYSTEM_BODY" \
  401 \
  "$UNSIGNED_SYSTEM_FILE"

UNSIGNED_SCREEN_BODY='{"keys":["CTRL","L"]}'
expect_direct_status \
  "$SCREEN_ACT_URL/act/keyboard/hotkey" \
  "$UNSIGNED_SCREEN_BODY" \
  401 \
  "$UNSIGNED_SCREEN_FILE"

CROSS_AUDIENCE_TOKEN="$(issue_grant \
  openclaw-system-sense \
  /act/keyboard/hotkey \
  "$UNSIGNED_SCREEN_BODY" \
  direct-attack-task \
  direct-attack-step \
  act.screen.keyboard.hotkey \
  keyboard.hotkey)"
expect_direct_status \
  "$SCREEN_ACT_URL/act/keyboard/hotkey" \
  "$UNSIGNED_SCREEN_BODY" \
  403 \
  "$CROSS_AUDIENCE_FILE" \
  "$CROSS_AUDIENCE_TOKEN" \
  direct-attack-task \
  direct-attack-step \
  act.screen.keyboard.hotkey \
  keyboard.hotkey

REPLAY_PATH="$FIXTURE_DIR/replay.txt"
REPLAY_BODY="$(json_write_body "$REPLAY_PATH" "first grant use")"
REPLAY_TOKEN="$(issue_grant \
  openclaw-system-sense \
  /system/files/write-text \
  "$REPLAY_BODY" \
  replay-task \
  replay-step \
  act.filesystem.write_text \
  filesystem.write)"
expect_direct_status \
  "$SYSTEM_SENSE_URL/system/files/write-text" \
  "$REPLAY_BODY" \
  200 \
  "$REPLAY_FIRST_FILE" \
  "$REPLAY_TOKEN" \
  replay-task \
  replay-step \
  act.filesystem.write_text \
  filesystem.write
expect_direct_status \
  "$SYSTEM_SENSE_URL/system/files/write-text" \
  "$REPLAY_BODY" \
  403 \
  "$REPLAY_SECOND_FILE" \
  "$REPLAY_TOKEN" \
  replay-task \
  replay-step \
  act.filesystem.write_text \
  filesystem.write

TAMPER_PATH="$FIXTURE_DIR/tamper.txt"
TAMPER_BODY="$(json_write_body "$TAMPER_PATH" "bound target")"
TAMPER_OTHER_PATH="$FIXTURE_DIR/tamper-other.txt"
TAMPER_OTHER_BODY="$(json_write_body "$TAMPER_OTHER_PATH" "tampered target")"
TAMPER_TOKEN="$(issue_grant \
  openclaw-system-sense \
  /system/files/write-text \
  "$TAMPER_BODY" \
  tamper-task \
  tamper-step \
  act.filesystem.write_text \
  filesystem.write)"
expect_direct_status \
  "$SYSTEM_SENSE_URL/system/files/write-text" \
  "$TAMPER_OTHER_BODY" \
  403 \
  "$TAMPER_FILE" \
  "$TAMPER_TOKEN" \
  tamper-task \
  tamper-step \
  act.filesystem.write_text \
  filesystem.write
expect_direct_status \
  "$SYSTEM_SENSE_URL/system/files/write-text" \
  "$TAMPER_BODY" \
  200 \
  "$TAMPER_CORRECT_FILE" \
  "$TAMPER_TOKEN" \
  tamper-task \
  tamper-step \
  act.filesystem.write_text \
  filesystem.write

CORE_PATH="$FIXTURE_DIR/core-approved.txt"
CORE_CONTENT="Core-issued grant completed this mutation."
CORE_PARAMS="$(node -e 'console.log(JSON.stringify({path:process.argv[1],content:process.argv[2],overwrite:false}))' "$CORE_PATH" "$CORE_CONTENT")"
CORE_ACTION="$(node -e 'console.log(JSON.stringify([{kind:"filesystem.write_text",intent:"filesystem.write",params:JSON.parse(process.argv[1])}]))' "$CORE_PARAMS")"
CORE_PLAN_BODY="$(node -e 'console.log(JSON.stringify({goal:"Approved Core actuator grant write",type:"system_task",actions:JSON.parse(process.argv[1])}))' "$CORE_ACTION")"
post_json "$CORE_URL/tasks/plan" "$CORE_PLAN_BODY" > "$CORE_PLAN_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$CORE_BLOCKED_FILE"

approval_id="$(node -e '
  const fs = require("node:fs");
  const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const approvalId = response.approval?.id ?? response.task?.approval?.requestId;
  if (!response.ok || !approvalId) throw new Error(`planned task lacks approval: ${JSON.stringify(response)}`);
  process.stdout.write(approvalId);
' "$CORE_BLOCKED_FILE")"

node -e '
  const fs = require("node:fs");
  const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!response.ok || response.ran !== false || response.blocked !== true || response.reason !== "policy_requires_approval") {
    throw new Error(`Core actuator should stop before approval: ${JSON.stringify(response)}`);
  }
' "$CORE_BLOCKED_FILE"

post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"direct-actuator-grant-check","reason":"Approve bounded fixture write."}' > "$CORE_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$CORE_EXECUTION_FILE"

node - <<'NODE' \
  "$UNSIGNED_SYSTEM_FILE" \
  "$UNSIGNED_SCREEN_FILE" \
  "$CROSS_AUDIENCE_FILE" \
  "$REPLAY_FIRST_FILE" \
  "$REPLAY_SECOND_FILE" \
  "$TAMPER_FILE" \
  "$TAMPER_CORRECT_FILE" \
  "$CORE_PLAN_FILE" \
  "$CORE_APPROVED_FILE" \
  "$CORE_EXECUTION_FILE" \
  "$UNSIGNED_SYSTEM_PATH" \
  "$REPLAY_PATH" \
  "$TAMPER_PATH" \
  "$TAMPER_OTHER_PATH" \
  "$CORE_PATH" \
  "$CORE_CONTENT"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const readText = (path) => fs.readFileSync(path, "utf8");
const unsignedSystem = readJson(2);
const unsignedScreen = readJson(3);
const crossAudience = readJson(4);
const replayFirst = readJson(5);
const replaySecond = readJson(6);
const tamper = readJson(7);
const tamperCorrect = readJson(8);
const corePlan = readJson(9);
const coreApproved = readJson(10);
const coreExecution = readJson(11);
const unsignedSystemPath = process.argv[12];
const replayPath = process.argv[13];
const tamperPath = process.argv[14];
const tamperOtherPath = process.argv[15];
const corePath = process.argv[16];
const coreContent = process.argv[17];

if (unsignedSystem.code !== "EXECUTION_GRANT_REQUIRED" || fs.existsSync(unsignedSystemPath)) {
  throw new Error(`unsigned system actuator was not rejected as expected: ${JSON.stringify(unsignedSystem)}`);
}
if (unsignedScreen.code !== "EXECUTION_GRANT_REQUIRED") {
  throw new Error(`unsigned screen actuator was not rejected as expected: ${JSON.stringify(unsignedScreen)}`);
}
if (crossAudience.code !== "EXECUTION_GRANT_AUDIENCE_INVALID") {
  throw new Error(`cross-audience grant was not rejected: ${JSON.stringify(crossAudience)}`);
}
if (replayFirst.ok !== true || replaySecond.code !== "EXECUTION_GRANT_REPLAYED") {
  throw new Error(`grant replay contract failed: ${JSON.stringify({ replayFirst, replaySecond })}`);
}
if (readText(replayPath) !== "first grant use") {
  throw new Error("grant replay changed the file after the first use");
}
if (tamper.code !== "EXECUTION_GRANT_TARGET_MISMATCH" || fs.existsSync(tamperOtherPath)) {
  throw new Error(`tampered grant reached a different target: ${JSON.stringify(tamper)}`);
}
if (tamperCorrect.ok !== true || readText(tamperPath) !== "bound target") {
  throw new Error(`bound target could not use an unconsumed grant: ${JSON.stringify(tamperCorrect)}`);
}
if (
  !corePlan.ok
  || coreApproved.approval?.status !== "approved"
  || coreExecution.ran !== true
  || coreExecution.blocked === true
  || coreExecution.task?.status !== "completed"
  || coreExecution.execution?.executor !== "capability-invoke-v1"
  || coreExecution.execution?.capabilityInvocations?.[0]?.capabilityId !== "act.filesystem.write_text"
  || coreExecution.execution?.capabilityInvocations?.[0]?.invoked !== true
  || readText(corePath) !== coreContent
) {
  throw new Error(`Core-issued grant path did not complete the bounded write: ${JSON.stringify(coreExecution)}`);
}

console.log(JSON.stringify({
  directActuatorGrant: {
    unsignedSystem: unsignedSystem.code,
    unsignedScreen: unsignedScreen.code,
    crossAudience: crossAudience.code,
    replay: replaySecond.code,
    targetMismatch: tamper.code,
  },
  corePath: {
    taskId: coreExecution.task?.id ?? null,
    status: coreExecution.task?.status ?? null,
    executor: coreExecution.execution?.executor ?? null,
    capability: coreExecution.execution?.capabilityInvocations?.[0]?.capabilityId ?? null,
    fileWritten: true,
  },
}, null, 2));
NODE
