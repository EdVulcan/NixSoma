import { buildProviderRequest } from "./cloud-live-provider-runtime-adapter.mjs";
import {
  buildLiveProviderConfig,
  sendLiveProviderRequest,
} from "./cloud-live-provider-network-sender.mjs";

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

function transientProviderResponse(result) {
  if (!result?.response) return null;
  return {
    transient: true,
    id: result.response.id ?? null,
    model: result.response.model ?? null,
    assistantContent: result.response.assistantContent ?? null,
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

function buildTaskExecutionState(result, authorization, approval) {
  const credentialRead = result?.governance?.credentialValueRead === true;
  const endpointContacted = result?.audit?.endpointContacted === true;
  const networkEgress = result?.audit?.networkEgress === true;
  return {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_LIVE_EXECUTION_REGISTRY,
    implementationStatus: result?.ok === true ? "live_provider_call_completed" : "live_provider_call_failed",
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
  const taskState = buildTaskExecutionState(result, authorization, approval);
  task.cloudConsciousnessLiveProviderEgressExecution = {
    ...(task.cloudConsciousnessLiveProviderEgressExecution ?? {}),
    ...taskState,
  };

  if (result.ok === true) {
    appendTaskPhase(task, "cloud_consciousness_live_provider_call_completed", {
      liveProvider: evidence,
    });
    const completedTask = completeTask(task, {
      summary: "Approved live provider request completed; response content remains transient and is not persisted.",
      taskRegistry: taskState.registry,
      phase: "cloud_consciousness_live_provider_call_completed",
      liveProvider: evidence,
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
      governance: result.governance,
      summary: taskState,
    };
  }

  appendTaskPhase(task, "cloud_consciousness_live_provider_call_failed", {
    liveProvider: evidence,
  });
  const failedTask = failTask(task, `Live provider request did not complete: ${result.reason ?? "unknown_error"}.`, {
    taskRegistry: taskState.registry,
    phase: "cloud_consciousness_live_provider_call_failed",
    liveProvider: evidence,
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
    status: "live_provider_call_failed",
    reason: result.reason ?? "live_provider_request_failed",
    task: failedTask,
    liveProvider: transientProviderResponse(result),
    governance: result.governance,
    summary: taskState,
  };
}
