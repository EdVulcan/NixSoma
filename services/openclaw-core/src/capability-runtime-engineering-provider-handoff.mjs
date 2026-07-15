import {
  DEEPSEEK_CREDENTIAL_REFERENCE,
  validateLiveProviderRequestEnvelope,
} from "./cloud-live-provider-network-sender.mjs";
import { CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT } from "./cloud-live-provider-runtime-response-contract.mjs";

const CAPABILITY_ID = "act.openclaw.engineering_context.provider_handoff_task";
const MAX_SOURCE_TASK_ID_CHARS = 200;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function blockedTaskResult(reason) {
  return {
    ok: false,
    blocked: true,
    reason,
    registry: "openclaw-cloud-consciousness-live-provider-egress-execution-task-v0",
    mode: "capability-runtime-engineering-provider-handoff",
    governance: {
      createsTask: false,
      createsApproval: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      providerCall: false,
    },
  };
}

function normaliseSourceTaskId(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Provider handoff sourceTaskId must be a string.");
  const sourceTaskId = value.trim();
  if (!sourceTaskId) return null;
  if (sourceTaskId.length > MAX_SOURCE_TASK_ID_CHARS) {
    throw new Error("Provider handoff sourceTaskId is too long.");
  }
  return sourceTaskId;
}

function buildLiveProviderExecution(params) {
  const input = params.liveProviderExecution;
  const contextPacket = input.contextPacket && typeof input.contextPacket === "object"
    ? input.contextPacket
    : null;
  const sourceTaskId = normaliseSourceTaskId(contextPacket?.sourceTaskId);
  return {
    requested: true,
    credentialReference: input.credentialReference,
    requestEnvelope: input.requestEnvelope,
    responseContract: input.responseContract ?? CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
    contextContentHash: input.contextContentHash ?? null,
    ...(contextPacket
      ? {
          contextPacket: {
            requested: true,
            ...(sourceTaskId ? { sourceTaskId } : {}),
          },
        }
      : {}),
  };
}

function bindingSummary(task) {
  const binding = task?.cloudConsciousnessLiveProviderEgressExecution?.requestBinding ?? {};
  return {
    provider: binding.provider ?? null,
    model: binding.model ?? null,
    endpointFingerprint: binding.endpointFingerprint ?? null,
    credentialReference: binding.credentialReference ?? null,
    requestContentHash: binding.requestContentHash ?? null,
    contextContentHash: binding.contextContentHash ?? null,
    sourceTaskId: binding.sourceTaskId ?? null,
    responseContract: binding.responseContract ?? null,
    requestContentIncluded: binding.requestContentIncluded === true,
    credentialValueIncluded: binding.credentialValueIncluded === true,
  };
}

export function createEngineeringProviderHandoffCapabilityHandlers({
  createCloudConsciousnessLiveProviderEgressExecutionTask,
} = {}) {
  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    if (request.params?.confirm !== true) {
      return { handled: true, result: blockedTaskResult("operator_confirmation_required") };
    }
    if (typeof createCloudConsciousnessLiveProviderEgressExecutionTask !== "function") {
      throw new Error("Provider handoff task builder is unavailable.");
    }
    return {
      handled: true,
      result: await createCloudConsciousnessLiveProviderEgressExecutionTask({
        confirm: true,
        liveProviderExecution: buildLiveProviderExecution(request.params),
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const task = result?.task;
    const binding = bindingSummary(task);
    const governance = result?.governance ?? {};
    return {
      kind: "engineering.provider_handoff_task",
      ok: result?.ok === true,
      blocked: result?.blocked === true,
      reason: result?.reason ?? null,
      taskId: task?.id ?? null,
      approvalId: result?.approval?.id ?? null,
      provider: binding.provider,
      model: binding.model,
      sourceTaskId: binding.sourceTaskId,
      requestBound: Boolean(binding.requestContentHash),
      contextBound: Boolean(binding.contextContentHash),
      endpointFingerprintPresent: Boolean(binding.endpointFingerprint),
      credentialReference: binding.credentialReference,
      requestContentIncluded: binding.requestContentIncluded,
      credentialValueIncluded: binding.credentialValueIncluded,
      createsTask: governance.createsTask === true,
      createsApproval: governance.createsApproval === true,
      endpointContacted: governance.endpointContacted === true,
      networkEgress: governance.networkEgress === true,
      providerResponseCreated: governance.providerResponseCreated === true,
      noProviderCall: governance.providerCall !== true
        && governance.endpointContacted !== true
        && governance.networkEgress !== true,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) return null;
    const params = request.params ?? {};
    if (params.confirm !== undefined && typeof params.confirm !== "boolean") {
      return "Provider handoff confirm must be a boolean.";
    }
    if (params.confirm !== true) return null;

    const input = params.liveProviderExecution;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return "Provider handoff liveProviderExecution is required.";
    }
    if (input.credentialReference !== DEEPSEEK_CREDENTIAL_REFERENCE) {
      return "Provider handoff credentialReference must use the fixed DeepSeek reference.";
    }
    if (!input.requestEnvelope || typeof input.requestEnvelope !== "object" || Array.isArray(input.requestEnvelope)) {
      return "Provider handoff requestEnvelope is required.";
    }
    const requestEnvelopeValidation = validateLiveProviderRequestEnvelope({
      requestEnvelope: input.requestEnvelope,
    });
    if (!requestEnvelopeValidation.ok) {
      return `Provider handoff requestEnvelope is invalid: ${requestEnvelopeValidation.reason}.`;
    }
    const contextPacket = input.contextPacket;
    if (contextPacket !== undefined
      && (!contextPacket || typeof contextPacket !== "object" || Array.isArray(contextPacket))) {
      return "Provider handoff contextPacket must be an object when provided.";
    }
    if (contextPacket !== undefined && contextPacket.requested !== true) {
      return "Provider handoff contextPacket.requested must be true when provided.";
    }
    try {
      normaliseSourceTaskId(contextPacket?.sourceTaskId);
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid provider handoff sourceTaskId.";
    }
    if (input.contextContentHash !== undefined
      && input.contextContentHash !== null
      && !SHA256_PATTERN.test(input.contextContentHash)) {
      return "Provider handoff contextContentHash must be a SHA-256 hash.";
    }
    if (input.responseContract !== undefined
      && input.responseContract !== null
      && input.responseContract !== CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT) {
      return "Provider handoff responseContract is not supported.";
    }
    return null;
  }

  return { callBackend, summariseResult, validateRequest };
}
