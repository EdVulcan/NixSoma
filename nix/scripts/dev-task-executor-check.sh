#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_ONE="https://www.baidu.com"
TARGET_TWO="https://www.deepseek.com"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5200}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5201}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5202}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5203}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5204}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5205}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5206}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5207}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5270}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-task-executor-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"

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


json_value() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

assert_json() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

"$SCRIPT_DIR/dev-up.sh"

queued_task="$(post_json "$CORE_URL/tasks" "{\"goal\":\"Executor runs queued task at $TARGET_ONE\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_ONE\",\"workViewStrategy\":\"ai-work-view\"}")"
assert_json "$queued_task" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued"){throw new Error("queued task create failed");}'
queued_task_id="$(json_value "$queued_task" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"

queued_execution="$(post_json "$CORE_URL/tasks/$queued_task_id/execute" "{\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"executor queued task\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":640,\"y\":360,\"button\":\"left\"}}]}")"
assert_json "$queued_execution" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!data.ok || task?.status!=="completed" || task?.outcome?.kind!=="completed"){throw new Error("queued task execution did not complete");} if(data.execution?.finalReadiness!=="ready"){throw new Error("expected queued task final readiness ready");}'

direct_execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Executor creates and runs task at $TARGET_TWO\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_TWO\",\"workViewStrategy\":\"ai-work-view\",\"hideOnComplete\":false,\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"executor direct task\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":420,\"y\":240,\"button\":\"left\"}}]}")"
assert_json "$direct_execution" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!data.ok || task?.status!=="completed" || task?.targetUrl!=="https://www.deepseek.com"){throw new Error("direct execution did not complete deepseek task");} if(task.workView?.visibility!=="visible"){throw new Error("direct execution should keep work view visible");}'

failed_execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Executor should fail verification at $TARGET_ONE\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_ONE\",\"expectedUrl\":\"https://expected.invalid/should-fail\",\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"mouse.click\",\"params\":{\"x\":320,\"y\":180,\"button\":\"left\"}}]}")"
assert_json "$failed_execution" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!data.ok || task?.status!=="failed" || task?.outcome?.kind!=="failed"){throw new Error("verification failure task did not fail");} if(data.execution?.verification?.ok!==false){throw new Error("expected verification ok=false");}'
failed_task_id="$(json_value "$failed_execution" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"

recovered_failed="$(post_json "$CORE_URL/tasks/$failed_task_id/recover" '{}')"
assert_json "$recovered_failed" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.recovery?.recoveredFromTaskId!==data.recoveredFromTask?.id){throw new Error("failed executor task recovery failed");}'

auto_recovered_execution="$(post_json "$CORE_URL/tasks/execute" "{\"goal\":\"Executor should auto-recover verification failure at $TARGET_ONE\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_ONE\",\"expectedUrl\":\"https://expected.invalid/auto-recover\",\"recoveryExpectedUrl\":\"$TARGET_ONE\",\"autoRecover\":true,\"maxRecoveryAttempts\":1,\"workViewStrategy\":\"ai-work-view\",\"actions\":[{\"kind\":\"mouse.click\",\"params\":{\"x\":300,\"y\":160,\"button\":\"left\"}}]}")"
assert_json "$auto_recovered_execution" 'const data=JSON.parse(process.argv[1]); const task=data.task; if(!data.ok || task?.status!=="completed"){throw new Error("auto recovered execution did not complete");} if(data.execution?.recovery?.succeeded!==true || data.execution?.attempts?.length!==2){throw new Error("expected one failed attempt and one recovered attempt");}'

runtime_state="$(curl --silent "$CORE_URL/state/runtime")"
task_summary="$(curl --silent "$CORE_URL/tasks/summary")"
latest_finished="$(curl --silent "$CORE_URL/tasks/latest-finished")"
latest_failed="$(curl --silent "$CORE_URL/tasks/latest-failed")"
work_view_state="$(curl --silent "$SESSION_MANAGER_URL/work-view/state")"
action_state="$(curl --silent "$SCREEN_ACT_URL/act/state")"

node - <<'EOF' "$queued_execution" "$direct_execution" "$failed_execution" "$recovered_failed" "$auto_recovered_execution" "$runtime_state" "$task_summary" "$latest_finished" "$latest_failed" "$work_view_state" "$action_state"
const queuedExecution = JSON.parse(process.argv[2]);
const directExecution = JSON.parse(process.argv[3]);
const failedExecution = JSON.parse(process.argv[4]);
const recoveredFailed = JSON.parse(process.argv[5]);
const autoRecoveredExecution = JSON.parse(process.argv[6]);
const runtimeState = JSON.parse(process.argv[7]);
const taskSummary = JSON.parse(process.argv[8]);
const latestFinished = JSON.parse(process.argv[9]);
const latestFailed = JSON.parse(process.argv[10]);
const workViewState = JSON.parse(process.argv[11]);
const actionState = JSON.parse(process.argv[12]);

const completedPhases = [
  "queued",
  "preparing_work_view",
  "opening_target",
  "ready_for_action",
  "observing_screen",
  "acting_on_target",
  "verifying_result",
  "completed",
];
const failedPhases = [
  "queued",
  "preparing_work_view",
  "opening_target",
  "ready_for_action",
  "observing_screen",
  "acting_on_target",
  "verifying_result",
  "failed",
];

function assertTaskPhases(task, label, requiredPhases) {
  const phases = new Set((task.phaseHistory ?? []).map((entry) => entry.phase));
  for (const phase of requiredPhases) {
    if (!phases.has(phase)) {
      throw new Error(`${label} missing executor phase ${phase}`);
    }
  }
}

assertTaskPhases(queuedExecution.task, "queued execution", completedPhases);
assertTaskPhases(directExecution.task, "direct execution", completedPhases);
assertTaskPhases(failedExecution.task, "failed execution", failedPhases);
assertTaskPhases(autoRecoveredExecution.task, "auto recovered execution", completedPhases);

if (queuedExecution.execution?.verification?.ok !== true || directExecution.execution?.verification?.ok !== true) {
  throw new Error("Expected successful executor runs to include verification ok=true.");
}
if (autoRecoveredExecution.execution?.executor !== "core-v3" || autoRecoveredExecution.execution?.recovery?.succeeded !== true) {
  throw new Error("Expected auto recovered execution to use core-v3 and succeed.");
}
const autoAttempts = autoRecoveredExecution.execution?.attempts ?? [];
if (autoAttempts.length !== 2 || autoAttempts[0]?.status !== "failed" || autoAttempts[1]?.status !== "completed") {
  throw new Error("Expected auto recovery attempts to be failed then completed.");
}
if (failedExecution.execution?.verification?.ok !== false || failedExecution.task?.outcome?.reason !== "Executor verification failed.") {
  throw new Error("Expected failed executor run to expose verification failure reason.");
}
if (!failedExecution.execution?.verification?.failedChecks?.some((check) => check.name === "target_url")) {
  throw new Error("Expected failed executor run to identify target_url check.");
}
if (recoveredFailed.task?.recovery?.recoveredFromTaskId !== failedExecution.task?.id) {
  throw new Error("Expected failed executor task to be recoverable.");
}
if (recoveredFailed.task?.status !== "queued") {
  throw new Error("Expected manual recovery to create a queued task before auto recovery supersedes it.");
}
if (runtimeState.runtime?.status !== "idle" || runtimeState.currentTask !== null) {
  throw new Error("Expected runtime idle after auto recovery completes.");
}
if (taskSummary.summary?.counts?.completed !== 3 || taskSummary.summary?.counts?.failed !== 2 || taskSummary.summary?.counts?.superseded !== 1 || taskSummary.summary?.counts?.active !== 0) {
  throw new Error("Expected executor summary to show three completed, two failed, one superseded, and no active tasks.");
}
if (latestFinished.task?.id !== autoRecoveredExecution.task?.id || latestFinished.task?.workView?.visibility !== "hidden") {
  throw new Error("Expected latest finished task to be the hidden auto recovered execution.");
}
if (latestFailed.task?.restorable !== true || latestFailed.task?.outcome?.reason !== "Executor verification failed.") {
  throw new Error("Expected latest failed task to be a restorable verification failure.");
}
if (workViewState.workView?.activeUrl !== "https://www.baidu.com/" || workViewState.workView?.visibility !== "hidden") {
  throw new Error("Expected work view to be hidden after successful auto recovery.");
}
if (actionState.state?.actionCount !== 7 || actionState.state?.lastAction?.degraded !== false) {
  throw new Error("Expected seven non-degraded executor actions.");
}

console.log(JSON.stringify({
  queuedExecution: {
    id: queuedExecution.task?.id ?? null,
    status: queuedExecution.task?.status ?? null,
    phase: queuedExecution.task?.executionPhase ?? null,
    finalReadiness: queuedExecution.execution?.finalReadiness ?? null,
    visibility: queuedExecution.task?.workView?.visibility ?? null,
  },
  directExecution: {
    id: directExecution.task?.id ?? null,
    status: directExecution.task?.status ?? null,
    phase: directExecution.task?.executionPhase ?? null,
    finalReadiness: directExecution.execution?.finalReadiness ?? null,
    verification: directExecution.execution?.verification?.ok ?? null,
    visibility: directExecution.task?.workView?.visibility ?? null,
    activeUrl: directExecution.task?.workView?.activeUrl ?? null,
  },
  failedExecution: {
    id: failedExecution.task?.id ?? null,
    status: failedExecution.task?.status ?? null,
    phase: failedExecution.task?.executionPhase ?? null,
    verification: failedExecution.execution?.verification?.ok ?? null,
    failedChecks: failedExecution.execution?.verification?.failedChecks?.map((check) => check.name) ?? [],
    recoveredAs: recoveredFailed.task?.id ?? null,
  },
  autoRecoveredExecution: {
    id: autoRecoveredExecution.task?.id ?? null,
    status: autoRecoveredExecution.task?.status ?? null,
    phase: autoRecoveredExecution.task?.executionPhase ?? null,
    executor: autoRecoveredExecution.execution?.executor ?? null,
    recovery: autoRecoveredExecution.execution?.recovery ?? null,
    attempts: autoRecoveredExecution.execution?.attempts ?? [],
  },
  runtime: {
    status: runtimeState.runtime?.status ?? null,
    currentTaskId: runtimeState.runtime?.currentTaskId ?? null,
  },
  taskSummary: taskSummary.summary?.counts ?? null,
  actionCount: actionState.state?.actionCount ?? null,
  workView: {
    activeUrl: workViewState.workView?.activeUrl ?? null,
    visibility: workViewState.workView?.visibility ?? null,
    reason: "hidden after successful auto recovery",
  },
}, null, 2));
EOF
