import { createHash, randomUUID } from "node:crypto";

import { buildReviewedBrowserTaskSubmission } from "./reviewed-browser-task-submission.mjs";
import {
  buildReviewedWorkflowSelection,
  normaliseReviewedWorkflowOutcome,
  normaliseReviewedWorkflowSelection,
  reviewedWorkflowOutcomeComplete,
  reviewedWorkflowSelectionGovernance,
  sameReviewedWorkflowSelection,
} from "./reviewed-workflow-selection.mjs";

export const REVIEWED_MISSION_WORKLIST_REGISTRY =
  "nixsoma-reviewed-finite-mission-worklist-v0";

const MAX_WORKLISTS = 8;
const MAX_ITEMS = 16;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;
const ITEM_STATUSES = new Set(["pending", "issuing", "issued", "completed", "failed"]);
const WORKFLOW_STATUSES = new Set(["pending", "running", "completed", "failed"]);
const WORKLIST_STATUSES = new Set(["bound", "active", "completed", "blocked", "closed"]);
const TERMINAL_TASK_STATUSES = new Set(["completed", "failed", "superseded"]);

function safeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function validTimestamp(value, fallback = null) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function blueprint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Reviewed mission worklist items must be objects.");
  }
  if (Object.keys(value).some((field) => !new Set(["goal", "targetUrl", "workflowId"]).has(field))) {
    throw new Error("Reviewed mission worklist items accept only goal, targetUrl, and workflowId.");
  }
  const submission = buildReviewedBrowserTaskSubmission({
    goal: value.goal,
    targetUrl: value.targetUrl,
    includePlan: true,
  });
  const hasWorkflowSelection = value.workflowId !== undefined;
  const workflowSelection = buildReviewedWorkflowSelection({
    workflowId: value.workflowId ?? "bounded_run",
    goal: submission.taskInput.goal,
  });
  const canonicalPayload = {
    goal: submission.taskInput.goal,
    targetUrl: submission.taskInput.targetUrl,
    type: submission.taskInput.type,
    workViewStrategy: submission.taskInput.workViewStrategy,
    includePlan: true,
    ...(hasWorkflowSelection ? { workflowSelection } : {}),
  };
  return {
    goal: submission.taskInput.goal,
    targetUrl: submission.taskInput.targetUrl,
    goalCharacterCount: submission.review.goalCharacterCount,
    workflowSelection,
    blueprintHash: createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex"),
  };
}

function normaliseItem(raw) {
  try {
    const persistedWorkflowId = raw?.workflowId ?? raw?.workflowSelection?.workflowId;
    const itemBlueprint = blueprint({
      goal: raw?.goal,
      targetUrl: raw?.targetUrl,
      ...(persistedWorkflowId !== undefined ? { workflowId: persistedWorkflowId } : {}),
    });
    const id = safeId(raw?.id);
    const ordinal = Number.isInteger(raw?.ordinal) && raw.ordinal > 0 && raw.ordinal <= MAX_ITEMS
      ? raw.ordinal
      : null;
    const status = ITEM_STATUSES.has(raw?.status) ? raw.status : null;
    if (!id || !ordinal || !status) return null;
    const persistedWorkflowSelection = raw?.workflowSelection;
    const workflowSelection = normaliseReviewedWorkflowSelection(
      persistedWorkflowSelection ?? itemBlueprint.workflowSelection,
      itemBlueprint.goal,
    );
    if (!workflowSelection) return null;
    if (raw?.workflowSelectionHash !== undefined
      && raw.workflowSelectionHash !== null
      && raw.workflowSelectionHash !== workflowSelection.selectionHash) return null;
    const workflowSelectionBound = typeof raw?.workflowSelectionBound === "boolean"
      ? raw.workflowSelectionBound
      : raw?.workflowId !== undefined
        || raw?.workflowSelection !== undefined
        || raw?.workflowSelectionHash !== undefined
        || raw?.workflowStatus !== undefined;
    const workflowStatus = workflowSelectionBound
      ? WORKFLOW_STATUSES.has(raw?.workflowStatus) ? raw.workflowStatus : "pending"
      : "legacy";
    const issuedTaskId = safeId(raw?.issuedTaskId);
    if (["issued", "completed"].includes(status) && !issuedTaskId) {
      return null;
    }
    if (status === "failed" && !issuedTaskId
      && !["issue_failed", "issue_interrupted"].includes(raw?.terminalTaskStatus)) {
      return null;
    }
    return {
      id,
      ordinal,
      ...itemBlueprint,
      workflowId: workflowSelectionBound ? workflowSelection.workflowId : null,
      workflowSelectionBound,
      workflowSelection: workflowSelectionBound ? workflowSelection : null,
      workflowSelectionHash: workflowSelectionBound ? workflowSelection.selectionHash : null,
      status,
      issuedTaskId,
      issuedAt: validTimestamp(raw?.issuedAt),
      completedAt: validTimestamp(raw?.completedAt),
      terminalTaskStatus: typeof raw?.terminalTaskStatus === "string"
        ? raw.terminalTaskStatus.slice(0, 40)
        : null,
      issueCheckpointAt: validTimestamp(raw?.issueCheckpointAt),
      workflowStatus,
      workflowCheckpointAt: validTimestamp(raw?.workflowCheckpointAt),
      workflowCompletedAt: validTimestamp(raw?.workflowCompletedAt),
      workflowOutcome: workflowSelectionBound && raw?.workflowOutcome && typeof raw.workflowOutcome === "object"
        ? normaliseReviewedWorkflowOutcome(raw.workflowOutcome, workflowSelection, issuedTaskId)
        : null,
    };
  } catch {
    return null;
  }
}

function normaliseRecord(raw, now) {
  const id = safeId(raw?.id);
  const missionId = safeId(raw?.missionId);
  const items = Array.isArray(raw?.items)
    ? raw.items.map(normaliseItem).filter(Boolean).sort((left, right) => left.ordinal - right.ordinal)
    : [];
  if (!id || !missionId || items.length < 1 || items.length > MAX_ITEMS) return null;
  if (new Set(items.map((item) => item.id)).size !== items.length
    || new Set(items.map((item) => item.ordinal)).size !== items.length
    || items.some((item, index) => item.ordinal !== index + 1)) {
    return null;
  }
  const status = WORKLIST_STATUSES.has(raw?.status) ? raw.status : "blocked";
  return {
    registry: REVIEWED_MISSION_WORKLIST_REGISTRY,
    id,
    missionId,
    status,
    itemCount: items.length,
    issuedCount: items.filter((item) => item.issuedTaskId !== null).length,
    completedCount: items.filter((item) => item.status === "completed").length,
    items,
    blockedReason: typeof raw?.blockedReason === "string" ? raw.blockedReason.slice(0, 120) : null,
    createdAt: validTimestamp(raw?.createdAt, now()),
    updatedAt: validTimestamp(raw?.updatedAt, now()),
    endedAt: validTimestamp(raw?.endedAt),
  };
}

function governance() {
  return {
    explicitOperatorBinding: true,
    immutableAfterBinding: true,
    maximumItems: MAX_ITEMS,
    reviewedBrowserTasksOnly: true,
    reviewedWorkflowSelection: true,
    fixedWorkflowRecipeAllowlist: true,
    providerCanSelectWorkflow: false,
    providerCanChangeWorkflow: false,
    oneItemIssuedAtEpochBoundary: true,
    checkpointBeforeTaskCreation: true,
    stopOnFailure: true,
    automaticRetry: false,
    automaticSkip: false,
    providerCanExtendWorklist: false,
    openEndedTaskCreation: false,
    mutatesHost: false,
    workflowSelectionRegistry: reviewedWorkflowSelectionGovernance().registry,
    workflowSelectionVersion: reviewedWorkflowSelectionGovernance().version,
  };
}

function publicRecord(record, now = () => record.updatedAt) {
  const normalised = normaliseRecord(record, now);
  if (!normalised) return null;
  const currentItem = normalised.items.find((item) => ["issuing", "issued"].includes(item.status)) ?? null;
  const nextItem = normalised.items.find((item) => item.status === "pending") ?? null;
  return {
    ...normalised,
    currentItemId: currentItem?.id ?? null,
    currentTaskId: currentItem?.issuedTaskId ?? null,
    currentWorkflowId: currentItem?.workflowId ?? null,
    currentWorkflowSelectionHash: currentItem?.workflowSelectionHash ?? null,
    nextItemOrdinal: nextItem?.ordinal ?? null,
    progressPercent: Math.floor((normalised.completedCount / normalised.itemCount) * 100),
    governance: governance(),
  };
}

export function createReviewedMissionWorklist({
  records = new Map(),
  persistState = () => {},
  taskManager,
  reviewedTaskOwner,
  workflowRunner = null,
  now = () => new Date().toISOString(),
  createId = randomUUID,
} = {}) {
  if (!(records instanceof Map)) throw new Error("Reviewed mission worklist requires a Map.");
  if (!taskManager || typeof taskManager.getTaskById !== "function" || typeof taskManager.getActiveTasks !== "function") {
    throw new Error("Reviewed mission worklist requires the task owner.");
  }
  if (!reviewedTaskOwner || typeof reviewedTaskOwner.create !== "function") {
    throw new Error("Reviewed mission worklist requires the reviewed browser task owner.");
  }
  if (workflowRunner && typeof workflowRunner.run !== "function") {
    throw new Error("Reviewed mission worklist received an invalid workflow runner.");
  }

  function persist() {
    if (typeof persistState.flush === "function") persistState.flush();
    else persistState();
  }

  function save(record) {
    record.updatedAt = now();
    records.set(record.id, record);
    persist();
    return publicRecord(record, now);
  }

  function getByMission(missionId) {
    const id = safeId(missionId);
    if (!id) return null;
    const raw = [...records.values()].find((candidate) => candidate?.missionId === id);
    return raw ? normaliseRecord(raw, now) : null;
  }

  function trim() {
    while (records.size > MAX_WORKLISTS) {
      const removable = [...records.values()]
        .map((raw) => normaliseRecord(raw, now))
        .filter((record) => record && ["completed", "blocked", "closed"].includes(record.status))
        .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];
      if (!removable) break;
      records.delete(removable.id);
    }
  }

  function block(record, reason, item = null, terminalTaskStatus = null) {
    if (item) {
      item.status = "failed";
      item.terminalTaskStatus = terminalTaskStatus ?? reason;
      item.completedAt = now();
      if (item.workflowStatus === "running") {
        item.workflowStatus = "failed";
      }
    }
    record.status = "blocked";
    record.blockedReason = reason;
    record.endedAt = now();
    return save(record);
  }

  function refreshRecord(record) {
    if (["completed", "blocked", "closed"].includes(record.status)) return publicRecord(record, now);
    let changed = false;
    for (const item of record.items) {
      if (workflowRunner && item.workflowSelectionBound && item.workflowStatus === "running") {
        return block(record, "workflow_execution_interrupted", item, "workflow_interrupted");
      }
      if (item.status !== "issued") continue;
      const task = taskManager.getTaskById(item.issuedTaskId);
      if (!task) return block(record, "issued_task_missing", item, "missing");
      if (task.status === "completed") {
        if (workflowRunner && item.workflowSelectionBound && !reviewedWorkflowOutcomeComplete(
          item.workflowOutcome,
          item.workflowSelection,
          item.issuedTaskId,
        )) {
          return block(record, "workflow_task_completed_without_verified_receipt", item, "completed");
        }
        item.status = "completed";
        item.terminalTaskStatus = "completed";
        item.completedAt = task.closedAt ?? task.updatedAt ?? now();
        changed = true;
      } else if (TERMINAL_TASK_STATUSES.has(task.status)) {
        return block(record, `issued_task_${task.status}`, item, task.status);
      }
    }
    if (record.items.every((item) => item.status === "completed")) {
      record.status = "completed";
      record.blockedReason = null;
      record.endedAt = now();
      changed = true;
    } else {
      const nextStatus = record.items.some((item) => ["issuing", "issued"].includes(item.status))
        ? "active"
        : "bound";
      if (record.status !== nextStatus) {
        record.status = nextStatus;
        changed = true;
      }
    }
    return changed ? save(record) : publicRecord(record, now);
  }

  function bind(mission, { items, confirm = false } = {}) {
    if (confirm !== true) throw new Error("Reviewed mission worklist binding requires confirm=true.");
    const missionId = safeId(mission?.id);
    if (!missionId || !["armed", "paused"].includes(mission?.status)
      || mission?.epochsConsumed !== 0 || mission?.childLeaseId) {
      throw new Error("Reviewed mission worklist requires an unstarted armed or paused mission.");
    }
    if (getByMission(missionId)) throw new Error("Reviewed mission worklist is already bound to this mission.");
    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
      throw new Error("Reviewed mission worklist requires 1-16 finite items.");
    }
    if (!Number.isInteger(mission.remainingEpochs) || items.length > mission.remainingEpochs) {
      throw new Error("Reviewed mission worklist item count must fit the mission's remaining epoch authority.");
    }
    if (taskManager.getActiveTasks().length > 0) {
      throw new Error("Reviewed mission worklist binding requires no active task.");
    }
    const timestamp = now();
    const record = {
      registry: REVIEWED_MISSION_WORKLIST_REGISTRY,
      id: createId(),
      missionId,
      status: "bound",
      itemCount: items.length,
      issuedCount: 0,
      completedCount: 0,
      items: items.map((item, index) => {
        const itemBlueprint = blueprint(item);
        const workflowSelectionBound = item.workflowId !== undefined;
        return {
          id: createId(),
          ordinal: index + 1,
          ...itemBlueprint,
          ...(workflowSelectionBound
            ? {
                workflowId: itemBlueprint.workflowSelection.workflowId,
                workflowSelection: itemBlueprint.workflowSelection,
                workflowSelectionHash: itemBlueprint.workflowSelection.selectionHash,
              }
            : {
                workflowId: null,
                workflowSelection: null,
                workflowSelectionHash: null,
              }),
          workflowSelectionBound,
          status: "pending",
          issuedTaskId: null,
          issuedAt: null,
          completedAt: null,
          terminalTaskStatus: null,
          issueCheckpointAt: null,
          workflowStatus: "pending",
          workflowCheckpointAt: null,
          workflowCompletedAt: null,
          workflowOutcome: null,
        };
      }),
      blockedReason: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      endedAt: null,
    };
    records.set(record.id, record);
    trim();
    persist();
    return publicRecord(record, now);
  }

  async function prepareEpoch(mission) {
    const record = getByMission(mission?.id);
    if (!record) return { ok: true, managed: false, ready: true, reason: "no_reviewed_worklist", worklist: null };
    const refreshed = refreshRecord(record);
    const current = getByMission(mission.id);
    if (!current) return { ok: false, managed: true, ready: false, reason: "worklist_missing", worklist: null };
    if (refreshed.status === "completed") {
      return { ok: true, managed: true, ready: false, reason: "worklist_completed", worklist: refreshed };
    }
    if (refreshed.status === "blocked") {
      return { ok: false, managed: true, ready: false, reason: refreshed.blockedReason, worklist: refreshed };
    }
    if (refreshed.status === "closed") {
      return { ok: false, managed: true, ready: false, reason: refreshed.blockedReason ?? "mission_cancelled", worklist: refreshed };
    }

    const issuedItem = current.items.find((item) => item.status === "issued") ?? null;
    if (issuedItem) {
      const activeTasks = taskManager.getActiveTasks();
      if (activeTasks.some((task) => task.id !== issuedItem.issuedTaskId)) {
        const blocked = block(current, "unrelated_active_task");
        return { ok: false, managed: true, ready: false, reason: blocked.blockedReason, worklist: blocked };
      }
      return {
        ok: true,
        managed: true,
        ready: true,
        issued: false,
        reason: "issued_task_active",
        taskId: issuedItem.issuedTaskId,
        worklist: publicRecord(current, now),
      };
    }

    if (taskManager.getActiveTasks().length > 0) {
      const blocked = block(current, "unrelated_active_task");
      return { ok: false, managed: true, ready: false, reason: blocked.blockedReason, worklist: blocked };
    }
    const item = current.items.find((candidate) => candidate.status === "pending") ?? null;
    if (!item) {
      current.status = "completed";
      current.endedAt = now();
      const completed = save(current);
      return { ok: true, managed: true, ready: false, reason: "worklist_completed", worklist: completed };
    }

    item.status = "issuing";
    item.issueCheckpointAt = now();
    current.status = "active";
    save(current);
    try {
      const result = await reviewedTaskOwner.create({
        goal: item.goal,
        targetUrl: item.targetUrl,
        includePlan: true,
      }, {
        source: {
          registry: REVIEWED_MISSION_WORKLIST_REGISTRY,
          worklistId: current.id,
          missionId: current.missionId,
          itemId: item.id,
          itemOrdinal: item.ordinal,
          blueprintHash: item.blueprintHash,
          ...(item.workflowSelectionBound ? { workflowSelection: item.workflowSelection } : {}),
        },
      });
      if (!safeId(result?.task?.id)) throw new Error("Reviewed task owner returned no task id.");
      if (workflowRunner && item.workflowSelectionBound
        && !sameReviewedWorkflowSelection(result.task.reviewedWorkflowSelection, item.workflowSelection)) {
        throw new Error("Reviewed task owner returned no matching workflow selection.");
      }
      item.status = "issued";
      item.issuedTaskId = result.task.id;
      item.issuedAt = now();
      const worklist = save(current);
      return {
        ok: true,
        managed: true,
        ready: true,
        issued: true,
        reason: "reviewed_item_issued",
        taskId: result.task.id,
        worklist,
      };
    } catch {
      const blocked = block(current, "task_issue_failed", item, "issue_failed");
      return { ok: false, managed: true, ready: false, reason: blocked.blockedReason, worklist: blocked };
    }
  }

  function refreshForMission(missionId) {
    const record = getByMission(missionId);
    return record ? refreshRecord(record) : null;
  }

  async function runEpoch({ missionId } = {}) {
    const record = getByMission(missionId);
    if (!record) return { managed: false, result: null, worklist: null };
    const refreshed = refreshRecord(record);
    const current = getByMission(missionId);
    if (!current) {
      return {
        managed: true,
        result: { ran: false, blocked: true, reason: "worklist_missing", steps: [] },
        worklist: null,
      };
    }
    if (["completed", "blocked", "closed"].includes(refreshed.status)) {
      return {
        managed: true,
        result: {
          ran: false,
          blocked: true,
          reason: refreshed.blockedReason ?? `worklist_${refreshed.status}`,
          steps: [],
        },
        worklist: refreshed,
      };
    }
    const item = current.items.find((candidate) => candidate.status === "issued") ?? null;
    if (!item || !item.issuedTaskId) {
      if (!workflowRunner || item?.workflowSelectionBound !== true) {
        return { managed: false, result: null, worklist: publicRecord(current, now) };
      }
      const blocked = block(current, "issued_workflow_item_missing");
      return {
        managed: true,
        result: { ran: false, blocked: true, reason: blocked.blockedReason, steps: [] },
        worklist: blocked,
      };
    }
    if (!workflowRunner || item.workflowSelectionBound !== true) {
      return { managed: false, result: null, worklist: publicRecord(current, now) };
    }
    const task = taskManager.getTaskById(item.issuedTaskId);
    if (!task) {
      const blocked = block(current, "issued_task_missing", item, "missing");
      return {
        managed: true,
        result: { ran: false, blocked: true, reason: blocked.blockedReason, steps: [] },
        worklist: blocked,
      };
    }
    if (task.status !== "queued" || item.workflowStatus !== "pending") {
      const blocked = block(current, "workflow_execution_not_pristine", item, task.status);
      return {
        managed: true,
        result: { ran: false, blocked: true, reason: blocked.blockedReason, steps: [] },
        worklist: blocked,
      };
    }

    item.workflowStatus = "running";
    item.workflowCheckpointAt = now();
    current.status = "active";
    save(current);

    let workflowResult;
    try {
      workflowResult = await workflowRunner.run({
        task,
        workflowSelection: item.workflowSelection,
        missionId: current.missionId,
        worklistId: current.id,
        itemId: item.id,
        itemOrdinal: item.ordinal,
      });
    } catch {
      workflowResult = { ok: false, ran: false, reason: "workflow_execution_failed", outcome: null };
    }

    if (workflowResult?.ok !== true
      || !reviewedWorkflowOutcomeComplete(
        workflowResult.outcome,
        item.workflowSelection,
        item.issuedTaskId,
      )) {
      item.workflowStatus = "failed";
      item.workflowCompletedAt = now();
      item.workflowOutcome = workflowResult?.outcome ?? null;
      const blocked = block(
        current,
        workflowResult?.reason ?? "workflow_execution_failed",
        item,
        taskManager.getTaskById(item.issuedTaskId)?.status ?? "workflow_failed",
      );
      return {
        managed: true,
        result: {
          ran: workflowResult?.ran === true,
          blocked: true,
          reason: blocked.blockedReason,
          steps: workflowResult?.steps ?? [],
        },
        worklist: blocked,
      };
    }

    item.workflowStatus = "completed";
    item.workflowCompletedAt = now();
    item.workflowOutcome = workflowResult.outcome;
    save(current);
    const worklist = refreshRecord(current);
    return {
      managed: true,
      result: {
        ran: true,
        blocked: false,
        reason: null,
        steps: workflowResult.steps ?? [{ task: taskManager.getTaskById(item.issuedTaskId) }],
        workflow: workflowResult.outcome,
      },
      worklist,
    };
  }

  function closeForMission(missionId, reason = "mission_cancelled") {
    const record = getByMission(missionId);
    if (!record || ["completed", "closed"].includes(record.status)) {
      return record ? publicRecord(record, now) : null;
    }
    for (const item of record.items) {
      if (item.status === "issuing") {
        item.status = "failed";
        item.terminalTaskStatus = "issue_interrupted";
        item.completedAt = now();
      } else if (item.workflowStatus === "running") {
        item.status = "failed";
        item.workflowStatus = "failed";
        item.terminalTaskStatus = "workflow_interrupted";
        item.completedAt = now();
      }
    }
    record.status = "closed";
    record.blockedReason = typeof reason === "string" && reason ? reason.slice(0, 120) : "mission_cancelled";
    record.endedAt = now();
    return save(record);
  }

  function reconcileAtStartup() {
    for (const [id, raw] of records.entries()) {
      const record = normaliseRecord(raw, now);
      if (!record) {
        records.delete(id);
        continue;
      }
      const issuingItem = record.items.find((item) => item.status === "issuing") ?? null;
      const workflowItem = record.items.find((item) => item.workflowSelectionBound
        && item.workflowStatus === "running") ?? null;
      if (issuingItem && !["completed", "blocked", "closed"].includes(record.status)) {
        block(record, "core_restart_during_task_issue", issuingItem, "issue_interrupted");
      } else if (workflowRunner && workflowItem && !["completed", "blocked", "closed"].includes(record.status)) {
        block(record, "core_restart_during_workflow_execution", workflowItem, "workflow_interrupted");
      } else {
        refreshRecord(record);
      }
    }
    persist();
    return listPublic();
  }

  function listPublic() {
    return [...records.values()]
      .map((raw) => normaliseRecord(raw, now))
      .filter(Boolean)
      .map((record) => refreshRecord(record))
      .filter(Boolean)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, MAX_WORKLISTS);
  }

  return {
    bind,
    getByMission: (missionId) => publicRecord(getByMission(missionId), now),
    hasForMission: (missionId) => Boolean(getByMission(missionId)),
    prepareEpoch,
    runEpoch,
    refreshForMission,
    closeForMission,
    reconcileAtStartup,
    listPublic,
  };
}
