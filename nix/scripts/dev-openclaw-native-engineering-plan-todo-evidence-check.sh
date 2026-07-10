#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-engineering-plan-todo-evidence-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-10200}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-10201}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-10202}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-10203}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-10204}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-10205}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-10206}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-10207}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-10208}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-engineering-plan-todo-evidence-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-engineering-plan-todo-evidence-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR"
printf '%s\n' '{"name":"openclaw","private":true,"scripts":{"typecheck":"node --check src/index.mjs"}}' > "$WORKSPACE_DIR/package.json"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${TASK_FILE:-}" \
    "${BEFORE_FILE:-}" \
    "${EVIDENCE_FILE:-}" \
    "${STORAGE_FILE:-}" \
    "${STORED_EVIDENCE_FILE:-}" \
    "${AFTER_FILE:-}" \
    "${ADAPTER_FILE:-}" \
    "${LINKED_TASK_FILE:-}" \
    "${LINKED_TASK_READBACK_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

TASK_FILE="$(mktemp)"
BEFORE_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"
STORAGE_FILE="$(mktemp)"
STORED_EVIDENCE_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
ADAPTER_FILE="$(mktemp)"
LINKED_TASK_FILE="$(mktemp)"
LINKED_TASK_READBACK_FILE="$(mktemp)"

post_json "$CORE_URL/tasks/plan" '{
  "goal": "Expose native engineering plan todo evidence",
  "type": "system_task",
  "targetUrl": "https://example.test/openclaw-plan-todo",
  "actions": [
    { "phase": "inspect", "kind": "screen.observe", "params": {} },
    { "phase": "implement", "kind": "task.complete", "params": {} }
  ]
}' > "$TASK_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$BEFORE_FILE"

task_id="$(node - <<'EOF' "$TASK_FILE"
const fs = require("node:fs");
const taskResponse = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!taskResponse.ok || !taskResponse.task?.id || !taskResponse.plan?.steps?.length) {
  throw new Error(`planned task fixture mismatch: ${JSON.stringify(taskResponse)}`);
}
process.stdout.write(taskResponse.task.id);
EOF
)"

todos_query="$(node - <<'EOF'
const todos = [
  { id: "read", description: "Read enhanced PlanModeTool semantics", status: "done" },
  { id: "surface", description: "Expose visible OpenClaw task/workbench evidence", status: "in_progress" },
  { id: "verify", description: "Validate endpoint and Observer visibility", status: "pending" }
];
process.stdout.write(encodeURIComponent(JSON.stringify(todos)));
EOF
)"

curl --silent --fail \
  "$CORE_URL/plugins/native-adapter/engineering-plan-todo/evidence?taskId=$task_id&limit=999&planSummary=bounded-planning-summary&confirmedPlan=bounded-confirmed-plan&todosJson=$todos_query" \
  > "$EVIDENCE_FILE"
storage_body="$(node - <<'EOF' "$task_id"
const taskId = process.argv[2];
const todos = [
  { id: "stored-read", description: "Persist visible workbench todo state", status: "done" },
  { id: "stored-use", description: "Verify persisted workbench state through evidence", status: "in_progress" },
  { id: "stored-verify", description: "Keep todo files and task mutation blocked", status: "pending" }
];
process.stdout.write(JSON.stringify({
  confirm: true,
  taskId,
  source: "openclaw-native-engineering-plan-todo-evidence-check",
  planSummary: "stored-bounded-planning-summary",
  confirmedPlan: "stored-bounded-confirmed-plan",
  todos,
}));
EOF
)"
post_json "$CORE_URL/plugins/native-adapter/engineering-plan-todo/workbench-state" "$storage_body" > "$STORAGE_FILE"
curl --silent --fail \
  "$CORE_URL/plugins/native-adapter/engineering-plan-todo/evidence?taskId=$task_id&limit=999" \
  > "$STORED_EVIDENCE_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$AFTER_FILE"
curl --silent --fail "$CORE_URL/plugins/openclaw-native-plugin-adapter" > "$ADAPTER_FILE"
linked_task_body="$(node - <<'EOF' "$task_id" "$STORAGE_FILE"
const fs = require("node:fs");
const taskId = process.argv[2];
const storage = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
process.stdout.write(JSON.stringify({
  proposalId: "openclaw:typecheck",
  workspaceId: "openclaw",
  scriptName: "typecheck",
  query: "verify",
  engineeringPlanTodoSuggestionLink: {
    sourceRegistry: "openclaw-native-engineering-plan-todo-next-action-v0",
    sourceTaskId: taskId,
    sourceWorkbenchRevision: storage.record.revision,
    currentTodoId: "stored-use",
    currentTodoStatus: "in_progress",
    actionId: "create_verification_task",
    expectedObserverControlId: "engineering-verification-task-button",
    existingCapabilityId: "act.openclaw.engineering_tool.verify"
  },
  confirm: true
}));
EOF
)"
post_json "$CORE_URL/plugins/native-adapter/source-command-proposals/tasks" "$linked_task_body" > "$LINKED_TASK_FILE"
linked_task_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(data.task.id);' "$LINKED_TASK_FILE")"
curl --silent --fail "$CORE_URL/tasks/$linked_task_id" > "$LINKED_TASK_READBACK_FILE"

node - <<'EOF' "$TASK_FILE" "$BEFORE_FILE" "$EVIDENCE_FILE" "$STORAGE_FILE" "$STORED_EVIDENCE_FILE" "$AFTER_FILE" "$ADAPTER_FILE" "$LINKED_TASK_FILE" "$LINKED_TASK_READBACK_FILE" "$WORKSPACE_DIR"
const fs = require("node:fs");
const path = require("node:path");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const taskResponse = readJson(2);
const before = readJson(3);
const evidence = readJson(4);
const storage = readJson(5);
const storedEvidence = readJson(6);
const after = readJson(7);
const adapter = readJson(8);
const linkedTask = readJson(9);
const linkedTaskReadback = readJson(10);
const workspaceDir = process.argv[11];
const todoPath = path.join(workspaceDir, ".openclaw", "cc-todo.md");
const raw = JSON.stringify({ evidence, storage, storedEvidence, adapter });

if (before.summary?.counts?.total !== after.summary?.counts?.total || before.summary?.counts?.total !== 1) {
  throw new Error(`plan/todo evidence endpoint should not create tasks: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
}
if (fs.existsSync(todoPath)) {
  throw new Error(`plan/todo evidence endpoint must not write ${todoPath}`);
}
if (
  !evidence.ok
  || evidence.registry !== "openclaw-native-engineering-plan-todo-evidence-v0"
  || evidence.mode !== "planning-todo-evidence-only"
  || evidence.capability?.id !== "sense.openclaw.engineering_context.plan_todo_evidence"
  || evidence.sourceCapability?.sourceToolNames?.length !== 3
  || evidence.summary?.taskPlanCount !== 1
  || evidence.summary?.queryTodoCount !== 3
  || evidence.summary?.workbenchTodoCount !== 0
  || evidence.summary?.evidenceTodoCounts?.done !== 1
  || evidence.summary?.evidenceTodoCounts?.in_progress !== 1
  || evidence.summary?.evidenceTodoCounts?.pending !== 1
  || evidence.taskPlanEvidence?.selectedTaskId !== taskResponse.task?.id
  || evidence.taskPlanEvidence?.items?.[0]?.plan?.stepCount < 2
  || evidence.planningEvidence?.enter?.hiddenModeCreated !== false
  || evidence.planningEvidence?.exit?.executionTransitionCreated !== false
  || evidence.planningEvidence?.todoWrite?.todoPathWritten !== false
  || evidence.planningEvidence?.todoWrite?.taskStateMutated !== false
  || evidence.governance?.canSwitchHiddenAgentMode !== false
  || evidence.governance?.canWriteTodoFile !== false
  || evidence.governance?.canMutateTaskState !== false
  || evidence.governance?.canCreateTask !== false
  || evidence.governance?.canCreateApproval !== false
  || evidence.governance?.canExecuteCommand !== false
  || evidence.governance?.canCallProvider !== false
  || evidence.bounds?.noTodoFileWrite !== true
  || evidence.auditEvidence?.operation !== "plan_todo_evidence"
) {
  throw new Error(`plan/todo evidence mismatch: ${JSON.stringify(evidence)}`);
}
if (
  !storage.ok
  || storage.registry !== "openclaw-native-engineering-plan-todo-workbench-storage-v0"
  || storage.record?.taskId !== taskResponse.task?.id
  || storage.record?.counts?.total !== 3
  || storage.record?.governance?.persistedInCoreState !== true
  || storage.record?.governance?.writesTodoFile !== false
  || storage.record?.governance?.mutatesTaskState !== false
  || storage.record?.governance?.executesCommand !== false
  || storage.record?.governance?.callsProvider !== false
) {
  throw new Error(`plan/todo workbench storage mismatch: ${JSON.stringify(storage)}`);
}
if (
  !storedEvidence.ok
  || storedEvidence.registry !== "openclaw-native-engineering-plan-todo-evidence-v0"
  || storedEvidence.summary?.todoSource !== "workbench_storage"
  || storedEvidence.summary?.workbenchTodoCount !== 3
  || storedEvidence.summary?.evidenceTodoCounts?.done !== 1
  || storedEvidence.summary?.evidenceTodoCounts?.in_progress !== 1
  || storedEvidence.summary?.evidenceTodoCounts?.pending !== 1
  || storedEvidence.planningEvidence?.todoWrite?.workbenchStatePersisted !== true
  || storedEvidence.planningEvidence?.todoWrite?.todoPathWritten !== false
  || storedEvidence.planningEvidence?.todoWrite?.taskStateMutated !== false
  || storedEvidence.workbenchStorage?.persisted !== true
  || storedEvidence.nextGovernedActionSuggestion?.registry !== "openclaw-native-engineering-plan-todo-next-action-v0"
  || storedEvidence.nextGovernedActionSuggestion?.suggestion?.actionId !== "create_verification_task"
  || storedEvidence.nextGovernedActionSuggestion?.suggestion?.existingObserverControlId !== "engineering-verification-task-button"
  || storedEvidence.nextGovernedActionSuggestion?.suggestion?.createsTaskAutomatically !== false
  || storedEvidence.nextGovernedActionSuggestion?.suggestion?.executesAutomatically !== false
  || storedEvidence.nextGovernedActionSuggestion?.governance?.guidanceOnly !== true
  || storedEvidence.nextGovernedActionSuggestion?.governance?.createsTask !== false
  || storedEvidence.nextGovernedActionSuggestion?.governance?.executesCommand !== false
  || storedEvidence.governance?.canReadPersistedWorkbenchStorage !== true
  || storedEvidence.governance?.canWriteTodoFile !== false
  || storedEvidence.governance?.canMutateTaskState !== false
) {
  throw new Error(`stored plan/todo evidence mismatch: ${JSON.stringify(storedEvidence)}`);
}
if (
  !adapter.implementedCapabilities?.includes("sense.openclaw.engineering_context.plan_todo_evidence")
  || !adapter.implementedCapabilities?.includes("act.openclaw.engineering_context.plan_todo_workbench_state")
  || adapter.summary?.canReadEngineeringPlanTodoEvidence !== true
  || adapter.summary?.canPersistEngineeringPlanTodoWorkbenchState !== true
) {
  throw new Error(`native adapter missing plan/todo evidence capability: ${JSON.stringify(adapter)}`);
}
const suggestionLink = linkedTask.task?.engineeringPlanTodoSuggestionLink;
const readbackLink = linkedTaskReadback.task?.engineeringPlanTodoSuggestionLink;
if (
  !linkedTask.ok
  || linkedTask.task?.status !== "queued"
  || linkedTask.approval?.status !== "pending"
  || linkedTask.summary?.counts?.total !== 2
  || suggestionLink?.registry !== "openclaw-native-engineering-plan-todo-suggestion-link-v0"
  || suggestionLink?.source?.taskId !== taskResponse.task.id
  || suggestionLink?.source?.workbenchRevision !== storage.record.revision
  || suggestionLink?.source?.todoId !== "stored-use"
  || suggestionLink?.source?.todoStatus !== "in_progress"
  || suggestionLink?.action?.actionId !== "create_verification_task"
  || suggestionLink?.action?.expectedObserverControlId !== "engineering-verification-task-button"
  || suggestionLink?.action?.capabilityId !== "act.openclaw.engineering_tool.verify"
  || suggestionLink?.governance?.sourceRecomputedFromPersistedWorkbench !== true
  || suggestionLink?.governance?.arbitraryEndpointAllowed !== false
  || suggestionLink?.governance?.automaticApprovalAllowed !== false
  || suggestionLink?.governance?.automaticExecutionAllowed !== false
  || suggestionLink?.governance?.providerCallAllowed !== false
  || suggestionLink?.governance?.resultEnvelopeAllowed !== false
  || suggestionLink?.source?.description !== undefined
  || suggestionLink?.command !== undefined
  || suggestionLink?.endpoint !== undefined
  || JSON.stringify(readbackLink) !== JSON.stringify(suggestionLink)
) {
  throw new Error(`governed plan/todo suggestion task linkage mismatch: ${JSON.stringify({ linkedTask, linkedTaskReadback })}`);
}
for (const token of [
  "no hidden planning mode switch",
  "no .openclaw/cc-todo.md write",
  "no command execution",
  "no provider call",
]) {
  if (!raw.includes(token)) {
    throw new Error(`plan/todo evidence missing boundary token: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawNativeEngineeringPlanTodoEvidence: {
    registry: evidence.registry,
    storageRegistry: storage.registry,
    taskId: taskResponse.task.id,
    todos: storedEvidence.summary.evidenceTodoCounts.total,
    todoSource: storedEvidence.summary.todoSource,
    linkedTaskId: linkedTask.task.id,
    linkedAction: suggestionLink.action.actionId,
    todoFileWritten: fs.existsSync(todoPath),
  },
}, null, 2));
EOF
