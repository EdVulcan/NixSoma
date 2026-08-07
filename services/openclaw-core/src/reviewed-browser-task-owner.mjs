import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildReviewedBrowserTaskSubmission } from "./reviewed-browser-task-submission.mjs";
import {
  normaliseReviewedWorkflowSelection,
} from "./reviewed-workflow-selection.mjs";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function reviewedSource(value) {
  const registry = safeId(value?.registry);
  const worklistId = safeId(value?.worklistId);
  const missionId = safeId(value?.missionId);
  const itemId = safeId(value?.itemId);
  const blueprintHash = typeof value?.blueprintHash === "string" && SHA256.test(value.blueprintHash)
    ? value.blueprintHash
    : null;
  const itemOrdinal = Number.isInteger(value?.itemOrdinal) && value.itemOrdinal > 0 && value.itemOrdinal <= 16
    ? value.itemOrdinal
    : null;
  const hasWorkflowSelection = value?.workflowSelection !== undefined;
  const workflowSelection = hasWorkflowSelection
    ? normaliseReviewedWorkflowSelection(value.workflowSelection)
    : null;
  if (!registry || !worklistId || !missionId || !itemId || !blueprintHash || !itemOrdinal
    || (hasWorkflowSelection && !workflowSelection)) {
    return null;
  }
  return {
    registry,
    worklistId,
    missionId,
    itemId,
    itemOrdinal,
    blueprintHash,
    ...(workflowSelection ? { workflowSelection } : {}),
  };
}

export function createReviewedBrowserTaskOwner({
  taskManager,
  approvalEngine,
  planBuilder,
  publishEvent,
} = {}) {
  if (!taskManager || !approvalEngine || !planBuilder || typeof publishEvent !== "function") {
    throw new Error("Reviewed browser task owner requires task, approval, plan, and event owners.");
  }

  async function publishReclaimedTasks(reclaimedTasks) {
    await Promise.all(reclaimedTasks.map((task) => publishEvent(createEventName("task.phase_changed"), {
      task: taskManager.serialiseTask(task),
    })));
  }

  async function create(body, { source = null } = {}) {
    const submission = buildReviewedBrowserTaskSubmission(body);
    const sourceReceipt = source ? reviewedSource(source) : null;
    if (source && !sourceReceipt) {
      throw new Error("Reviewed browser task source receipt is invalid.");
    }
    const task = taskManager.createTask(submission.taskInput, {
      serverExtensions: sourceReceipt?.workflowSelection
        ? { reviewedWorkflowSelection: sourceReceipt.workflowSelection }
        : {},
    });
    const reclaimedTasks = taskManager.supersedeOtherActiveTasks(task.id);
    taskManager.reconcileRuntimeState();

    await publishEvent(createEventName("task.created"), {
      task: taskManager.serialiseTask(task),
      submission: submission.review,
      reviewedSource: sourceReceipt,
    });
    await approvalEngine.publishTaskApprovalIfPending(task);
    if (submission.review.includePlan) {
      await publishEvent(createEventName("task.planned"), {
        task: taskManager.serialiseTask(task),
        plan: planBuilder.serialisePlanForPublic(task.plan),
        reviewedSource: sourceReceipt,
      });
    }
    await publishReclaimedTasks(reclaimedTasks);

    return {
      task,
      publicTask: taskManager.serialiseTask(task),
      plan: submission.review.includePlan ? planBuilder.serialisePlanForPublic(task.plan) : null,
      review: submission.review,
      reviewedSource: sourceReceipt,
    };
  }

  return { create };
}
