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
printf '%s' "$final_state" > "$RESULT_DIR/final.json"

OPENCLAW_CONTINUITY_SESSION_ID="$continuity_session_id" node - <<'EOF' "$RESULT_DIR"
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
const finalState = readResult("final");

if (finalState.operator?.status !== "idle" || finalState.operator?.summary?.counts?.completed !== 2) {
  throw new Error("final operator state should be idle with two completed tasks");
}
const restoredSession = continuityRestored.runSessions?.find((item) => item.id === process.env.OPENCLAW_CONTINUITY_SESSION_ID);
if (continuityBlocked.runSession?.status !== "paused"
  || restoredSession?.status !== "paused"
  || continuityResumed.runSession?.status !== "completed"
  || continuityResumed.runSession?.resumeCount !== 1) {
  throw new Error("operator session continuity evidence is incomplete");
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
  final: {
    status: finalState.operator?.status ?? null,
    counts: finalState.operator?.summary?.counts ?? null,
  },
}, null, 2));
EOF
