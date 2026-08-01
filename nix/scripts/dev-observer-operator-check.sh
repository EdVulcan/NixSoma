#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://www.baidu.com"

export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-observer-operator-$$}"
OPENCLAW_DEV_RUN_ID="$(printf '%s' "$OPENCLAW_DEV_RUN_ID" | tr -c 'A-Za-z0-9_.-' '-')"
export OPENCLAW_DEV_RUN_ID
unset OPENCLAW_OPERATOR_TOKEN OPENCLAW_OPERATOR_TOKEN_FILE
export OPENCLAW_OPERATOR_TOKEN_FILE="$REPO_ROOT/.artifacts/openclaw-operator-token-$OPENCLAW_DEV_RUN_ID"
export OPENCLAW_EVENT_LOG_FILE="$REPO_ROOT/.artifacts/openclaw-events-$OPENCLAW_DEV_RUN_ID.jsonl"
export OPENCLAW_DEV_STATE_FILE="$REPO_ROOT/.artifacts/dev-services-unix-$OPENCLAW_DEV_RUN_ID.tsv"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5600}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5601}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5602}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5603}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5604}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5605}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5606}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5607}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5670}"
export OPENCLAW_CORE_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-core-observer-operator-$OPENCLAW_DEV_RUN_ID.json"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="$REPO_ROOT/.artifacts/openclaw-system-heal-observer-operator-$OPENCLAW_DEV_RUN_ID.json"

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

const requiredHtml = [
  "create-planned-task-button",
  "operator-step-button",
  "operator-preview-button",
  "operator-run-button",
  "operator-run-limit-input",
  "operator-schedule-arm-button",
  "operator-schedule-rearm-button",
  "operator-schedule-cancel-button",
  "operator-schedule-delay-input",
  "operator-window-count-input",
  "operator-window-steps-input",
  "operator-window-interval-input",
  "operator-window-deadline-input",
  "operator-window-arm-button",
  "operator-window-rearm-button",
  "operator-window-cancel-button",
  "Arm Window Lease",
  "Schedule Queue",
  "Re-arm Paused Schedule",
  "run-selected-reviewed-cycle-button",
  "accept-selected-reviewed-assessment-button",
  "rebind-selected-reviewed-task-button",
  "Accept Selected Assessment",
  "Run + Assess Selected Task",
  "Rebind Selected Task",
  "Preview Queue",
  "Run Queue",
  "task-plan-json",
  "operator-loop-json",
];
const requiredClient = [
  "/tasks/plan",
  "/operator/step",
  "/operator/run",
  "/operator/schedule",
  "/operator/schedule/",
  "/operator/window",
  "/operator/window/",
  "task.planned",
  "renderTaskPlan",
  "renderOperatorPanel",
  "boundedOperatorRunLimit",
  "boundedOperatorScheduleDelayMs",
  "refreshOperatorSchedule",
  "scheduleOperatorRunFromUi",
  "rearmOperatorScheduleFromUi",
  "cancelOperatorScheduleFromUi",
  "armOperatorWindowFromUi",
  "rearmOperatorWindowFromUi",
  "cancelOperatorWindowFromUi",
  "boundedOperatorWindowDeadlineMs",
  "JSON.stringify({ maxSteps, dryRun })",
  "runSelectedReviewedWorkspaceCycleFromUi",
  "act.ai.workspace.reviewed_cycle",
  "acceptSelectedReviewedWorkspaceAssessmentFromUi",
  "act.ai.workspace.accept_assessment",
  "rebindSelectedReviewedTaskFromUi",
  "act.openclaw.engineering_context.work_view_bind",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

planned_task="$(post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Observer operator planned task\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"observer operator\"}},{\"kind\":\"mouse.click\",\"params\":{\"x\":560,\"y\":320,\"button\":\"left\"}}]}")"
assert_json "$planned_task" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.task?.status!=="queued" || data.plan?.status!=="planned"){throw new Error("planned task did not enter queued/planned state");}'

queue_preview="$(post_json "$CORE_URL/operator/run" '{"maxSteps":2,"dryRun":true}')"
assert_json "$queue_preview" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==false || data.dryRun!==true || data.nextTask?.id==null || data.session?.status!=="previewed" || data.session?.maximumSteps!==2){throw new Error("Observer bounded queue preview did not preserve queued task");}'

operator_step="$(post_json "$CORE_URL/operator/step" '{}')"
assert_json "$operator_step" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.ran || data.task?.status!=="completed" || data.task?.plan?.status!=="completed" || data.execution?.verification?.ok!==true){throw new Error("operator step did not complete planned task from observer milestone");}'

idle_run="$(post_json "$CORE_URL/operator/run" '{"maxSteps":2,"dryRun":false}')"
assert_json "$idle_run" 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.ran!==false || data.count!==0 || data.session?.status!=="run_requested" || data.session?.maximumSteps!==2){throw new Error("bounded operator run should be idle after single planned task");}'

summary="$(curl --silent "$CORE_URL/tasks/summary")"

RESULT_DIR="$(mktemp -d)"
printf '%s' "$planned_task" > "$RESULT_DIR/planned.json"
printf '%s' "$queue_preview" > "$RESULT_DIR/preview.json"
printf '%s' "$operator_step" > "$RESULT_DIR/step.json"
printf '%s' "$idle_run" > "$RESULT_DIR/idle.json"
printf '%s' "$summary" > "$RESULT_DIR/summary.json"

node - <<'EOF' "$RESULT_DIR"
const fs = require("node:fs");
const path = require("node:path");
const resultDirectory = process.argv[2];
const readResult = (name) => JSON.parse(fs.readFileSync(path.join(resultDirectory, `${name}.json`), "utf8"));
const planned = readResult("planned");
const preview = readResult("preview");
const step = readResult("step");
const idle = readResult("idle");
const summary = readResult("summary");

const counts = summary.summary?.counts ?? {};
if (counts.completed !== 1 || counts.active !== 0) {
  throw new Error(`unexpected observer operator task counts: ${JSON.stringify(counts)}`);
}

console.log(JSON.stringify({
  observerOperator: {
    htmlControls: [
      "create-planned-task-button",
      "operator-step-button",
      "operator-preview-button",
      "operator-run-button",
      "operator-run-limit-input",
      "run-selected-reviewed-cycle-button",
      "accept-selected-reviewed-assessment-button",
      "rebind-selected-reviewed-task-button",
    ],
    clientApis: [
      "/tasks/plan",
      "/operator/step",
      "/operator/run",
      "runSelectedReviewedWorkspaceCycleFromUi",
      "act.ai.workspace.reviewed_cycle",
      "acceptSelectedReviewedWorkspaceAssessmentFromUi",
      "act.ai.workspace.accept_assessment",
      "rebindSelectedReviewedTaskFromUi",
      "act.openclaw.engineering_context.work_view_bind",
    ],
    stateFile: process.env.OPENCLAW_CORE_STATE_FILE ?? null,
  },
  plannedTask: {
    id: planned.task?.id ?? null,
    initialStatus: planned.task?.status ?? null,
    initialPlanStatus: planned.plan?.status ?? null,
  },
  operatorStep: {
    ran: step.ran,
    taskId: step.task?.id ?? null,
    status: step.task?.status ?? null,
    planStatus: step.task?.plan?.status ?? null,
    verification: step.execution?.verification?.ok ?? null,
  },
  queuePreview: {
    taskId: preview.nextTask?.id ?? null,
    status: preview.session?.status ?? null,
    maximumSteps: preview.session?.maximumSteps ?? null,
  },
  idleRun: {
    ran: idle.ran,
    count: idle.count,
  },
  taskSummary: counts,
}, null, 2));
EOF
