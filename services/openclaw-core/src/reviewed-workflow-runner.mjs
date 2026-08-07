import {
  compactReviewedWorkflowOutcome,
  reviewedWorkflowOutcomeComplete,
  sameReviewedWorkflowSelection,
} from "./reviewed-workflow-selection.mjs";

function safeTaskId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactStep(task, outcome) {
  return {
    task: task ? { id: task.id, status: task.status ?? null } : null,
    workflowId: outcome?.workflowId ?? null,
    status: outcome?.status ?? null,
    actionCount: outcome?.actionCount ?? null,
    providerCallCount: outcome?.providerCallCount ?? null,
  };
}

export const REVIEWED_WORKFLOW_RUNNER_REGISTRY =
  "nixsoma-reviewed-workflow-runner-v0";

export function createReviewedWorkflowRunner({
  prepareTask,
  invokeCapability,
  hideWorkView,
  taskManager,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof prepareTask !== "function"
    || typeof invokeCapability !== "function"
    || typeof hideWorkView !== "function"
    || !taskManager
    || typeof taskManager.completeTask !== "function"
    || typeof taskManager.failTask !== "function"
    || typeof taskManager.recordReviewedWorkflowOutcome !== "function") {
    throw new Error("Reviewed workflow runner requires task preparation, capability, cleanup, and task owners.");
  }

  async function fail(task, reason, details = null) {
    const current = typeof taskManager.getTaskById === "function"
      ? taskManager.getTaskById(task?.id) ?? task
      : task;
    if (["completed", "failed", "superseded"].includes(current?.status)) return current;
    return taskManager.failTask(current, reason, {
      reviewedWorkflowRunner: REVIEWED_WORKFLOW_RUNNER_REGISTRY,
      ...(details && typeof details === "object" ? details : {}),
    });
  }

  async function run({ task, workflowSelection, missionId = null, worklistId = null, itemId = null } = {}) {
    const taskId = safeTaskId(task?.id);
    if (!taskId || !sameReviewedWorkflowSelection(task?.reviewedWorkflowSelection, workflowSelection)) {
      const failedTask = await fail(task, "reviewed_workflow_task_selection_mismatch", {
        workflowId: workflowSelection?.workflowId ?? null,
      });
      return {
        ok: false,
        ran: false,
        reason: "reviewed_workflow_task_selection_mismatch",
        task: failedTask,
        outcome: null,
        steps: [],
      };
    }

    let startAudit;
    try {
      startAudit = await publishAuditEvent("ai_workspace.reviewed_workflow_selection_started", {
        registry: REVIEWED_WORKFLOW_RUNNER_REGISTRY,
        at: now(),
        taskId,
        missionId,
        worklistId,
        itemId,
        workflowId: workflowSelection.workflowId,
        workflowRegistry: workflowSelection.workflowRegistry,
        selectionHash: workflowSelection.selectionHash,
        capabilityId: workflowSelection.capabilityId,
        automaticRetry: false,
        automaticRepeat: false,
      });
    } catch {
      startAudit = { ok: false };
    }
    if (startAudit?.ok !== true) {
      const failedTask = await fail(task, "reviewed_workflow_start_audit_unavailable");
      return {
        ok: false,
        ran: false,
        reason: "reviewed_workflow_start_audit_unavailable",
        task: failedTask,
        outcome: null,
        steps: [],
      };
    }

    let prepared = false;
    let taskAfterPreparation = task;
    try {
      taskAfterPreparation = await prepareTask(task);
      prepared = true;
    } catch {
      const failedTask = await fail(task, "reviewed_workflow_task_preparation_failed");
      return {
        ok: false,
        ran: false,
        reason: "reviewed_workflow_task_preparation_failed",
        task: failedTask,
        outcome: null,
        steps: [],
      };
    }

    let response;
    try {
      const invocation = await invokeCapability({
        capabilityId: workflowSelection.capabilityId,
        taskId,
        params: { confirm: true },
      });
      response = invocation?.response ?? invocation;
    } catch {
      response = {
        ok: false,
        invoked: false,
        blocked: true,
        summary: {
          status: "outcome_unknown",
          terminalReason: "reviewed_workflow_capability_failed",
          taskId,
          outcomeUnknown: true,
        },
      };
    }
    const outcome = compactReviewedWorkflowOutcome({
      selection: workflowSelection,
      response,
    });

    let cleanupOk = true;
    if (prepared) {
      try {
        const cleanup = await hideWorkView({ taskId, workflowSelection });
        cleanupOk = cleanup?.ok !== false && cleanup?.workView?.visibility !== "visible";
      } catch {
        cleanupOk = false;
      }
    }

    if (!cleanupOk) {
      const failedTask = await fail(taskAfterPreparation, "reviewed_workflow_cleanup_unknown", { outcome });
      return {
        ok: false,
        ran: response?.invoked === true,
        reason: "reviewed_workflow_cleanup_unknown",
        task: failedTask,
        outcome,
        steps: [compactStep(failedTask, outcome)],
      };
    }

    if (!reviewedWorkflowOutcomeComplete(outcome, workflowSelection, taskId)) {
      const failedTask = await fail(taskAfterPreparation, response?.reason ?? outcome.terminalReason ?? "reviewed_workflow_failed", {
        outcome,
      });
      return {
        ok: false,
        ran: response?.invoked === true,
        reason: response?.reason ?? outcome.terminalReason ?? "reviewed_workflow_failed",
        task: failedTask,
        outcome,
        steps: [compactStep(failedTask, outcome)],
      };
    }

    let completionAudit;
    try {
      completionAudit = await publishAuditEvent("ai_workspace.reviewed_workflow_selection_completed", {
        registry: REVIEWED_WORKFLOW_RUNNER_REGISTRY,
        at: now(),
        taskId,
        workflowId: workflowSelection.workflowId,
        workflowRegistry: workflowSelection.workflowRegistry,
        selectionHash: workflowSelection.selectionHash,
        outcome,
        automaticRetry: false,
        automaticRepeat: false,
      });
    } catch {
      completionAudit = { ok: false };
    }
    if (completionAudit?.ok !== true) {
      const failedTask = await fail(taskAfterPreparation, "reviewed_workflow_completion_audit_unavailable", {
        outcome,
      });
      return {
        ok: false,
        ran: true,
        reason: "reviewed_workflow_completion_audit_unavailable",
        task: failedTask,
        outcome,
        steps: [compactStep(failedTask, outcome)],
      };
    }
    try {
      taskManager.recordReviewedWorkflowOutcome(taskAfterPreparation, outcome);
    } catch {
      const failedTask = await fail(taskAfterPreparation, "reviewed_workflow_outcome_persistence_failed", {
        outcome,
      });
      return {
        ok: false,
        ran: true,
        reason: "reviewed_workflow_outcome_persistence_failed",
        task: failedTask,
        outcome,
        steps: [compactStep(failedTask, outcome)],
      };
    }
    const completedTask = taskManager.completeTask(taskAfterPreparation, {
      summary: `Completed reviewed workflow ${workflowSelection.workflowId}.`,
      reviewedWorkflowOutcome: outcome,
      workflow: {
        registry: REVIEWED_WORKFLOW_RUNNER_REGISTRY,
        workflowId: workflowSelection.workflowId,
        selectionHash: workflowSelection.selectionHash,
        completionAudit: true,
      },
    });
    return {
      ok: true,
      ran: true,
      reason: null,
      task: completedTask,
      outcome,
      steps: [compactStep(completedTask, outcome)],
    };
  }

  return { run };
}
