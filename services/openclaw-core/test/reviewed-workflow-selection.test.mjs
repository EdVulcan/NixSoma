import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewedWorkflowSelection,
  buildReviewedWorkflowAcceptance,
  compactReviewedWorkflowOutcome,
  listReviewedWorkflowRecipes,
  normaliseReviewedWorkflowAcceptance,
  reviewedWorkflowOutcomeHash,
  reviewedWorkflowOutcomeComplete,
} from "../src/reviewed-workflow-selection.mjs";

test("reviewed workflow selection exposes only the four fixed server recipes", () => {
  const recipes = listReviewedWorkflowRecipes();
  assert.deepEqual(recipes.map((recipe) => recipe.workflowId), [
    "bounded_run",
    "semantic_form_workflow",
    "native_intake_workflow",
    "reviewed_multi_application_mission",
  ]);
  assert.ok(recipes.every((recipe) => /^[a-f0-9]{64}$/u.test(recipe.selectionHash)));
  assert.equal(recipes[0].maximumProviderCalls, 2);
  assert.deepEqual(recipes.at(-1).fixedApplicationOrder, [
    "fixed_browser_form",
    "fixed_native_intake",
  ]);
});

test("workflow selection binds goal-compatible native recipes and rejects incompatible goals", () => {
  const native = buildReviewedWorkflowSelection({
    workflowId: "native_intake_workflow",
    goal: 'Type exact text "VALUE" into the active surface',
  });
  assert.equal(native.workflowRegistry, "nixsoma-ai-workspace-native-intake-workflow-v0");
  assert.throws(
    () => buildReviewedWorkflowSelection({ workflowId: "native_intake_workflow", goal: "Inspect the form" }),
    /fixed recipe compatible/u,
  );
  assert.throws(
    () => buildReviewedWorkflowSelection({ workflowId: "not-a-recipe", goal: "Inspect the form" }),
    /fixed recipe compatible/u,
  );
});

test("workflow outcome is compact and requires the selected recipe completion audit", () => {
  const selection = buildReviewedWorkflowSelection({ workflowId: "bounded_run", goal: "Inspect the form" });
  const response = {
    ok: true,
    invoked: true,
    blocked: false,
    invocation: { id: "invocation-1" },
    summary: {
      status: "completed",
      taskId: "task-1",
      objectiveContentHash: "a".repeat(64),
      taskVersionHash: "b".repeat(64),
      runCompletionAudit: true,
      providerCallCount: 2,
      actionCount: 2,
      outcomeUnknown: false,
    },
  };
  const outcome = compactReviewedWorkflowOutcome({ selection, response });
  assert.equal(reviewedWorkflowOutcomeComplete(outcome, selection, "task-1"), true);
  assert.equal(JSON.stringify(outcome).includes("VALUE"), false);
  assert.equal(reviewedWorkflowOutcomeComplete(
    { ...outcome, completionAudit: false },
    selection,
    "task-1",
  ), false);
});

test("workflow acceptance binds the exact outcome and rejects receipt tampering", () => {
  const selection = buildReviewedWorkflowSelection({ workflowId: "bounded_run", goal: "Inspect the form" });
  const outcome = compactReviewedWorkflowOutcome({
    selection,
    response: {
      ok: true,
      invoked: true,
      blocked: false,
      invocation: { id: "invocation-acceptance" },
      summary: {
        status: "completed",
        taskId: "task-acceptance",
        runCompletionAudit: true,
        outcomeUnknown: false,
      },
    },
  });
  const receipt = buildReviewedWorkflowAcceptance({
    worklistId: "worklist-1",
    missionId: "mission-1",
    itemId: "item-1",
    itemOrdinal: 1,
    taskId: "task-acceptance",
    workflowSelection: selection,
    outcomeHash: reviewedWorkflowOutcomeHash(outcome),
    acceptedAt: "2026-08-07T12:00:00.000Z",
  });
  assert.equal(receipt.explicitOperatorConfirmation, true);
  assert.equal(receipt.providerCalled, false);
  assert.equal(receipt.actionExecuted, false);
  assert.deepEqual(
    normaliseReviewedWorkflowAcceptance(receipt, {
      worklistId: "worklist-1",
      missionId: "mission-1",
      itemId: "item-1",
      itemOrdinal: 1,
      taskId: "task-acceptance",
      workflowSelection: selection,
      outcomeHash: reviewedWorkflowOutcomeHash(outcome),
      acceptedAt: receipt.acceptedAt,
    }),
    receipt,
  );
  assert.equal(
    normaliseReviewedWorkflowAcceptance(
      { ...receipt, outcomeHash: "a".repeat(64) },
      {
        worklistId: "worklist-1",
        missionId: "mission-1",
        itemId: "item-1",
        itemOrdinal: 1,
        taskId: "task-acceptance",
        workflowSelection: selection,
        outcomeHash: reviewedWorkflowOutcomeHash(outcome),
        acceptedAt: receipt.acceptedAt,
      },
    ),
    null,
  );
});
