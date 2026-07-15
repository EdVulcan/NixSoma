#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_ONE="https://www.baidu.com"
TARGET_TWO="https://www.deepseek.com"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5500}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5501}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5502}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5503}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5504}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5505}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5506}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5507}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5570}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-operator-loop-check.json}"
RESULT_DIR="$(mktemp -d)"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -rf "$RESULT_DIR"
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
  openclaw_eval_json "$json" "$script"
}

assert_json() {
  local json="$1"
  local script="$2"
  openclaw_eval_json "$json" "$script"
}

"$SCRIPT_DIR/dev-up.sh"

task_one="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator loop task one\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_ONE\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"operator one\"}}]}")"
assert_json "$task_one" 'const data=JSON.parse(process.argv[1]); const b=data.task?.operatorExecutionBinding; if(!data.ok || data.task?.status!=="queued" || data.plan?.status!=="planned" || b?.registry!=="openclaw-browser-task-execution-binding-v0" || b?.inputTextBound!==false || !/^[a-f0-9]{64}$/.test(b?.actionShapeHash??"") || JSON.stringify(b).includes("operator one")){throw new Error("task one binding missing or leaky");}'
task_one_id="$(json_value "$task_one" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"

blocked_result="$(post_json "$CORE_URL/operator/step" "{\"targetUrl\":\"$TARGET_TWO\",\"actions\":[{\"kind\":\"browser.new_tab\",\"params\":{\"url\":\"$TARGET_TWO\"}}]}")"
assert_json "$blocked_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==false || data.blocked!==true || data.reason!=="operator_execution_target_mismatch" || data.task?.status!=="queued"){throw new Error("operator mismatch was not blocked");}'

step_result="$(post_json "$CORE_URL/operator/step" '{"actions":[{"kind":"keyboard.type","params":{"text":"operator one re-entry"}}]}')"
assert_json "$step_result" 'const data=JSON.parse(process.argv[1]); const b=data.task?.outcome?.details?.operatorExecutionBinding; if(!data.ok || data.ran!==true || data.task?.status!=="completed" || data.execution?.verification?.ok!==true || b?.registry!=="openclaw-browser-task-execution-binding-v0" || b?.actionShapeValidated!==true || b?.inputTextBound!==false || JSON.stringify(b).includes("operator one")){throw new Error("operator step did not preserve binding evidence");}'

task_two="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator loop task two\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_TWO\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"operator two\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":520,\"y\":300,\"button\":\"left\"}}]}")"
assert_json "$task_two" 'const data=JSON.parse(process.argv[1]); const b=data.task?.operatorExecutionBinding; if(!data.ok || data.task?.status!=="queued" || data.plan?.status!=="planned" || b?.registry!=="openclaw-browser-task-execution-binding-v0" || b?.actionCount!==2 || b?.inputTextBound!==false || !/^[a-f0-9]{64}$/.test(b?.actionShapeHash??"") || JSON.stringify(b).includes("operator two")){throw new Error("task two binding missing or leaky");}'
task_two_id="$(json_value "$task_two" 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);')"

run_result="$(post_json "$CORE_URL/operator/run" '{"maxSteps":5}')"
assert_json "$run_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==true || data.count!==1 || data.steps?.[0]?.task?.status!=="completed"){throw new Error("operator run did not complete remaining task");}'

idle_result="$(post_json "$CORE_URL/operator/step" '{}')"
assert_json "$idle_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==false || data.task!==null){throw new Error("operator idle step should not run a task");}'

before_summary="$(curl --silent "$CORE_URL/tasks/summary")"
assert_json "$before_summary" 'const data=JSON.parse(process.argv[1]); const c=data.summary?.counts; if(c?.completed!==2 || c?.active!==0){throw new Error("unexpected operator pre-restart summary");}'

"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null

after_summary="$(curl --silent "$CORE_URL/tasks/summary")"
restored_one="$(curl --silent "$CORE_URL/tasks/$task_one_id")"
restored_two="$(curl --silent "$CORE_URL/tasks/$task_two_id")"
tasks_list="$(curl --silent "$CORE_URL/tasks?limit=10")"

printf '%s' "$step_result" > "$RESULT_DIR/step-result.json"
printf '%s' "$run_result" > "$RESULT_DIR/run-result.json"
printf '%s' "$before_summary" > "$RESULT_DIR/before-summary.json"
printf '%s' "$after_summary" > "$RESULT_DIR/after-summary.json"
printf '%s' "$restored_one" > "$RESULT_DIR/restored-one.json"
printf '%s' "$restored_two" > "$RESULT_DIR/restored-two.json"
printf '%s' "$tasks_list" > "$RESULT_DIR/tasks-list.json"

node - <<'EOF' "$RESULT_DIR/step-result.json" "$RESULT_DIR/run-result.json" "$RESULT_DIR/before-summary.json" "$RESULT_DIR/after-summary.json" "$RESULT_DIR/restored-one.json" "$RESULT_DIR/restored-two.json" "$RESULT_DIR/tasks-list.json"
const fs = require("node:fs");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const stepResult = readJson(process.argv[2]);
const runResult = readJson(process.argv[3]);
const beforeSummary = readJson(process.argv[4]);
const afterSummary = readJson(process.argv[5]);
const restoredOne = readJson(process.argv[6]).task;
const restoredTwo = readJson(process.argv[7]).task;
const tasksList = readJson(process.argv[8]);

function assertBinding(task, transientText) {
  const binding = task?.operatorExecutionBinding;
  if (
    binding?.registry !== "openclaw-browser-task-execution-binding-v0"
    || binding?.inputTextBound !== false
    || !/^[a-f0-9]{64}$/.test(binding?.actionShapeHash ?? "")
    || JSON.stringify(binding).includes(transientText)
  ) {
    throw new Error(`browser task binding readback mismatch for ${task?.id ?? "unknown"}`);
  }
}

assertBinding(restoredOne, "operator one");
assertBinding(restoredTwo, "operator two");

const beforeCounts = beforeSummary.summary?.counts ?? {};
const afterCounts = afterSummary.summary?.counts ?? {};
if (
  afterCounts.total !== beforeCounts.total
  || afterCounts.active !== 0
  || afterCounts.queued !== 0
  || afterCounts.running !== 0
  || afterCounts.paused !== 0
  || afterCounts.completed !== 1
  || afterCounts.failed !== 1
) {
  throw new Error(`operator restart lifecycle mismatch: before=${JSON.stringify(beforeCounts)} after=${JSON.stringify(afterCounts)}`);
}
if (!restoredOne || restoredOne.status !== "completed" || restoredOne.plan?.status !== "completed") {
  throw new Error("operator step task did not persist as completed planned task");
}
if (
  !restoredTwo
  || restoredTwo.status !== "failed"
  || restoredTwo.executionPhase !== "input_reentry_required"
  || restoredTwo.plan?.status !== "planned"
  || restoredTwo.outcome?.details?.reason !== "write_only_input_reentry_required"
  || restoredTwo.outcome?.details?.automaticReplay !== false
) {
  throw new Error("operator run task did not preserve the write-only input re-entry boundary after restart");
}
if (afterSummary.summary?.counts?.active !== 0 || afterSummary.summary?.currentTaskId !== null) {
  throw new Error("operator loop should leave no active tasks");
}
if (stepResult.task?.id !== restoredOne.id && stepResult.task?.id !== restoredTwo.id) {
  throw new Error("operator step result does not match restored tasks");
}
if (runResult.steps?.[0]?.task?.id !== restoredOne.id && runResult.steps?.[0]?.task?.id !== restoredTwo.id) {
  throw new Error("operator run result does not match restored tasks");
}

console.log(JSON.stringify({
  operatorLoop: {
    stateFile: process.env.OPENCLAW_CORE_STATE_FILE ?? null,
    counts: afterCounts,
    restoredTasks: tasksList.items?.length ?? 0,
  },
  step: {
    ran: stepResult.ran,
    taskId: stepResult.task?.id ?? null,
    status: stepResult.task?.status ?? null,
    verification: stepResult.execution?.verification?.ok ?? null,
  },
  run: {
    ran: runResult.ran,
    count: runResult.count,
    taskId: runResult.steps?.[0]?.task?.id ?? null,
    status: runResult.steps?.[0]?.task?.status ?? null,
  },
  restored: [
    {
      id: restoredOne.id,
      status: restoredOne.status,
      planStatus: restoredOne.plan?.status ?? null,
    },
    {
      id: restoredTwo.id,
      status: restoredTwo.status,
      planStatus: restoredTwo.plan?.status ?? null,
      executionPhase: restoredTwo.executionPhase ?? null,
      reentryRequired: restoredTwo.outcome?.details?.reason === "write_only_input_reentry_required",
    },
  ],
}, null, 2));
EOF
