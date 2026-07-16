import { buildNativeEngineeringContextPacketReadModel } from "./native-engineering-context-packet-assembly.mjs";

const CAPABILITY_ID = "sense.openclaw.engineering_context.packet";

export function createEngineeringContextCapabilityHandlers({
  tasks = new Map(),
  runtimeState = {},
  workbenchRecords = [],
  listCommandTranscriptRecords = () => [],
  listCapabilityInvocations = () => [],
  buildExperienceMemoryReadModel = () => null,
  sessionManagerUrl,
  fetchImpl = globalThis.fetch,
  readWorkViewState,
  publishEvent = async () => {},
} = {}) {
  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }

    const packet = await buildNativeEngineeringContextPacketReadModel({
      params: request.params ?? {},
      tasks,
      runtimeState,
      workbenchRecords,
      listCommandTranscriptRecords,
      listCapabilityInvocations,
      buildExperienceMemoryReadModel,
      sessionManagerUrl,
      fetchImpl,
      readWorkViewState,
    });
    const auditResult = await publishEvent("native_engineering.context_packet_built", packet.auditEvidence);
    if (auditResult?.ok === false) {
      throw new Error("Engineering context audit is unavailable.");
    }
    return { handled: true, result: packet };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "engineering.context_packet",
      ok: result?.ok === true,
      sourceTranscriptRecords: summary.sourceTranscriptRecords ?? 0,
      messageCount: summary.messageCount ?? 0,
      redactions: summary.redactions ?? 0,
      truncatedOutputs: summary.truncatedOutputs ?? 0,
      compactedMessages: summary.compactedMessages ?? 0,
      reclaimedChars: summary.reclaimedChars ?? 0,
      sourceTaskId: summary.sourceTaskId ?? null,
      workViewObservationIncluded: summary.workViewObservationIncluded === true,
      workViewObservationFreshness: summary.workViewObservationFreshness ?? null,
      planTodoEvidenceIncluded: summary.planTodoEvidenceIncluded === true,
      experienceMemoryIncluded: summary.experienceMemoryIncluded === true,
      experienceMemoryRecalled: summary.experienceMemoryRecalled ?? 0,
      experienceMemoryStatus: summary.experienceMemoryStatus ?? null,
      experienceMemoryMatched: summary.experienceMemoryMatched ?? 0,
      experienceMemoryCompletedMatches: summary.experienceMemoryCompletedMatches ?? 0,
      experienceMemoryFailedMatches: summary.experienceMemoryFailedMatches ?? 0,
      experienceMemoryCompletionRate: summary.experienceMemoryCompletionRate ?? null,
      experienceMemoryLatestOutcome: summary.experienceMemoryLatestOutcome ?? null,
      experienceMemoryPattern: summary.experienceMemoryPattern ?? null,
      experienceMemoryNextAction: summary.experienceMemoryNextAction ?? null,
      experienceMemoryAdvisoryOnly: summary.experienceMemoryAdvisoryOnly === true,
      noContentPersistence: governance.mutatesPersistedLogs === false
        && governance.mutatesTaskState === false,
      noProviderEgress: governance.callsProvider === false
        && governance.networkEgress === false,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) return null;
    try {
      const params = request.params ?? {};
      if (params.includeWorkViewObservation === true && params.includeWorkView !== true) {
        throw new Error("includeWorkViewObservation requires includeWorkView.");
      }
      optionalTaskIdForValidation(params.taskId, "Engineering context taskId");
      const sourceTaskId = optionalTaskIdForValidation(params.sourceTaskId, "Engineering context sourceTaskId");
      if (sourceTaskId && !findTask(tasks, sourceTaskId)) {
        throw new Error("Engineering context source task does not exist.");
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid engineering context request.";
    }
  }

  return { callBackend, summariseResult, validateRequest };
}

function findTask(tasks, taskId) {
  const normalized = typeof taskId === "string" ? taskId.trim() : taskId;
  if (!normalized) return null;
  if (tasks instanceof Map) return tasks.get(normalized) ?? null;
  return Array.isArray(tasks) ? tasks.find((task) => task?.id === normalized) ?? null : null;
}

function optionalTaskIdForValidation(value, label) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const taskId = value.trim();
  if (!taskId) return null;
  if (taskId.length > 200) throw new Error(`${label} is too long.`);
  return taskId;
}
