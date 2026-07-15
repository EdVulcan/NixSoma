import {
  buildNativeEngineeringWorkViewAssociation,
  readNativeEngineeringWorkViewState,
} from "./native-engineering-work-view-association.mjs";

const CAPABILITY_ID = "sense.openclaw.engineering_context.work_view_observation";
const MAX_TASK_ID_CHARS = 200;

function normaliseTaskId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Trusted work-view observation taskId must be a string.");
  }
  const taskId = value.trim();
  if (!taskId) return null;
  if (taskId.length > MAX_TASK_ID_CHARS) {
    throw new Error("Trusted work-view observation taskId is too long.");
  }
  return taskId;
}

function findTask(tasks, taskId) {
  if (!taskId) return null;
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === taskId) ?? null;
  return null;
}

export function createEngineeringWorkViewCapabilityHandlers({
  tasks = new Map(),
  sessionManagerUrl,
  fetchImpl = globalThis.fetch,
  readWorkViewState = readNativeEngineeringWorkViewState,
} = {}) {
  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }

    const params = request.params ?? {};
    const taskId = normaliseTaskId(params.taskId ?? request.taskId);
    const task = findTask(tasks, taskId);
    if (taskId && !task) {
      throw new Error("Trusted work-view observation task does not exist.");
    }

    const workViewRead = await readWorkViewState({ sessionManagerUrl, fetchImpl });
    return {
      handled: true,
      result: buildNativeEngineeringWorkViewAssociation({
        task,
        taskId,
        workViewState: workViewRead.data,
        readStatus: workViewRead.ok ? "available" : "unavailable",
        includeWorkViewObservation: true,
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const observation = result?.observation ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "engineering.work_view_observation",
      ok: result?.ok === true,
      taskId: summary.taskId ?? null,
      status: summary.status ?? null,
      bindingStatus: summary.bindingStatus ?? null,
      helperStatus: summary.helperStatus ?? null,
      actionAuthority: summary.actionAuthority ?? null,
      leaseMatched: summary.leaseMatched === true,
      recoveryAction: summary.recoveryAction ?? "none",
      observationStatus: summary.workViewObservationStatus ?? observation.status ?? null,
      observationFreshness: summary.workViewObservationFreshness ?? observation.freshness ?? null,
      observationSequence: summary.workViewObservationSequence ?? observation.sequence ?? null,
      semanticTargetCount: summary.semanticTargetCount ?? observation.semanticTargets?.itemCount ?? null,
      readsTrustedWorkViewObservation: governance.readsTrustedWorkViewObservation === true,
      noPayloadExposure: governance.exposesLeaseId === false
        && governance.exposesActiveUrl === false
        && governance.exposesCapturePayload === false
        && governance.exposesVisualFrameBytes === false
        && governance.exposesSemanticTargetItems === false,
    };
  }

  return { callBackend, summariseResult };
}
