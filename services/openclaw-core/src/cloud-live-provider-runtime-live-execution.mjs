import { buildProviderRequest } from "./cloud-live-provider-runtime-adapter.mjs";
import {
  buildLiveProviderRequestBinding,
  buildLiveProviderConfig,
  sendLiveProviderRequest,
  validateLiveProviderRequestBinding,
} from "./cloud-live-provider-network-sender.mjs";
import { CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE } from "./cloud-live-provider-runtime-context-packet.mjs";
import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
  parseCloudLiveProviderEngineeringRecommendation,
} from "./cloud-live-provider-runtime-response-contract.mjs";

export const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-live-execution-v0";

function compactProviderEvidence(result) {
  return {
    registry: result?.registry ?? CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
    provider: result?.provider ?? "deepseek",
    model: result?.model ?? null,
    status: result?.ok === true ? "response_received" : "request_failed_or_blocked",
    reason: result?.reason ?? null,
    statusCode: result?.status ?? null,
    requestContentHash: result?.audit?.requestContentHash ?? null,
    responseContentHash: result?.audit?.responseContentHash ?? null,
    endpointFingerprint: result?.audit?.endpointFingerprint ?? null,
    credentialReference: result?.audit?.credentialReference ?? null,
    endpointContacted: result?.audit?.endpointContacted === true,
    networkEgress: result?.audit?.networkEgress === true,
    transmitsExternally: result?.audit?.transmitsExternally === true,
    providerResponseCreated: result?.audit?.providerResponseCreated === true,
    responseId: result?.response?.id ?? null,
    responseModel: result?.response?.model ?? null,
    responseTruncated: result?.response?.responseTruncated === true,
    usage: result?.response?.usage ?? null,
  };
}

function compactContextPacketEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return null;
  return {
    registry: evidence.registry ?? CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
    sourceRegistry: evidence.sourceRegistry ?? null,
    taskId: evidence.taskId ?? null,
    executionTaskId: evidence.executionTaskId ?? null,
    sourceTaskId: evidence.sourceTaskId ?? evidence.taskId ?? null,
    responseContract: evidence.responseContract
      === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT
      ? evidence.responseContract
      : null,
    sourceTranscriptRecords: Number.isInteger(evidence.sourceTranscriptRecords)
      ? evidence.sourceTranscriptRecords
      : 0,
    messageCount: Number.isInteger(evidence.messageCount) ? evidence.messageCount : 0,
    redactions: Number.isInteger(evidence.redactions) ? evidence.redactions : 0,
    truncatedOutputs: Number.isInteger(evidence.truncatedOutputs) ? evidence.truncatedOutputs : 0,
    compactedMessages: Number.isInteger(evidence.compactedMessages) ? evidence.compactedMessages : 0,
    reclaimedChars: Number.isInteger(evidence.reclaimedChars) ? evidence.reclaimedChars : 0,
    workViewAssociationIncluded: evidence.workViewAssociationIncluded === true,
    workViewAssociationStatus: evidence.workViewAssociationStatus ?? null,
    workViewObservationIncluded: evidence.workViewObservationIncluded === true,
    workViewObservationStatus: evidence.workViewObservationStatus ?? null,
    workViewObservationFreshness: evidence.workViewObservationFreshness ?? null,
    workViewObservationSequence: Number.isInteger(evidence.workViewObservationSequence)
      ? evidence.workViewObservationSequence
      : null,
    semanticTargetCount: Number.isInteger(evidence.semanticTargetCount)
      ? evidence.semanticTargetCount
      : null,
    planTodoEvidenceIncluded: evidence.planTodoEvidenceIncluded === true,
    planTodoTodoSource: evidence.planTodoTodoSource ?? null,
    planTodoCurrentAction: evidence.planTodoCurrentAction ?? null,
    contextContentHash: typeof evidence.contextContentHash === "string"
      ? evidence.contextContentHash
      : null,
    providerMessageChars: Number.isInteger(evidence.providerMessageChars)
      ? evidence.providerMessageChars
      : 0,
    contextTruncated: evidence.contextTruncated === true,
    contextContentIncluded: false,
    requestEnvelopeMaterialized: evidence.requestEnvelopeMaterialized === true,
  };
}

function transientProviderResponse(result, { includeAssistantContent = true } = {}) {
  if (!result?.response) return null;
  return {
    transient: true,
    id: result.response.id ?? null,
    model: result.response.model ?? null,
    ...(includeAssistantContent ? { assistantContent: result.response.assistantContent ?? null } : {}),
    responseContentHash: result.response.responseContentHash ?? null,
    responseTruncated: result.response.responseTruncated === true,
    usage: result.response.usage ?? null,
  };
}

function buildOperatorAuthorization(task, approval, request) {
  const requestedAuthorization = request?.authorization && typeof request.authorization === "object"
    ? request.authorization
    : {};
  const taskBound = request?.taskId === task.id;
  const approved = approval?.status === "approved";
  const confirmed = taskBound && requestedAuthorization.confirmed === true;
  return {
    state: approved && confirmed ? "authorized" : "not_authorized",
    confirmed,
    taskId: task.id,
    credentialValueAccessAuthorized: requestedAuthorization.credentialValueAccessAuthorized === true,
    endpointNetworkEgressAuthorized: requestedAuthorization.endpointNetworkEgressAuthorized === true,
    liveProviderCallEnabled: requestedAuthorization.liveProviderCallEnabled === true,
  };
}

function compactRecommendationEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return null;
  return {
    registry: evidence.registry ?? null,
    contract: evidence.contract ?? null,
    status: evidence.status ?? null,
    valid: evidence.valid === true,
    reason: evidence.reason ?? null,
    actionId: evidence.actionId ?? null,
    existingObserverControlId: evidence.existingObserverControlId ?? null,
    existingCapabilityId: evidence.existingCapabilityId ?? null,
    requiresOperatorReview: evidence.requiresOperatorReview === true,
    requiresApproval: evidence.requiresApproval === true,
    reasonIncluded: false,
    responseContentHash: evidence.responseContentHash ?? null,
  };
}

function buildTaskExecutionState(
  result,
  authorization,
  approval,
  contextPacketEvidence,
  recommendationEvidence,
  responseContract,
  responseContractFailed,
) {
  const credentialRead = result?.governance?.credentialValueRead === true;
  const endpointContacted = result?.audit?.endpointContacted === true;
  const networkEgress = result?.audit?.networkEgress === true;
  return {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
    implementationStatus: result?.ok === true
      ? responseContractFailed ? "live_provider_response_contract_failed" : "live_provider_call_completed"
      : "live_provider_call_failed",
    approvedAt: approval?.updatedAt ?? null,
    liveProviderCallRequested: true,
    liveProviderCallAuthorized: authorization.state === "authorized",
    egressExecutionTaskCreated: true,
    egressExecutionTaskApproved: approval?.status === "approved",
    egressExecutionDeferred: false,
    credentialValueAccessAuthorized: credentialRead,
    credentialValueAccessDenied: !credentialRead,
    credentialValueIncluded: false,
    credentialValueRead: credentialRead,
    credentialValueExposed: false,
    providerSdkLoaded: false,
    providerCredentialRead: result?.governance?.providerCredentialRead === true,
    endpointNetworkEgressAuthorized: networkEgress,
    endpointNetworkEgressDenied: !networkEgress,
    launchAuthorized: authorization.state === "authorized",
    launchExecuted: endpointContacted,
    endpointContacted,
    networkEgress,
    providerResponseCreated: result?.audit?.providerResponseCreated === true,
    rollbackExecuted: false,
    rollbackCommandCreated: false,
    hostMutation: false,
    transmitsExternally: result?.audit?.transmitsExternally === true,
    liveProviderCallEnabled: result?.governance?.liveProviderCallEnabled === true,
    evidence: compactProviderEvidence(result),
    contextPacket: compactContextPacketEvidence(contextPacketEvidence),
    responseContract: responseContract ?? null,
    recommendation: recommendationEvidence,
  };
}

async function publishTaskState({ task, reconcileRuntimeState, persistState, publishEvent, serialiseTask }) {
  reconcileRuntimeState();
  persistState();
  await publishEvent("task.phase_changed", { task: serialiseTask(task) });
}

export async function executeCloudConsciousnessLiveProviderRequest({
  task,
  options = {},
  approvals,
  appendTaskPhase,
  completeTask,
  failTask,
  reconcileRuntimeState,
  persistState,
  publishEvent,
  serialiseTask,
  sendLiveProviderRequestImpl = sendLiveProviderRequest,
  env = process.env,
} = {}) {
  const request = options.liveProviderExecution;
  if (!request || request.requested !== true) return null;

  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (approval?.status !== "approved") {
    return {
      blocked: true,
      reason: "approval_required",
      task,
      approval: approval ? { ...approval } : null,
    };
  }

  if (options.liveProviderContextPacketError) {
    return {
      blocked: true,
      reason: options.liveProviderContextPacketError,
      task,
      approval: { ...approval },
    };
  }

  if (request.taskId !== task.id) {
    return {
      blocked: true,
      reason: "live_provider_request_task_mismatch",
      task,
      approval: { ...approval },
    };
  }

  if (!request.requestEnvelope || typeof request.requestEnvelope !== "object") {
    return {
      blocked: true,
      reason: "live_provider_request_envelope_required",
      task,
      approval: { ...approval },
    };
  }

  const config = buildLiveProviderConfig({ env });
  const authorization = buildOperatorAuthorization(task, approval, request);
  const credentialReference = typeof request.credentialReference === "string"
    ? request.credentialReference
    : null;
  const providerRequest = buildProviderRequest({
    executionPlan: {
      credentialReference,
      endpointFingerprint: config.endpointFingerprint,
    },
    requestEnvelope: request.requestEnvelope,
    operatorAuthorization: authorization,
  });
  const contextPacketEvidence = compactContextPacketEvidence(
    options[CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE],
  );
  const contextSourceTaskId = request.contextPacket?.requested === true
    && typeof request.contextPacket.sourceTaskId === "string"
    && request.contextPacket.sourceTaskId.trim().length > 0
    ? request.contextPacket.sourceTaskId.trim()
    : null;
  const requestedResponseContract = request.responseContract ?? request.contextPacket?.responseContract ?? null;
  const expectedBinding = task.cloudConsciousnessLiveProviderEgressExecution?.requestBinding ?? null;
  const expectedBindingResult = validateLiveProviderRequestBinding(expectedBinding);
  if (!expectedBindingResult.ok) {
    return {
      blocked: true,
      reason: "live_provider_request_binding_missing",
      task,
      approval: { ...approval },
    };
  }
  const actualBindingResult = buildLiveProviderRequestBinding({
    providerRequest,
    responseContract: requestedResponseContract,
    contextContentHash: contextPacketEvidence?.contextContentHash ?? null,
    sourceTaskId: contextSourceTaskId,
    env,
  });
  if (!actualBindingResult.ok
    || actualBindingResult.binding.bindingHash !== expectedBindingResult.binding.bindingHash) {
    return {
      blocked: true,
      reason: "live_provider_request_binding_mismatch",
      task,
      approval: { ...approval },
    };
  }
  const requestedAuthorization = request.authorization && typeof request.authorization === "object"
    ? request.authorization
    : {};
  const expectedAuthorization = expectedBindingResult.binding.executionAuthorization;
  if (requestedAuthorization.credentialValueAccessAuthorized !== expectedAuthorization.credentialValueAccessAuthorized
    || requestedAuthorization.endpointNetworkEgressAuthorized !== expectedAuthorization.endpointNetworkEgressAuthorized
    || requestedAuthorization.liveProviderCallEnabled !== expectedAuthorization.liveProviderCallEnabled) {
    return {
      blocked: true,
      reason: "live_provider_authorization_binding_mismatch",
      task,
      approval: { ...approval },
    };
  }
  const result = await sendLiveProviderRequestImpl({
    providerRequest,
    credentialResolution: {
      credential: {
        reference: credentialReference,
        value: null,
        resolvedValue: null,
      },
    },
    operatorAuthorization: authorization,
    env,
  });
  const evidence = compactProviderEvidence(result);
  const responseContract = requestedResponseContract
    === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT
    ? requestedResponseContract
    : requestedResponseContract === null
      ? null
      : "unsupported";
  const recommendationResult = result.ok === true
    ? parseCloudLiveProviderEngineeringRecommendation({
      contract: requestedResponseContract,
      assistantContent: result.response?.assistantContent,
      responseContentHash: result.response?.responseContentHash ?? result.audit?.responseContentHash ?? null,
    })
    : { ok: true, recommendation: null, evidence: null };
  const recommendationEvidence = compactRecommendationEvidence(recommendationResult.evidence);
  const responseContractFailed = result.ok === true && recommendationResult.ok === false;
  const taskState = buildTaskExecutionState(
    result,
    authorization,
    approval,
    contextPacketEvidence,
    recommendationEvidence,
    responseContract,
    responseContractFailed,
  );
  task.cloudConsciousnessLiveProviderEgressExecution = {
    ...(task.cloudConsciousnessLiveProviderEgressExecution ?? {}),
    ...taskState,
  };

  if (result.ok === true && !responseContractFailed) {
    appendTaskPhase(task, "cloud_consciousness_live_provider_call_completed", {
      liveProvider: evidence,
      recommendation: recommendationEvidence,
    });
    const completedTask = completeTask(task, {
      summary: "Approved live provider request completed; response content remains transient and is not persisted.",
      taskRegistry: taskState.registry,
      phase: "cloud_consciousness_live_provider_call_completed",
      liveProvider: evidence,
      contextPacket: taskState.contextPacket,
      recommendation: recommendationEvidence,
    });
    await publishTaskState({
      task: completedTask,
      reconcileRuntimeState,
      persistState,
      publishEvent,
      serialiseTask,
    });
    return {
      ok: true,
      executor: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
      status: "live_provider_call_completed",
      task: completedTask,
      liveProvider: transientProviderResponse(result),
      recommendation: recommendationResult.recommendation,
      contextPacket: taskState.contextPacket,
      governance: result.governance,
      summary: taskState,
    };
  }

  const failurePhase = responseContractFailed
    ? "cloud_consciousness_live_provider_response_contract_failed"
    : "cloud_consciousness_live_provider_call_failed";
  const failureReason = responseContractFailed
    ? recommendationResult.reason
    : result.reason ?? "live_provider_request_failed";
  appendTaskPhase(task, failurePhase, {
    liveProvider: evidence,
    recommendation: recommendationEvidence,
  });
  const failedTask = failTask(task, `Live provider request did not complete: ${failureReason ?? "unknown_error"}.`, {
    taskRegistry: taskState.registry,
    phase: failurePhase,
    liveProvider: evidence,
    contextPacket: taskState.contextPacket,
    recommendation: recommendationEvidence,
  });
  await publishTaskState({
    task: failedTask,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    serialiseTask,
  });
  return {
    ok: false,
    executor: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
    status: responseContractFailed
      ? "live_provider_response_contract_failed"
      : "live_provider_call_failed",
    reason: failureReason,
    task: failedTask,
    liveProvider: transientProviderResponse(result, { includeAssistantContent: !responseContractFailed }),
    recommendation: recommendationResult.recommendation,
    contextPacket: taskState.contextPacket,
    governance: result.governance,
    summary: taskState,
  };
}
