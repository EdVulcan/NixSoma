#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_ONE="https://www.baidu.com"
TARGET_TWO="https://www.deepseek.com"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5100}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5101}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5102}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5103}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5104}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5105}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5106}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5107}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5170}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-task-workbench-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"
STALE_AUTHORITY_FILE="$(mktemp)"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "$STALE_AUTHORITY_FILE"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

assert_json() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

json_value() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


launch_task_into_work_view() {
  local task_id="$1"
  local target_url="$2"

  post_json "$CORE_URL/tasks/$task_id/phase" "{\"phase\":\"preparing_work_view\",\"status\":\"running\",\"details\":{\"targetUrl\":\"$target_url\",\"displayTarget\":\"workspace-2\"}}" >/dev/null
  local prepare_result
  prepare_result="$(post_json "$SESSION_MANAGER_URL/work-view/prepare" "{\"displayTarget\":\"workspace-2\",\"entryUrl\":\"$target_url\"}")"
  assert_json "$prepare_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok){throw new Error("prepare failed");}'

  post_json "$CORE_URL/tasks/$task_id/phase" "{\"phase\":\"opening_target\",\"status\":\"running\",\"details\":{\"targetUrl\":\"$target_url\"}}" >/dev/null
  local reveal_result
  reveal_result="$(post_json "$SESSION_MANAGER_URL/work-view/reveal" "{\"entryUrl\":\"$target_url\"}")"
  assert_json "$reveal_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.workView?.visibility!=="visible"){throw new Error("reveal failed");}'

  local attach_body
  attach_body="$(node -e 'const data=JSON.parse(process.argv[1]); const payload={sessionId:data.session?.sessionId??null,status:data.workView?.status??"ready",visibility:data.workView?.visibility??"visible",mode:data.workView?.mode??"foreground-observable",helperStatus:data.workView?.helperStatus??"active",displayTarget:data.workView?.displayTarget??"workspace-2",activeUrl:data.workView?.activeUrl??data.browser?.activeUrl??data.tab?.url??null}; process.stdout.write(JSON.stringify(payload));' "$reveal_result")"
  local attach_result
  attach_result="$(post_json "$CORE_URL/tasks/$task_id/attach-work-view" "$attach_body")"
  assert_json "$attach_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.executionPhase!=="ready_for_action"){throw new Error("attach failed");}'
}

record_action_phase() {
  local task_id="$1"
  local kind="$2"
  post_json "$CORE_URL/tasks/$task_id/phase" "{\"phase\":\"acting_on_target\",\"status\":\"running\",\"details\":{\"actionKind\":\"$kind\",\"degraded\":false}}" >/dev/null
}

complete_task() {
  local task_id="$1"
  local target_url="$2"

  post_json "$SESSION_MANAGER_URL/work-view/hide" '{}' >/dev/null
  local hidden_state
  hidden_state="$(curl --silent "$SESSION_MANAGER_URL/work-view/state")"
  assert_json "$hidden_state" 'const data=JSON.parse(process.argv[1]); if(data.workView?.visibility!=="hidden"){throw new Error("expected hidden work view");}'

  local complete_body
  complete_body="$(node -e 'const hidden=JSON.parse(process.argv[1]); const targetUrl=process.argv[2]; const workView=hidden.workView??{}; process.stdout.write(JSON.stringify({details:{targetUrl,workViewUrl:targetUrl,summary:`Completed task at ${targetUrl}`,workView:{status:workView.status??null,visibility:workView.visibility??null,mode:workView.mode??null,helperStatus:workView.helperStatus??null,browserStatus:workView.browserStatus??null,entryUrl:workView.entryUrl??targetUrl,displayTarget:workView.displayTarget??null,activeUrl:workView.activeUrl??targetUrl}}}));' "$hidden_state" "$target_url")"
  local complete_result
  complete_result="$(post_json "$CORE_URL/tasks/$task_id/complete" "$complete_body")"
  assert_json "$complete_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="completed"){throw new Error("complete failed");}'
}

"$SCRIPT_DIR/dev-up.sh"

task_one_create="$(post_json "$CORE_URL/tasks" "{\"goal\":\"Open the AI work view at $TARGET_ONE\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_ONE\",\"workViewStrategy\":\"ai-work-view\"}")"
assert_json "$task_one_create" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.task?.id){throw new Error("task one create failed");}'
task_one_id="$(json_value "$task_one_create" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"
launch_task_into_work_view "$task_one_id" "$TARGET_ONE"

type_action="$(post_json "$SCREEN_ACT_URL/act/keyboard/type" '{"text":"hello from openclaw-screen-act"}')"
assert_json "$type_action" 'const data=JSON.parse(process.argv[1]); if(data.action?.degraded!==false){throw new Error("expected type action degraded=false");}'
record_action_phase "$task_one_id" "keyboard.type"

click_action="$(post_json "$SCREEN_ACT_URL/act/mouse/click" '{"x":640,"y":360,"button":"left"}')"
assert_json "$click_action" 'const data=JSON.parse(process.argv[1]); if(data.action?.degraded!==false){throw new Error("expected click action degraded=false");}'
record_action_phase "$task_one_id" "mouse.click"

complete_task "$task_one_id" "$TARGET_ONE"

runtime_idle="$(curl --silent "$CORE_URL/state/runtime")"
assert_json "$runtime_idle" 'const data=JSON.parse(process.argv[1]); if(data.runtime?.status!=="idle" || data.currentTask){throw new Error("runtime did not return to idle after completion");}'

latest_finished="$(curl --silent "$CORE_URL/tasks/latest-finished")"
assert_json "$latest_finished" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!task || task.status!=="completed" || task.workView?.visibility!=="hidden"){throw new Error("latest finished task not completed/hidden");}'
finished_task_id="$(json_value "$latest_finished" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"
latest_finished_focus="$(curl --silent "$CORE_URL/tasks/focus/latest-finished")"
node -e 'const focus=JSON.parse(process.argv[1]); const latest=JSON.parse(process.argv[2]); if(focus.focus!=="latest-finished" || focus.task?.id!==latest.task?.id){throw new Error("latest finished focus mismatch");}' "$latest_finished_focus" "$latest_finished"

recovered_latest="$(post_json "$CORE_URL/tasks/$finished_task_id/recover" '{}')"
assert_json "$recovered_latest" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!task || task.recovery?.recoveredFromTaskId!==data.recoveredFromTask?.id){throw new Error("latest finished recovery failed");}'
recovered_latest_id="$(json_value "$recovered_latest" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"
launch_task_into_work_view "$recovered_latest_id" "$TARGET_ONE"

stale_authority_status="$(curl --silent --output "$STALE_AUTHORITY_FILE" --write-out "%{http_code}" \
  -X POST "$SESSION_MANAGER_URL/work-view/helper-authority/suspend" \
  -H 'content-type: application/json' \
  -d '{"reason":"stale_operator_stop","sessionId":"stale-session-id"}')"
if [[ "$stale_authority_status" != "409" ]]; then
  echo "stale work-view authority request should fail with 409, got $stale_authority_status" >&2
  exit 1
fi
stale_authority="$(cat "$STALE_AUTHORITY_FILE")"
assert_json "$stale_authority" 'const data=JSON.parse(process.argv[1]); if(data.error!=="Trusted work-view helper runtime session mismatch." || data.workView?.helperRuntime?.actionAuthority!=="active" || data.workView?.helperRuntime?.status!=="active"){throw new Error(`stale authority request changed the active session: ${JSON.stringify(data)}`);}'

stop_result="$(post_json "$CORE_URL/control/stop" '{}')"
assert_json "$stop_result" 'const data=JSON.parse(process.argv[1]); const evidence=data.task?.outcome?.details?.trustedWorkViewAuthority; const recovery=data.task?.outcome?.details?.recoveryEvidence; if(!data.ok || data.task?.status!=="failed" || data.task?.outcome?.reason!=="Stopped by operator." || evidence?.authorityRevoked!==true || evidence?.actionAuthority!=="suspended" || recovery?.kind!=="work-view-authority-recovery-evidence" || recovery?.sourceTaskId!==data.task?.id || recovery?.interruption?.stage!=="operator_stop" || recovery?.interruption?.authorityRevoked!==true || recovery?.recommendation?.strategy!=="restore_trusted_work_view_then_recover_task" || recovery?.interruption?.sessionId!==undefined || data.workViewAuthority?.workView?.helperRuntime?.actionAuthority!=="suspended") {throw new Error(`stop did not record compact authority recovery evidence: ${JSON.stringify(data)}`);}'
stopped_work_view_state="$(curl --silent "$SESSION_MANAGER_URL/work-view/state")"
assert_json "$stopped_work_view_state" 'const data=JSON.parse(process.argv[1]); if(data.workView?.helperRuntime?.actionAuthority!=="suspended" || data.workView?.helperRuntime?.status!=="suspended"){throw new Error(`trusted work-view authority remained active after stop: ${JSON.stringify(data)}`);}'

latest_failed="$(curl --silent "$CORE_URL/tasks/latest-failed")"
assert_json "$latest_failed" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!task || task.status!=="failed" || !task.restorable || task.outcome?.reason!=="Stopped by operator.") {throw new Error("latest failed task missing, not recoverable, or missing failure reason");}'
failed_task_id="$(json_value "$latest_failed" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"
latest_failed_focus="$(curl --silent "$CORE_URL/tasks/focus/latest-failed")"
assert_json "$latest_failed_focus" 'const data=JSON.parse(process.argv[1]); if(data.focus!=="latest-failed" || data.task?.outcome?.reason!=="Stopped by operator.") {throw new Error("latest failed focus mismatch");}'

recovered_failed="$(post_json "$CORE_URL/tasks/$failed_task_id/recover" '{}')"
assert_json "$recovered_failed" 'const data=JSON.parse(process.argv[1]); const task=data.task; const evidence=task?.recovery?.recoveryEvidence; if(!task || task.recovery?.recoveredFromTaskId!==data.recoveredFromTask?.id || evidence?.kind!=="work-view-authority-recovery-evidence" || evidence?.sourceTaskId!==data.recoveredFromTask?.id || evidence?.interruption?.stage!=="operator_stop" || evidence?.recommendation?.strategy!=="restore_trusted_work_view_then_recover_task" || evidence?.interruption?.sessionId!==undefined){throw new Error(`failed task recovery lost authority provenance: ${JSON.stringify(data)}`);}'
recovered_failed_id="$(json_value "$recovered_failed" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"
launch_task_into_work_view "$recovered_failed_id" "$TARGET_ONE"

task_two_create="$(post_json "$CORE_URL/tasks" "{\"goal\":\"Open the AI work view at $TARGET_TWO\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_TWO\",\"workViewStrategy\":\"ai-work-view\"}")"
assert_json "$task_two_create" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.task?.id){throw new Error("task two create failed");}'
task_two_id="$(json_value "$task_two_create" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"
launch_task_into_work_view "$task_two_id" "$TARGET_TWO"

tasks_list="$(curl --silent "$CORE_URL/tasks?limit=8")"
runtime_running="$(curl --silent "$CORE_URL/state/runtime")"
work_view_state="$(curl --silent "$SESSION_MANAGER_URL/work-view/state")"
task_summary="$(curl --silent "$CORE_URL/tasks/summary")"
current_focus="$(curl --silent "$CORE_URL/tasks/focus/current")"

node - <<'EOF' "$runtime_idle" "$latest_finished" "$recovered_latest" "$latest_failed" "$recovered_failed" "$tasks_list" "$runtime_running" "$work_view_state" "$task_one_id" "$recovered_latest_id" "$failed_task_id" "$recovered_failed_id" "$task_two_id" "$task_summary" "$current_focus"
const runtimeIdle = JSON.parse(process.argv[2]);
const latestFinished = JSON.parse(process.argv[3]);
const recoveredLatest = JSON.parse(process.argv[4]);
const latestFailed = JSON.parse(process.argv[5]);
const recoveredFailed = JSON.parse(process.argv[6]);
const tasksList = JSON.parse(process.argv[7]);
const runtimeRunning = JSON.parse(process.argv[8]);
const workViewState = JSON.parse(process.argv[9]);
const taskOneId = process.argv[10];
const recoveredLatestId = process.argv[11];
const failedTaskId = process.argv[12];
const recoveredFailedId = process.argv[13];
const taskTwoId = process.argv[14];
const taskSummary = JSON.parse(process.argv[15]);
const currentFocus = JSON.parse(process.argv[16]);

const items = tasksList.items ?? [];
const taskTwo = items.find((task) => task.id === taskTwoId);
const recoveredFailedTask = items.find((task) => task.id === recoveredFailedId);
if (!taskTwo || taskTwo.status !== "running" || taskTwo.targetUrl !== "https://www.deepseek.com") {
  throw new Error("Expected final active task to target deepseek.");
}
if (!recoveredFailedTask || recoveredFailedTask.status !== "superseded") {
  throw new Error("Expected recovered failed task to be superseded by the final task.");
}
if (runtimeRunning.runtime?.status !== "running" || runtimeRunning.currentTask?.id !== taskTwoId) {
  throw new Error("Expected runtime to track final active task.");
}
if (workViewState.workView?.activeUrl !== "https://www.deepseek.com/" || workViewState.workView?.visibility !== "visible") {
  throw new Error("Expected work view to follow final active task URL.");
}
if (taskSummary.summary?.counts?.active !== 1 || taskSummary.summary?.counts?.recoverable < 3) {
  throw new Error("Expected task summary counts to expose one active and multiple recoverable tasks.");
}
if (currentFocus.focus !== "current-task" || currentFocus.task?.id !== taskTwoId || currentFocus.task?.isCurrentTask !== true) {
  throw new Error("Expected current focus endpoint to track the final active task.");
}

console.log(JSON.stringify({
  completedTask: {
    id: taskOneId,
    latestFinishedId: latestFinished.task?.id ?? null,
    runtimeAfterCompletion: runtimeIdle.runtime?.status ?? null,
    completedVisibility: latestFinished.task?.workView?.visibility ?? null,
  },
  recovery: {
    recoveredLatestId,
    latestFailedId: latestFailed.task?.id ?? null,
    recoveredFailedId,
  },
  finalRuntime: {
    status: runtimeRunning.runtime?.status ?? null,
    currentTaskId: runtimeRunning.currentTask?.id ?? null,
    currentTargetUrl: runtimeRunning.currentTask?.targetUrl ?? null,
  },
  taskSummary: taskSummary.summary?.counts ?? null,
  finalWorkView: {
    activeUrl: workViewState.workView?.activeUrl ?? null,
    visibility: workViewState.workView?.visibility ?? null,
  },
  supersededTaskId: recoveredFailedId,
  visibleTasks: items.length,
}, null, 2));
EOF
