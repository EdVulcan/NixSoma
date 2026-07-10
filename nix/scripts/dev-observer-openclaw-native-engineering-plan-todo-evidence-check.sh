#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-native-engineering-plan-todo-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10220}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10221}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10222}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10223}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10224}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10225}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10226}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10227}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10228}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-engineering-plan-todo-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-engineering-plan-todo-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${TASK_FILE:-}" \
    "${BEFORE_FILE:-}" \
    "${EVIDENCE_FILE:-}" \
    "${AFTER_FILE:-}"
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
BEFORE_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
post_json "$CORE_URL/tasks/plan" '{
  "goal": "Render native engineering plan todo evidence in Observer",
  "type": "system_task",
  "targetUrl": "https://example.test/openclaw-observer-plan-todo",
  "actions": [
    { "phase": "inspect", "kind": "screen.observe", "params": {} },
    { "phase": "render", "kind": "task.complete", "params": {} }
  ]
}' > "$TASK_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$BEFORE_FILE"

task_id="$(node - <<'EOF' "$TASK_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!taskResponse.ok || !taskResponse.task?.id || !taskResponse.plan?.steps?.length) {
  throw new Error(`observer planned task fixture mismatch: ${JSON.stringify(taskResponse)}`);
}
process.stdout.write(taskResponse.task.id);
EOF
)"

todos_query="$(node - <<'EOF'
const todos = [
  { id: "observer-html", description: "Expose stable Observer HTML tokens", status: "done" },
  { id: "observer-client", description: "Expose refresh and renderer tokens", status: "in_progress" },
  { id: "observer-proof", description: "Prove endpoint remains read-only", status: "pending" }
];
process.stdout.write(encodeURIComponent(JSON.stringify(todos)));
EOF
)"

curl --silent --fail \
  "$CORE_URL/plugins/native-adapter/engineering-plan-todo/evidence?taskId=$task_id&planSummary=observer-bounded-plan&confirmedPlan=observer-confirmed-plan&todosJson=$todos_query" \
  > "$EVIDENCE_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$AFTER_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASK_FILE" "$BEFORE_FILE" "$EVIDENCE_FILE" "$AFTER_FILE" "$WORKSPACE_DIR"
const fs = require("node:fs");
const path = require("node:path");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const taskResponse = readJson(4);
const before = readJson(5);
const evidence = readJson(6);
const after = readJson(7);
const workspaceDir = process.argv[8];
const todoPath = path.join(workspaceDir, ".openclaw", "cc-todo.md");

for (const token of [
  "Engineering Plan/Todo Evidence",
  "engineering-plan-todo-registry",
  "engineering-plan-todo-tasks",
  "engineering-plan-todo-todos",
  "engineering-plan-todo-done",
  "engineering-plan-todo-mutation",
  "engineering-plan-todo-save-button",
  "engineering-plan-todo-use-suggestion-button",
  "engineering-plan-todo-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing engineering plan/todo token: ${token}`);
  }
}
for (const token of [
  "/plugins/native-adapter/engineering-plan-todo/evidence",
  "/plugins/native-adapter/engineering-plan-todo/workbench-state",
  "refreshEngineeringPlanTodoEvidence",
  "renderEngineeringPlanTodoEvidence",
  "saveEngineeringPlanningWorkbenchState",
  "useEngineeringPlanningSuggestedAction",
  "currentEngineeringPlanTodoSuggestion",
  "GOVERNED_PLAN_TODO_SUGGESTION_CONTROLS",
  "create_verification_task",
  "engineering-verification-task-button",
  "Native engineering plan/todo evidence",
  "workbench_storage",
  "Next Governed Action",
  "openclaw-native-engineering-plan-todo-next-action-v0",
  "sense.openclaw.engineering_context.plan_todo_evidence",
  "planning-todo-evidence-only",
  "cc_plan_enter",
  "cc_plan_exit",
  "cc_todo_write",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing engineering plan/todo token: ${token}`);
  }
}
if (before.summary?.counts?.total !== after.summary?.counts?.total || before.summary?.counts?.total !== 1) {
  throw new Error(`Observer plan/todo endpoint should not create tasks: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
}
if (fs.existsSync(todoPath)) {
  throw new Error(`Observer plan/todo evidence must not write ${todoPath}`);
}
if (
  !evidence.ok
  || evidence.registry !== "openclaw-native-engineering-plan-todo-evidence-v0"
  || evidence.summary?.queryTodoCount !== 3
  || evidence.summary?.evidenceTodoCounts?.total !== 3
  || evidence.taskPlanEvidence?.selectedTaskId !== taskResponse.task?.id
  || evidence.governance?.canSwitchHiddenAgentMode !== false
  || evidence.governance?.canWriteTodoFile !== false
  || evidence.governance?.canMutateTaskState !== false
  || evidence.governance?.canExecuteCommand !== false
  || evidence.governance?.canCallProvider !== false
  || evidence.bounds?.noTodoFileWrite !== true
) {
  throw new Error(`Observer plan/todo evidence mismatch: ${JSON.stringify(evidence)}`);
}

console.log(JSON.stringify({
  observerOpenClawNativeEngineeringPlanTodoEvidence: {
    html: "visible",
    client: "visible",
    registry: evidence.registry,
    todos: evidence.summary.evidenceTodoCounts.total,
    todoFileWritten: fs.existsSync(todoPath),
  },
}, null, 2));
EOF
