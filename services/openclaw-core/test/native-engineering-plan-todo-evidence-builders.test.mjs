import test from "node:test";
import assert from "node:assert/strict";

import { buildNativeEngineeringPlanTodoEvidence } from "../src/native-engineering-plan-todo-evidence-builders.mjs";

test("native engineering plan/todo evidence maps planning tools without mutation", () => {
  const response = buildNativeEngineeringPlanTodoEvidence({
    planSummary: "Review route, builder, Observer, and milestone wiring before implementation.",
    confirmedPlan: "Implement a read-only evidence endpoint, then validate it with targeted checks.",
    todos: [
      { id: "inspect", description: "Inspect existing native evidence surfaces", status: "done" },
      { id: "builder", description: "Add cohesive plan/todo evidence builder", status: "in_progress" },
      { id: "milestone", description: "Prove Observer visibility", status: "pending" },
    ],
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, "openclaw-native-engineering-plan-todo-evidence-v0");
  assert.equal(response.mode, "planning-todo-evidence-only");
  assert.equal(response.capability.id, "sense.openclaw.engineering_context.plan_todo_evidence");
  assert.equal(response.planningEvidence.enter.observed, true);
  assert.equal(response.planningEvidence.exit.observed, true);
  assert.equal(response.planningEvidence.todoWrite.observed, true);
  assert.equal(response.planningEvidence.todoWrite.todoPathWritten, false);
  assert.equal(response.planningEvidence.todoWrite.taskStateMutated, false);
  assert.equal(response.planningEvidence.todoWrite.counts.done, 1);
  assert.equal(response.planningEvidence.todoWrite.counts.in_progress, 1);
  assert.equal(response.planningEvidence.todoWrite.counts.pending, 1);
  assert.equal(response.governance.canSwitchHiddenAgentMode, false);
  assert.equal(response.governance.canWriteTodoFile, false);
  assert.equal(response.governance.canMutateTaskState, false);
  assert.equal(response.governance.canCreateTask, false);
  assert.equal(response.governance.canExecuteCommand, false);
  assert.equal(response.bounds.noTodoFileWrite, true);
  assert.equal(response.deferredExecutionBoundaries.includes("no .openclaw/cc-todo.md write"), true);
});

test("native engineering plan/todo evidence reads task plan steps as todo evidence", () => {
  const response = buildNativeEngineeringPlanTodoEvidence({
    tasks: new Map([
      ["task-plan-1", {
        id: "task-plan-1",
        type: "system_task",
        status: "running",
        goal: "Validate native planning evidence",
        plan: {
          planner: "rule-v1",
          strategy: "native-engineering-plan-todo-evidence",
          status: "running",
          summary: "Plan a bounded engineering capability slice.",
          steps: [
            { id: "read", title: "Read current route patterns", status: "completed", phase: "analysis" },
            { id: "wire", title: "Wire read-only endpoint", status: "running", phase: "implementation" },
            { id: "verify", title: "Run targeted milestone", status: "planned", phase: "validation" },
          ],
        },
      }],
    ]),
    runtimeState: { currentTaskId: "task-plan-1" },
  });

  assert.equal(response.summary.taskPlanCount, 1);
  assert.equal(response.summary.todoSource, "task_plan_steps");
  assert.equal(response.summary.evidenceTodoCounts.total, 3);
  assert.equal(response.summary.evidenceTodoCounts.done, 1);
  assert.equal(response.summary.evidenceTodoCounts.in_progress, 1);
  assert.equal(response.summary.evidenceTodoCounts.pending, 1);
  assert.equal(response.taskPlanEvidence.selectedTaskId, "task-plan-1");
  assert.equal(response.taskPlanEvidence.items[0].plan.stepCount, 3);
  assert.equal(response.taskPlanEvidence.items[0].todos[0].source, "task_plan_step");
  assert.equal(response.planningEvidence.todoWrite.items[1].taskId, "task-plan-1");
});

test("native engineering plan/todo evidence can guide the existing screen observation control", () => {
  const response = buildNativeEngineeringPlanTodoEvidence({
    todos: [
      { id: "observe-work-view", description: "Observe the current trusted AI work-view screen", status: "in_progress" },
    ],
  });

  assert.equal(response.nextGovernedActionSuggestion.suggestion.actionId, "observe_current_screen");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.existingObserverControlId, "invoke-screen-observation-button");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.existingCapabilityId, "sense.screen.observe");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.requiresApproval, false);
  assert.equal(response.nextGovernedActionSuggestion.governance.guidanceOnly, true);
});

test("native engineering plan/todo evidence prioritizes semantic click over generic work-view observation", () => {
  const response = buildNativeEngineeringPlanTodoEvidence({
    todos: [
      { id: "click-current-target", description: "Create a semantic click task for the current trusted work-view target", status: "in_progress" },
    ],
  });

  assert.equal(response.nextGovernedActionSuggestion.suggestion.actionId, "create_semantic_click_task");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.existingObserverControlId, "create-semantic-click-task-button");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.existingCapabilityId, "plan.openclaw.browser.semantic_click_task");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.requiresApproval, true);
});

test("native engineering plan/todo evidence reads governed workbench storage before task plan steps", () => {
  const response = buildNativeEngineeringPlanTodoEvidence({
    tasks: new Map([
      ["task-plan-2", {
        id: "task-plan-2",
        type: "system_task",
        status: "running",
        goal: "Validate persisted workbench state",
        plan: {
          planner: "rule-v1",
          strategy: "native-engineering-plan-todo-evidence",
          status: "running",
          summary: "Plan a persisted workbench state.",
          steps: [
            { id: "task-step", title: "Task plan step should remain fallback", status: "planned" },
          ],
        },
      }],
    ]),
    runtimeState: { currentTaskId: "task-plan-2" },
    workbenchRecords: new Map([
      ["task-plan-2", {
        key: "task-plan-2",
        recordId: "record-2",
        taskId: "task-plan-2",
        revision: 3,
        updatedAt: "2026-07-10T00:00:00.000Z",
        planSummaryPreview: "Stored planning summary",
        confirmedPlanPreview: "Stored confirmed plan",
        todos: [
          { id: "stored", description: "Verify persisted workbench todo state", status: "in_progress" },
        ],
      }],
    ]),
  });

  assert.equal(response.summary.todoSource, "workbench_storage");
  assert.equal(response.summary.workbenchTodoCount, 1);
  assert.equal(response.summary.evidenceTodoCounts.in_progress, 1);
  assert.equal(response.planningEvidence.enter.observed, true);
  assert.equal(response.planningEvidence.todoWrite.workbenchStatePersisted, true);
  assert.equal(response.planningEvidence.todoWrite.items[0].source, "workbench_storage");
  assert.equal(response.workbenchStorage.persisted, true);
  assert.equal(response.workbenchStorage.revision, 3);
  assert.equal(response.nextGovernedActionSuggestion.status, "suggested");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.actionId, "create_verification_task");
  assert.equal(response.nextGovernedActionSuggestion.suggestion.existingObserverControlId, "engineering-verification-task-button");
  assert.equal(response.nextGovernedActionSuggestion.governance.createsTask, false);
  assert.equal(response.nextGovernedActionSuggestion.governance.executesCommand, false);
  assert.equal(response.governance.canReadPersistedWorkbenchStorage, true);
  assert.equal(response.governance.canWriteTodoFile, false);
});

test("native engineering plan/todo evidence clamps query data and reports invalid todo JSON", () => {
  const response = buildNativeEngineeringPlanTodoEvidence({
    planSummary: "S".repeat(500),
    todosJson: "{not-json",
    limit: 999,
  });

  assert.equal(response.query.limit, 50);
  assert.equal(response.query.planSummaryChars, 240);
  assert.equal(typeof response.query.todosParseError, "string");
  assert.equal(response.summary.queryTodoCount, 0);
  assert.equal(response.governance.canCallProvider, false);
});
