import { buildNativeEngineeringContextPacket } from "./native-engineering-context-packet.mjs";
import { buildNativeEngineeringPlanTodoEvidence } from "./native-engineering-plan-todo-evidence-builders.mjs";
import { buildNativeEngineeringRecoveryEvidence } from "./native-engineering-recovery-evidence-builders.mjs";
import { buildNativeEngineeringVerificationEvidence } from "./native-engineering-verification-evidence-builders.mjs";
import {
  buildNativeEngineeringWorkViewAssociation,
  readNativeEngineeringWorkViewState,
} from "./native-engineering-work-view-association.mjs";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const MAX_TASK_ID_CHARS = 200;

function positiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function optionalTaskId(value, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  const taskId = value.trim();
  if (!taskId) return null;
  if (taskId.length > MAX_TASK_ID_CHARS) {
    throw new Error(`${label} is too long.`);
  }
  return taskId;
}

function taskForId(tasks, taskId) {
  if (!taskId) return null;
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  return Array.isArray(tasks) ? tasks.find((task) => task?.id === taskId) ?? null : null;
}

export async function buildNativeEngineeringContextPacketReadModel({
  params = {},
  tasks = new Map(),
  runtimeState = {},
  workbenchRecords = [],
  listCommandTranscriptRecords = () => [],
  listCapabilityInvocations = () => [],
  buildExperienceMemoryReadModel = () => null,
  sessionManagerUrl,
  fetchImpl = globalThis.fetch,
  readWorkViewState = readNativeEngineeringWorkViewState,
} = {}) {
  const limit = positiveInteger(params.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const taskId = optionalTaskId(params.taskId, "Engineering context taskId");
  const sourceTaskId = optionalTaskId(params.sourceTaskId, "Engineering context sourceTaskId");
  const selectedSourceTaskId = sourceTaskId ?? taskId;
  if (sourceTaskId && !taskForId(tasks, sourceTaskId)) {
    throw new Error("Engineering context source task does not exist.");
  }

  const transcriptRecords = listCommandTranscriptRecords({
    limit: selectedSourceTaskId ? 100 : limit,
  });
  const verificationEvidence = buildNativeEngineeringVerificationEvidence({
    transcriptRecords: Array.isArray(transcriptRecords) ? transcriptRecords : [],
    capabilityInvocations: listCapabilityInvocations({
      limit: 100,
      capabilityId: "act.system.command.execute",
    }),
    tasks,
    taskId: selectedSourceTaskId,
    limit,
    maxOutputChars: params.maxOutputChars,
  });
  const recoveryEvidence = buildNativeEngineeringRecoveryEvidence({
    verificationEvidence,
    tasks,
    taskId: selectedSourceTaskId,
    limit,
  });
  const selectedTaskId = selectedSourceTaskId ?? runtimeState.currentTaskId ?? null;
  const selectedTask = taskForId(tasks, selectedTaskId);
  const recallTask = selectedTask ?? latestTranscriptTask({ tasks, transcriptRecords });
  const experienceMemory = buildExperienceMemoryReadModel({
    taskType: recallTask?.type ?? taskTypeFromTranscript(transcriptRecords, selectedTaskId),
    goal: recallTask?.goal ?? null,
    incidentTargetUnit: incidentTargetUnitForTask(recallTask),
    limit: 4,
  });

  let workViewAssociation = null;
  if (params.includeWorkView === true) {
    const workViewRead = await readWorkViewState({ sessionManagerUrl, fetchImpl });
    workViewAssociation = buildNativeEngineeringWorkViewAssociation({
      task: taskForId(tasks, selectedTaskId),
      taskId: selectedTaskId,
      workViewState: workViewRead.data,
      readStatus: workViewRead.ok ? "available" : "unavailable",
      includeWorkViewObservation: params.includeWorkViewObservation === true,
    });
  }

  const planTodoEvidence = params.includePlanTodo === true
    ? buildNativeEngineeringPlanTodoEvidence({
        tasks,
        runtimeState,
        workbenchRecords,
        taskId: selectedSourceTaskId,
        limit,
      })
    : null;

  return buildNativeEngineeringContextPacket({
    transcriptRecords: Array.isArray(transcriptRecords) ? transcriptRecords : [],
    tasks,
    verificationEvidence,
    recoveryEvidence,
    taskId,
    sourceTaskId,
    limit,
    maxOutputChars: params.maxOutputChars,
    thresholdChars: params.thresholdChars,
    protectRecentAssistantTurns: params.protectRecentAssistantTurns,
    workViewAssociation,
    planTodoEvidence,
    experienceMemory,
  });
}

function incidentTargetUnitForTask(task) {
  const latestPhase = Array.isArray(task?.phaseHistory) ? task.phaseHistory.at(-1) : null;
  return task?.systemdNextRepair?.target?.unit
    ?? task?.outcome?.details?.incidentReceipt?.target?.unit
    ?? latestPhase?.details?.incidentReceipt?.target?.unit
    ?? null;
}

function taskTypeFromTranscript(transcriptRecords, taskId) {
  const record = Array.isArray(transcriptRecords)
    ? transcriptRecords.find((entry) => !taskId || entry?.taskId === taskId)
    : null;
  return record?.taskType ?? "generic_task";
}

function latestTranscriptTask({ tasks, transcriptRecords }) {
  if (!Array.isArray(transcriptRecords)) return null;
  for (const record of transcriptRecords) {
    const task = taskForId(tasks, record?.taskId);
    if (task) return task;
  }
  return null;
}
