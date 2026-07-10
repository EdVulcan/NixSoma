import test from "node:test";
import assert from "node:assert/strict";

import {
  NATIVE_ENGINEERING_PLAN_TODO_SUGGESTION_LINK_REGISTRY,
  buildNativeEngineeringPlanTodoSuggestionLink,
} from "../src/native-engineering-plan-todo-suggestion-link.mjs";

function createFixture() {
  const task = {
    id: "plan-task-1",
    status: "running",
  };
  const record = {
    recordId: "workbench-record-1",
    taskId: task.id,
    revision: 3,
    todoSha256: "todo-sha256",
    todos: [
      {
        id: "verify-current",
        description: "Verify the governed implementation",
        status: "in_progress",
      },
    ],
  };
  const input = {
    sourceRegistry: "openclaw-native-engineering-plan-todo-next-action-v0",
    sourceTaskId: task.id,
    sourceWorkbenchRevision: record.revision,
    currentTodoId: "verify-current",
    currentTodoStatus: "in_progress",
    actionId: "create_verification_task",
    expectedObserverControlId: "engineering-verification-task-button",
    existingCapabilityId: "act.openclaw.engineering_tool.verify",
    command: "must-not-be-copied",
    endpoint: "/must-not-be-copied",
  };
  return {
    input,
    records: new Map([[task.id, record]]),
    tasks: new Map([[task.id, task]]),
  };
}

test("plan/todo suggestion link derives compact provenance from persisted workbench state", () => {
  const fixture = createFixture();
  const link = buildNativeEngineeringPlanTodoSuggestionLink({
    ...fixture,
    expectedActionId: "create_verification_task",
    now: () => "2026-07-10T10:00:00.000Z",
  });

  assert.equal(link.registry, NATIVE_ENGINEERING_PLAN_TODO_SUGGESTION_LINK_REGISTRY);
  assert.equal(link.source.taskId, "plan-task-1");
  assert.equal(link.source.workbenchRevision, 3);
  assert.equal(link.source.todoId, "verify-current");
  assert.equal(link.source.todoStatus, "in_progress");
  assert.equal(link.action.actionId, "create_verification_task");
  assert.equal(link.action.expectedObserverControlId, "engineering-verification-task-button");
  assert.equal(link.governance.sourceRecomputedFromPersistedWorkbench, true);
  assert.equal(link.governance.arbitraryEndpointAllowed, false);
  assert.equal(link.governance.automaticApprovalAllowed, false);
  assert.equal(link.governance.automaticExecutionAllowed, false);
  assert.equal(link.governance.providerCallAllowed, false);
  assert.equal(link.governance.resultEnvelopeAllowed, false);
  assert.equal("description" in link.source, false);
  assert.equal("descriptionPreview" in link.source, false);
  assert.equal("command" in link, false);
  assert.equal("endpoint" in link, false);
});

test("plan/todo suggestion link rejects stale or cross-control task creation", () => {
  const fixture = createFixture();

  assert.throws(() => buildNativeEngineeringPlanTodoSuggestionLink({
    ...fixture,
    expectedActionId: "create_edit_proposal_task",
  }), /action does not match/u);

  assert.throws(() => buildNativeEngineeringPlanTodoSuggestionLink({
    ...fixture,
    input: {
      ...fixture.input,
      expectedObserverControlId: "engineering-edit-proposal-task-button",
    },
    expectedActionId: "create_verification_task",
  }), /Observer control mismatch/u);

  assert.throws(() => buildNativeEngineeringPlanTodoSuggestionLink({
    ...fixture,
    records: new Map(),
    expectedActionId: "create_verification_task",
  }), /persisted workbench state/u);
});
