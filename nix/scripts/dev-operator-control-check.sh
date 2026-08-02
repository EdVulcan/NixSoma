#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://www.baidu.com"

# Keep this lane isolated from historical development state and credentials.
export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-operator-control-$$}"
unset OPENCLAW_OPERATOR_TOKEN OPENCLAW_OPERATOR_TOKEN_FILE
export OPENCLAW_OPERATOR_TOKEN_FILE="$REPO_ROOT/.artifacts/openclaw-operator-token-$OPENCLAW_DEV_RUN_ID"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-events-$OPENCLAW_DEV_RUN_ID.jsonl}"
export OPENCLAW_BOUNDED_OPERATOR_SCHEDULER_ENABLED=1
export OPENCLAW_BOUNDED_OPERATOR_SCHEDULER_INTERVAL_MS=60000
export OPENCLAW_BOUNDED_OPERATOR_WINDOW_ENABLED=1
export OPENCLAW_BOUNDED_OPERATOR_WINDOW_INTERVAL_MS=60000
export OPENCLAW_RENEWABLE_OPERATOR_MISSION_ENABLED=1
export OPENCLAW_RENEWABLE_OPERATOR_MISSION_INTERVAL_MS=60000

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5700}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5701}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5702}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5703}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5704}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5705}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5706}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5707}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5770}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-$OPENCLAW_DEV_RUN_ID.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  if [[ -n "${RESULT_DIR:-}" ]]; then
    rm -rf "$RESULT_DIR"
  fi
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


assert_json() {
  local json="$1"
  local script="$2"
  printf '%s' "$json" | node -e '
    const fs = require("node:fs");
    const script = process.argv[1];
    process.argv[1] = fs.readFileSync(0, "utf8");
    eval(script);
  ' "$script"
}

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");

for (const token of [
  "resume-button",
  "operator-loop-status",
  "operator-loop-blocked",
  "operator-loop-next",
  "operator-run-limit-input",
  "operator-preview-button",
  "operator-resume-button",
  "operator-session-status",
  "Preview Queue",
  "Run Queue",
  "Resume Interrupted Run",
  "Renewable Operator Mission",
  "operator-mission-progress-bar",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/operator/state",
  "/control/resume",
  "/operator/resume",
  "task.resumed",
  "Trusted Work-View Authority",
  "boundedOperatorRunLimit",
  "resumeOperatorSessionFromUi",
  "refreshOperatorMission",
  "armOperatorMissionFromUi",
  "JSON.stringify({ maxSteps, dryRun })",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

planned_task="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator control planned task\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"operator control\"}}]}")"
assert_json "$planned_task" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued" || data.plan?.status!=="planned"){throw new Error("operator control planned task not queued");}'

ready_state="$(curl --silent "$CORE_URL/operator/state")"
assert_json "$ready_state" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.operator?.status!=="ready" || data.operator?.blocked!==false || data.operator?.nextTask?.status!=="queued"){throw new Error("operator state should expose ready queued task");}'

queue_preview="$(post_json "$CORE_URL/operator/run" '{"maxSteps":3,"dryRun":true}')"
assert_json "$queue_preview" 'const data=JSON.parse(process.argv[1]); const session=data.session; if(!data.ok || data.ran!==false || data.dryRun!==true || data.reason!=="dry_run" || data.nextTask?.status!=="queued" || session?.registry!=="nixsoma-bounded-operator-run-request-v0" || session?.status!=="previewed" || session?.maximumSteps!==3 || session?.governance?.openLoop!==false || session?.governance?.automaticRetry!==false){throw new Error("bounded queue preview contract is invalid");}'

rejected_override="$(post_json "$CORE_URL/operator/run" '{"maxSteps":3,"actions":[]}')"
assert_json "$rejected_override" 'const data=JSON.parse(process.argv[1]); if(data.ok!==false || !String(data.error).includes("does not accept task execution override fields")){throw new Error("operator run accepted caller execution authority");}'

dry_run="$(post_json "$CORE_URL/operator/step" '{"dryRun":true}')"
assert_json "$dry_run" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==false || data.dryRun!==true || data.reason!=="dry_run" || data.task?.status!=="queued"){throw new Error("operator dry run should return queued task without running");}'

after_dry_summary="$(curl --silent "$CORE_URL/tasks/summary")"
assert_json "$after_dry_summary" 'const data=JSON.parse(process.argv[1]); const c=data.summary?.counts; if(c?.queued!==1 || c?.completed!==0 || c?.active!==1){throw new Error("dry run mutated task state");}'

pause_result="$(post_json "$CORE_URL/control/pause" '{}')"
assert_json "$pause_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="paused" || data.runtime?.paused!==true){throw new Error("pause did not mark current task paused");}'

paused_state="$(curl --silent "$CORE_URL/operator/state")"
assert_json "$paused_state" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.operator?.status!=="paused" || data.operator?.blocked!==true || data.operator?.reason!=="runtime_paused"){throw new Error("operator state should be paused/blocked");}'

blocked_step="$(post_json "$CORE_URL/operator/step" '{}')"
assert_json "$blocked_step" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==false || data.blocked!==true || data.reason!=="runtime_paused" || data.summary?.counts?.paused!==1){throw new Error("operator step should be blocked while paused");}'

resume_result="$(post_json "$CORE_URL/control/resume" '{}')"
assert_json "$resume_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued" || data.runtime?.status!=="queued" || data.runtime?.paused!==false){throw new Error("resume did not restore task to queued");}'

run_result="$(post_json "$CORE_URL/operator/run" '{"maxSteps":3,"dryRun":false}')"
assert_json "$run_result" 'const data=JSON.parse(process.argv[1]); const session=data.session; const run=data.runSession; if(!data.ok || data.ran!==true || data.count!==1 || data.steps?.[0]?.task?.status!=="completed" || data.steps?.[0]?.execution?.verification?.ok!==true || session?.status!=="run_requested" || session?.maximumSteps!==3 || session?.dryRun!==false || run?.registry!=="nixsoma-bounded-operator-run-session-v0" || run?.status!=="completed" || run?.stepsCompleted!==1 || run?.resumeAvailable!==false){throw new Error("bounded operator run did not complete or checkpoint its session");}'

continuity_task="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator continuity task\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"actions\":[]}")"
assert_json "$continuity_task" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued" || data.plan?.status!=="planned"){throw new Error("continuity task was not queued");}'

continuity_pause="$(post_json "$CORE_URL/control/pause" '{}')"
assert_json "$continuity_pause" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="paused"){throw new Error("continuity task did not pause");}'

continuity_blocked_run="$(post_json "$CORE_URL/operator/run" '{"maxSteps":2,"dryRun":false}')"
assert_json "$continuity_blocked_run" 'const data=JSON.parse(process.argv[1]); const run=data.runSession; if(!data.ok || data.ran!==false || data.blocked!==true || data.reason!=="runtime_paused" || run?.status!=="paused" || run?.stopReason!=="runtime_paused" || run?.remainingSteps!==2 || run?.resumeAvailable!==true){throw new Error("paused operator session was not checkpointed");}'
continuity_session_id="$(printf '%s' "$continuity_blocked_run" | node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.runSession?.id ?? "");')"
if [[ -z "$continuity_session_id" ]]; then
  echo "continuity session id missing" >&2
  exit 1
fi
export OPENCLAW_CONTINUITY_SESSION_ID="$continuity_session_id"

continuity_resume_task="$(post_json "$CORE_URL/control/resume" '{}')"
assert_json "$continuity_resume_task" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued" || data.runtime?.paused!==false){throw new Error("continuity task did not return to queued state");}'

# A clean service stop flushes the state file; startup must retain the paused
# session and require the explicit task-bound resume request below.
"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh"

restored_state="$(curl --silent "$CORE_URL/operator/state")"
assert_json "$restored_state" 'const data=JSON.parse(process.argv[1]); const session=data.runSessions?.find((item)=>item.id===process.env.OPENCLAW_CONTINUITY_SESSION_ID); if(!data.ok || session?.status!=="paused" || session?.stopReason!=="runtime_paused" || session?.remainingSteps!==2 || session?.resumeAvailable!==true){throw new Error("persisted paused session was not restored as resumable");}'

continuity_resume="$(post_json "$CORE_URL/operator/resume" "{\"sessionId\":\"$continuity_session_id\",\"confirm\":true}")"
assert_json "$continuity_resume" 'const data=JSON.parse(process.argv[1]); const run=data.runSession; if(!data.ok || data.resumed!==true || data.ran!==true || data.count!==1 || data.steps?.[0]?.task?.status!=="completed" || run?.status!=="completed" || run?.resumeCount!==1 || run?.stepsCompleted!==1 || run?.remainingSteps!==1 || run?.resumeAvailable!==false){throw new Error("explicit resume did not consume the persisted budget");}'

scheduled_task="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator scheduled task\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"actions\":[]}")"
assert_json "$scheduled_task" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued" || data.plan?.status!=="planned"){throw new Error("scheduled task was not queued");}'

scheduled_arm="$(post_json "$CORE_URL/operator/schedule" '{"maxSteps":1,"delayMs":0,"confirm":true}')"
assert_json "$scheduled_arm" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.schedule?.status!=="armed" || data.schedule?.maxSteps!==1 || data.scheduler?.enabled!==true){throw new Error("bounded schedule did not arm with explicit enabled timer");}'
scheduled_id="$(printf '%s' "$scheduled_arm" | node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.schedule?.id ?? "");')"
if [[ -z "$scheduled_id" ]]; then
  echo "scheduled operator id missing" >&2
  exit 1
fi

scheduled_tick="$(post_json "$CORE_URL/operator/schedule/tick" '{}')"
assert_json "$scheduled_tick" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==true || data.schedule?.status!=="completed" || data.schedule?.lastResult?.count!==1 || data.schedule?.governance?.automaticRetry!==false){throw new Error("bounded schedule did not consume exactly one due run");}'

rearm_arm="$(post_json "$CORE_URL/operator/schedule" '{"maxSteps":1,"delayMs":600000,"confirm":true}')"
assert_json "$rearm_arm" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.schedule?.status!=="armed"){throw new Error("re-arm fixture did not arm");}'
rearm_id="$(printf '%s' "$rearm_arm" | node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.schedule?.id ?? "");')"
if [[ -z "$rearm_id" ]]; then
  echo "re-arm fixture id missing" >&2
  exit 1
fi
export OPENCLAW_REARM_ID="$rearm_id"

# A clean restart must pause the armed schedule; only the explicit re-arm route
# may return it to the timer.
"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh"

rearm_paused_state="$(curl --silent "$CORE_URL/operator/schedule")"
assert_json "$rearm_paused_state" 'const data=JSON.parse(process.argv[1]); const schedule=data.schedules?.find((item)=>item.id===process.env.OPENCLAW_REARM_ID); if(!data.ok || schedule?.status!=="paused" || schedule?.stopReason!=="core_restart_requires_explicit_rearm"){throw new Error("restart did not pause the armed schedule");}'

rearmed="$(post_json "$CORE_URL/operator/schedule/$rearm_id/rearm" '{"delayMs":0,"confirm":true}')"
assert_json "$rearmed" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.schedule?.id!==process.env.OPENCLAW_REARM_ID || data.schedule?.status!=="armed" || data.schedule?.maxSteps!==1){throw new Error("explicit schedule re-arm did not preserve the budget");}'

cancelled_schedule="$(post_json "$CORE_URL/operator/schedule/$rearm_id/cancel" '{"confirm":true}')"
assert_json "$cancelled_schedule" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.schedule?.id!==process.env.OPENCLAW_REARM_ID || data.schedule?.status!=="cancelled"){throw new Error("re-armed schedule did not cancel explicitly");}'

window_arm="$(post_json "$CORE_URL/operator/window" '{"windowCount":2,"maxStepsPerWindow":1,"intervalMs":0,"deadlineMs":60000,"confirm":true}')"
assert_json "$window_arm" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.lease?.status!=="armed" || data.lease?.windowCount!==2 || data.leaseManager?.enabled!==true){throw new Error("bounded operator window lease did not arm");}'
window_first="$(post_json "$CORE_URL/operator/window/tick" '{}')"
assert_json "$window_first" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==true || data.continued!==true || data.lease?.status!=="armed" || data.lease?.windowsCompleted!==1){throw new Error("first bounded window did not continue within lease");}'
window_second="$(post_json "$CORE_URL/operator/window/tick" '{}')"
assert_json "$window_second" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==true || data.lease?.status!=="completed" || data.lease?.stopReason!=="window_budget_consumed" || data.lease?.remainingWindows!==0 || data.lease?.governance?.automaticRepeat!==false){throw new Error("bounded window lease did not stop at its finite budget");}'

anonymous_mission_status="$(command curl --silent --output /dev/null --write-out '%{http_code}' "$CORE_URL/operator/mission")"
if [[ "$anonymous_mission_status" != "401" ]]; then
  echo "anonymous renewable mission read should be rejected with HTTP 401, got $anonymous_mission_status" >&2
  exit 1
fi

mission_task_one="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator mission task one\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"actions\":[]}")"
assert_json "$mission_task_one" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued"){throw new Error("first mission task was not queued");}'

mission_arm="$(post_json "$CORE_URL/operator/mission" '{"epochCount":2,"maxStepsPerEpoch":1,"epochIntervalMs":0,"deadlineMs":60000,"maxNoProgressEpochs":2,"confirm":true}')"
assert_json "$mission_arm" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="armed" || data.mission?.epochsAuthorized!==2 || data.supervisor?.enabled!==true || data.mission?.governance?.oneBoundedWindowPerEpoch!==true){throw new Error("renewable mission did not arm finite authority");}'
mission_id="$(printf '%s' "$mission_arm" | node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.mission?.id ?? "");')"
if [[ -z "$mission_id" ]]; then
  echo "renewable mission id missing" >&2
  exit 1
fi
export OPENCLAW_MISSION_ID="$mission_id"
mission_authenticated_state="$(curl --silent "$CORE_URL/operator/mission")"
assert_json "$mission_authenticated_state" 'const data=JSON.parse(process.argv[1]); const mission=data.missions?.find((item)=>item.id===process.env.OPENCLAW_MISSION_ID); if(!data.ok || mission?.status!=="armed"){throw new Error("authenticated renewable mission read did not return the armed mission");}'

mission_first="$(post_json "$CORE_URL/operator/mission/tick" '{}')"
assert_json "$mission_first" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.ran || data.mission?.status!=="armed" || data.mission?.epochsConsumed!==1 || data.mission?.epochsCompleted!==1 || data.mission?.lastCheckpoint?.stepCount!==1){throw new Error("first mission epoch did not checkpoint task progress");}'
mission_paused="$(post_json "$CORE_URL/operator/mission/$mission_id/pause" '{"confirm":true}')"
assert_json "$mission_paused" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="paused" || data.mission?.epochsConsumed!==1){throw new Error("mission did not pause between epochs");}'
mission_rearmed="$(post_json "$CORE_URL/operator/mission/$mission_id/rearm" '{"resetCircuit":false,"confirm":true}')"
assert_json "$mission_rearmed" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="armed" || data.mission?.remainingEpochs!==1){throw new Error("mission did not explicitly resume remaining authority");}'
mission_renewed="$(post_json "$CORE_URL/operator/mission/$mission_id/renew" '{"additionalEpochs":1,"extensionMs":60000,"confirm":true}')"
assert_json "$mission_renewed" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.epochsAuthorized!==3 || data.mission?.remainingEpochs!==2 || data.mission?.renewalCount!==1){throw new Error("mission renewal did not extend finite authority");}'
mission_task_two="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Operator mission task two\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"actions\":[]}")"
assert_json "$mission_task_two" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued"){throw new Error("second mission task was not queued between epochs");}'
mission_second="$(post_json "$CORE_URL/operator/mission/tick" '{}')"
assert_json "$mission_second" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="armed" || data.mission?.epochsCompleted!==2 || data.mission?.lastCheckpoint?.stepCount!==1){throw new Error("second mission epoch did not consume the second task");}'
mission_final="$(post_json "$CORE_URL/operator/mission/tick" '{}')"
assert_json "$mission_final" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="completed" || data.mission?.epochsConsumed!==3 || data.mission?.remainingEpochs!==0 || data.mission?.progressPercent!==100 || data.mission?.governance?.automaticRetry!==false){throw new Error("renewed mission did not stop at its exact authority");}'

mission_restart_arm="$(post_json "$CORE_URL/operator/mission" '{"epochCount":1,"maxStepsPerEpoch":1,"epochIntervalMs":0,"deadlineMs":600000,"maxNoProgressEpochs":2,"confirm":true}')"
mission_restart_id="$(printf '%s' "$mission_restart_arm" | node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.mission?.id ?? "");')"
if [[ -z "$mission_restart_id" ]]; then
  echo "restart mission id missing" >&2
  exit 1
fi
export OPENCLAW_RESTART_MISSION_ID="$mission_restart_id"
"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh"
mission_restart_state="$(curl --silent "$CORE_URL/operator/mission")"
assert_json "$mission_restart_state" 'const data=JSON.parse(process.argv[1]); const mission=data.missions?.find((item)=>item.id===process.env.OPENCLAW_RESTART_MISSION_ID); if(!data.ok || mission?.status!=="paused" || mission?.stopReason!=="core_restart_requires_explicit_rearm" || mission?.epochsConsumed!==0){throw new Error("restart did not pause untouched mission authority");}'
mission_restart_rearmed="$(post_json "$CORE_URL/operator/mission/$mission_restart_id/rearm" '{"resetCircuit":false,"confirm":true}')"
assert_json "$mission_restart_rearmed" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="armed" || data.mission?.epochsConsumed!==0){throw new Error("restart mission did not re-arm explicitly");}'
mission_restart_cancelled="$(post_json "$CORE_URL/operator/mission/$mission_restart_id/cancel" '{"confirm":true}')"
assert_json "$mission_restart_cancelled" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="cancelled"){throw new Error("restart mission did not cancel explicitly");}'

worklist_before_bind_summary="$(curl --silent "$CORE_URL/tasks/summary")"
worklist_mission_arm="$(post_json "$CORE_URL/operator/mission" '{"epochCount":2,"maxStepsPerEpoch":1,"epochIntervalMs":0,"deadlineMs":60000,"maxNoProgressEpochs":2,"confirm":true}')"
assert_json "$worklist_mission_arm" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.mission?.status!=="armed" || data.mission?.epochsConsumed!==0 || data.mission?.remainingEpochs!==2){throw new Error("reviewed worklist mission did not arm with two untouched epochs");}'
worklist_mission_id="$(printf '%s' "$worklist_mission_arm" | node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.mission?.id ?? "");')"
if [[ -z "$worklist_mission_id" ]]; then
  echo "reviewed worklist mission id missing" >&2
  exit 1
fi
export OPENCLAW_WORKLIST_MISSION_ID="$worklist_mission_id"

worklist_bound="$(post_json "$CORE_URL/operator/mission/$worklist_mission_id/worklist" "{\"items\":[{\"goal\":\"Reviewed mission worklist task one\",\"targetUrl\":\"$TARGET_URL\"},{\"goal\":\"Reviewed mission worklist task two\",\"targetUrl\":\"$TARGET_URL\"}],\"confirm\":true}")"
assert_json "$worklist_bound" 'const data=JSON.parse(process.argv[1]); const worklist=data.worklist; if(!data.ok || worklist?.registry!=="nixsoma-reviewed-finite-mission-worklist-v0" || worklist?.status!=="bound" || worklist?.itemCount!==2 || worklist?.issuedCount!==0 || worklist?.completedCount!==0 || worklist?.nextItemOrdinal!==1 || worklist?.items?.some((item)=>item.status!=="pending" || item.issuedTaskId!==null) || worklist?.governance?.automaticRetry!==false || worklist?.governance?.automaticSkip!==false || worklist?.governance?.providerCanExtendWorklist!==false){throw new Error("reviewed mission worklist did not bind as an immutable zero-task supply");}'
worklist_after_bind_summary="$(curl --silent "$CORE_URL/tasks/summary")"

worklist_first="$(post_json "$CORE_URL/operator/mission/tick" '{}')"
assert_json "$worklist_first" 'const data=JSON.parse(process.argv[1]); const items=data.worklist?.items; if(!data.ok || data.ran!==true || data.mission?.status!=="armed" || data.mission?.epochsConsumed!==1 || data.mission?.epochsCompleted!==1 || data.worklist?.completedCount!==1 || data.worklist?.nextItemOrdinal!==2 || items?.[0]?.ordinal!==1 || items?.[0]?.status!=="completed" || !items?.[0]?.issuedTaskId || !items?.[0]?.issueCheckpointAt || items?.[1]?.ordinal!==2 || items?.[1]?.status!=="pending" || items?.[1]?.issuedTaskId!==null){throw new Error("first reviewed worklist epoch did not issue and complete only item one");}'
worklist_second="$(post_json "$CORE_URL/operator/mission/tick" '{}')"
assert_json "$worklist_second" 'const data=JSON.parse(process.argv[1]); const items=data.worklist?.items; if(!data.ok || data.ran!==true || data.mission?.status!=="completed" || data.mission?.stopReason!=="reviewed_worklist_completed" || data.mission?.epochsConsumed!==2 || data.mission?.epochsCompleted!==2 || data.worklist?.status!=="completed" || data.worklist?.issuedCount!==2 || data.worklist?.completedCount!==2 || data.worklist?.progressPercent!==100 || data.worklist?.nextItemOrdinal!==null || items?.length!==2 || items.some((item)=>item.status!=="completed" || item.terminalTaskStatus!=="completed" || !item.issuedTaskId || !item.issueCheckpointAt) || items[0].issuedTaskId===items[1].issuedTaskId){throw new Error("second reviewed worklist epoch did not finish the exact ordered supply");}'
worklist_final_tasks="$(curl --silent "$CORE_URL/tasks?limit=20")"

final_state="$(curl --silent "$CORE_URL/operator/state")"

RESULT_DIR="$(mktemp -d)"
printf '%s' "$ready_state" > "$RESULT_DIR/ready.json"
printf '%s' "$queue_preview" > "$RESULT_DIR/preview.json"
printf '%s' "$dry_run" > "$RESULT_DIR/dry-run.json"
printf '%s' "$paused_state" > "$RESULT_DIR/paused.json"
printf '%s' "$blocked_step" > "$RESULT_DIR/blocked.json"
printf '%s' "$resume_result" > "$RESULT_DIR/resumed.json"
printf '%s' "$run_result" > "$RESULT_DIR/run.json"
printf '%s' "$continuity_task" > "$RESULT_DIR/continuity-task.json"
printf '%s' "$continuity_blocked_run" > "$RESULT_DIR/continuity-blocked.json"
printf '%s' "$restored_state" > "$RESULT_DIR/continuity-restored.json"
printf '%s' "$continuity_resume" > "$RESULT_DIR/continuity-resumed.json"
printf '%s' "$scheduled_arm" > "$RESULT_DIR/scheduled-arm.json"
printf '%s' "$scheduled_tick" > "$RESULT_DIR/scheduled-tick.json"
printf '%s' "$rearm_paused_state" > "$RESULT_DIR/rearm-paused.json"
printf '%s' "$rearmed" > "$RESULT_DIR/rearmed.json"
printf '%s' "$cancelled_schedule" > "$RESULT_DIR/cancelled-schedule.json"
printf '%s' "$window_arm" > "$RESULT_DIR/window-arm.json"
printf '%s' "$window_first" > "$RESULT_DIR/window-first.json"
printf '%s' "$window_second" > "$RESULT_DIR/window-second.json"
printf '%s' "$mission_arm" > "$RESULT_DIR/mission-arm.json"
printf '%s' "$mission_first" > "$RESULT_DIR/mission-first.json"
printf '%s' "$mission_paused" > "$RESULT_DIR/mission-paused.json"
printf '%s' "$mission_rearmed" > "$RESULT_DIR/mission-rearmed.json"
printf '%s' "$mission_renewed" > "$RESULT_DIR/mission-renewed.json"
printf '%s' "$mission_second" > "$RESULT_DIR/mission-second.json"
printf '%s' "$mission_final" > "$RESULT_DIR/mission-final.json"
printf '%s' "$mission_restart_state" > "$RESULT_DIR/mission-restart-state.json"
printf '%s' "$mission_restart_rearmed" > "$RESULT_DIR/mission-restart-rearmed.json"
printf '%s' "$mission_restart_cancelled" > "$RESULT_DIR/mission-restart-cancelled.json"
printf '%s' "$worklist_before_bind_summary" > "$RESULT_DIR/worklist-before-bind-summary.json"
printf '%s' "$worklist_mission_arm" > "$RESULT_DIR/worklist-mission-arm.json"
printf '%s' "$worklist_bound" > "$RESULT_DIR/worklist-bound.json"
printf '%s' "$worklist_after_bind_summary" > "$RESULT_DIR/worklist-after-bind-summary.json"
printf '%s' "$worklist_first" > "$RESULT_DIR/worklist-first.json"
printf '%s' "$worklist_second" > "$RESULT_DIR/worklist-second.json"
printf '%s' "$worklist_final_tasks" > "$RESULT_DIR/worklist-final-tasks.json"
printf '%s' "$final_state" > "$RESULT_DIR/final.json"

OPENCLAW_CONTINUITY_SESSION_ID="$continuity_session_id" OPENCLAW_REARM_ID="$rearm_id" node - <<'EOF' "$RESULT_DIR"
const fs = require("node:fs");
const path = require("node:path");
const resultDirectory = process.argv[2];
const readResult = (name) => JSON.parse(fs.readFileSync(path.join(resultDirectory, `${name}.json`), "utf8"));
const ready = readResult("ready");
const preview = readResult("preview");
const dryRun = readResult("dry-run");
const paused = readResult("paused");
const blocked = readResult("blocked");
const resumed = readResult("resumed");
const run = readResult("run");
const continuityBlocked = readResult("continuity-blocked");
const continuityRestored = readResult("continuity-restored");
const continuityResumed = readResult("continuity-resumed");
const scheduledArm = readResult("scheduled-arm");
const scheduledTick = readResult("scheduled-tick");
const rearmPaused = readResult("rearm-paused");
const rearmed = readResult("rearmed");
const cancelledSchedule = readResult("cancelled-schedule");
const windowArm = readResult("window-arm");
const windowFirst = readResult("window-first");
const windowSecond = readResult("window-second");
const missionArm = readResult("mission-arm");
const missionFirst = readResult("mission-first");
const missionPaused = readResult("mission-paused");
const missionRearmed = readResult("mission-rearmed");
const missionRenewed = readResult("mission-renewed");
const missionSecond = readResult("mission-second");
const missionFinal = readResult("mission-final");
const missionRestartState = readResult("mission-restart-state");
const missionRestartRearmed = readResult("mission-restart-rearmed");
const missionRestartCancelled = readResult("mission-restart-cancelled");
const worklistBeforeBindSummary = readResult("worklist-before-bind-summary");
const worklistMissionArm = readResult("worklist-mission-arm");
const worklistBound = readResult("worklist-bound");
const worklistAfterBindSummary = readResult("worklist-after-bind-summary");
const worklistFirst = readResult("worklist-first");
const worklistSecond = readResult("worklist-second");
const worklistFinalTasks = readResult("worklist-final-tasks");
const finalState = readResult("final");

if (finalState.operator?.status !== "idle" || finalState.operator?.summary?.counts?.completed !== 7) {
  throw new Error("final operator state should be idle with seven completed tasks");
}
const restoredSession = continuityRestored.runSessions?.find((item) => item.id === process.env.OPENCLAW_CONTINUITY_SESSION_ID);
  if (continuityBlocked.runSession?.status !== "paused"
  || restoredSession?.status !== "paused"
  || continuityResumed.runSession?.status !== "completed"
  || continuityResumed.runSession?.resumeCount !== 1) {
  throw new Error("operator session continuity evidence is incomplete");
}
if (scheduledArm.schedule?.status !== "armed"
  || scheduledTick.schedule?.status !== "completed"
  || rearmPaused.schedules?.find((item) => item.id === process.env.OPENCLAW_REARM_ID)?.status !== "paused"
  || rearmed.schedule?.status !== "armed"
  || cancelledSchedule.schedule?.status !== "cancelled") {
  throw new Error("bounded operator schedule evidence is incomplete");
}
if (windowArm.lease?.status !== "armed"
  || windowFirst.lease?.status !== "armed"
  || windowFirst.lease?.windowsCompleted !== 1
  || windowSecond.lease?.status !== "completed"
  || windowSecond.lease?.remainingWindows !== 0) {
  throw new Error("bounded operator window lease evidence is incomplete");
}
const restartMission = missionRestartState.missions?.find((item) => item.id === process.env.OPENCLAW_RESTART_MISSION_ID);
if (missionArm.mission?.status !== "armed"
  || missionFirst.mission?.epochsCompleted !== 1
  || missionPaused.mission?.status !== "paused"
  || missionRearmed.mission?.status !== "armed"
  || missionRenewed.mission?.renewalCount !== 1
  || missionSecond.mission?.epochsCompleted !== 2
  || missionFinal.mission?.status !== "completed"
  || missionFinal.mission?.progressPercent !== 100
  || restartMission?.status !== "paused"
  || missionRestartRearmed.mission?.status !== "armed"
  || missionRestartCancelled.mission?.status !== "cancelled") {
  throw new Error("renewable operator mission evidence is incomplete");
}
const beforeBindCounts = worklistBeforeBindSummary.summary?.counts ?? {};
const afterBindCounts = worklistAfterBindSummary.summary?.counts ?? {};
const worklistItems = worklistSecond.worklist?.items ?? [];
const worklistTasks = worklistFinalTasks.items?.filter((task) => (
  worklistItems.some((item) => item.issuedTaskId === task.id)
)) ?? [];
if (beforeBindCounts.total !== 5
  || afterBindCounts.total !== beforeBindCounts.total
  || afterBindCounts.active !== 0
  || worklistMissionArm.mission?.epochsConsumed !== 0
  || worklistBound.worklist?.issuedCount !== 0
  || worklistFirst.worklist?.items?.[1]?.status !== "pending"
  || worklistSecond.worklist?.status !== "completed"
  || worklistTasks.length !== 2
  || worklistTasks.find((task) => task.id === worklistItems[0]?.issuedTaskId)?.goal !== "Reviewed mission worklist task one"
  || worklistTasks.find((task) => task.id === worklistItems[1]?.issuedTaskId)?.goal !== "Reviewed mission worklist task two"
  || worklistTasks.some((task) => task.status !== "completed")
  || worklistFinalTasks.summary?.counts?.total !== beforeBindCounts.total + 2) {
  throw new Error("reviewed finite mission worklist task issuance evidence is incomplete");
}

console.log(JSON.stringify({
  operatorControl: {
    stateFile: process.env.OPENCLAW_CORE_STATE_FILE ?? null,
    policy: ready.operator?.policy ?? null,
  },
  dryRun: {
    ran: dryRun.ran,
    reason: dryRun.reason,
    taskStatus: dryRun.task?.status ?? null,
  },
  queuePreview: {
    taskId: preview.nextTask?.id ?? null,
    maximumSteps: preview.session?.maximumSteps ?? null,
    status: preview.session?.status ?? null,
    openLoop: preview.session?.governance?.openLoop ?? null,
  },
  windowLease: {
    registry: windowSecond.lease?.registry ?? null,
    windowsCompleted: windowSecond.lease?.windowsCompleted ?? null,
    remainingWindows: windowSecond.lease?.remainingWindows ?? null,
    stopReason: windowSecond.lease?.stopReason ?? null,
    automaticContinuationWithinLease: windowSecond.lease?.governance?.automaticContinuationWithinLease ?? null,
    automaticRepeat: windowSecond.lease?.governance?.automaticRepeat ?? null,
  },
  renewableMission: {
    registry: missionFinal.mission?.registry ?? null,
    missionId: missionFinal.mission?.id ?? null,
    epochsAuthorized: missionFinal.mission?.epochsAuthorized ?? null,
    epochsCompleted: missionFinal.mission?.epochsCompleted ?? null,
    progressPercent: missionFinal.mission?.progressPercent ?? null,
    renewalCount: missionFinal.mission?.renewalCount ?? null,
    stopReason: missionFinal.mission?.stopReason ?? null,
    restartStatus: restartMission?.status ?? null,
    restartRearmed: missionRestartRearmed.mission?.status ?? null,
    restartCancelled: missionRestartCancelled.mission?.status ?? null,
    automaticRetry: missionFinal.mission?.governance?.automaticRetry ?? null,
  },
  reviewedMissionWorklist: {
    registry: worklistSecond.worklist?.registry ?? null,
    missionId: worklistSecond.worklist?.missionId ?? null,
    itemCount: worklistSecond.worklist?.itemCount ?? null,
    issuedCount: worklistSecond.worklist?.issuedCount ?? null,
    completedCount: worklistSecond.worklist?.completedCount ?? null,
    taskIds: worklistItems.map((item) => item.issuedTaskId),
    taskGoals: worklistItems.map((item) => (
      worklistTasks.find((task) => task.id === item.issuedTaskId)?.goal ?? null
    )),
    bindingCreatedTasks: afterBindCounts.total - beforeBindCounts.total,
    stopReason: worklistSecond.mission?.stopReason ?? null,
    automaticRetry: worklistSecond.worklist?.governance?.automaticRetry ?? null,
    automaticSkip: worklistSecond.worklist?.governance?.automaticSkip ?? null,
  },
  pauseGate: {
    status: paused.operator?.status ?? null,
    blocked: blocked.blocked,
    reason: blocked.reason,
    pausedCount: blocked.summary?.counts?.paused ?? null,
  },
  resume: {
    taskStatus: resumed.task?.status ?? null,
    runtimeStatus: resumed.runtime?.status ?? null,
  },
  run: {
    ran: run.ran,
    count: run.count,
    taskStatus: run.steps?.[0]?.task?.status ?? null,
    verification: run.steps?.[0]?.execution?.verification?.ok ?? null,
    sessionStatus: run.runSession?.status ?? null,
    sessionStepsCompleted: run.runSession?.stepsCompleted ?? null,
  },
  continuity: {
    sessionId: process.env.OPENCLAW_CONTINUITY_SESSION_ID,
    pausedStatus: continuityBlocked.runSession?.status ?? null,
    restoredStatus: restoredSession?.status ?? null,
    restoredRemainingSteps: restoredSession?.remainingSteps ?? null,
    resumedStatus: continuityResumed.runSession?.status ?? null,
    resumedStepsCompleted: continuityResumed.runSession?.stepsCompleted ?? null,
    resumedRemainingSteps: continuityResumed.runSession?.remainingSteps ?? null,
    automaticResume: continuityResumed.runSession?.governance?.automaticResume ?? null,
  },
  schedule: {
    scheduledId: scheduledArm.schedule?.id ?? null,
    tickStatus: scheduledTick.schedule?.status ?? null,
    restartStatus: rearmPaused.schedules?.find((item) => item.id === process.env.OPENCLAW_REARM_ID)?.status ?? null,
    rearmedStatus: rearmed.schedule?.status ?? null,
    cancelledStatus: cancelledSchedule.schedule?.status ?? null,
    automaticRetry: scheduledTick.schedule?.governance?.automaticRetry ?? null,
  },
  final: {
    status: finalState.operator?.status ?? null,
    counts: finalState.operator?.summary?.counts ?? null,
  },
}, null, 2));
EOF
