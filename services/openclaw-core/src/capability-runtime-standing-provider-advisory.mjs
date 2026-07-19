export const STANDING_PROVIDER_ADVISORY_CAPABILITY_ID =
  "sense.openclaw.system.standing_advisory";

const ALLOWED_BODY_KEYS = new Set(["capabilityId", "params"]);
const ALLOWED_PARAM_KEYS = new Set(["confirm"]);

function isStandingCapability(capability) {
  return capability?.id === STANDING_PROVIDER_ADVISORY_CAPABILITY_ID;
}

function requestIsBounded(request, rawBody) {
  if (request?.params?.confirm !== true
    || request.taskId !== null
    || request.stepId !== null
    || request.operation !== null
    || request.intent !== null
    || Object.keys(request.params ?? {}).some((key) => !ALLOWED_PARAM_KEYS.has(key))) {
    return false;
  }
  return rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}

export function createStandingProviderAdvisoryCapabilityHandlers({ standingAdvisory } = {}) {
  function authorizeRequest(capability, request, rawBody) {
    if (!isStandingCapability(capability)) return { handled: false, authorization: null };
    const approved = requestIsBounded(request, rawBody);
    return {
      handled: true,
      authorization: {
        registry: "openclaw-standing-capability-authorization-v0",
        required: false,
        ok: approved,
        approved,
        reason: approved ? null : "standing_authorization_request_invalid",
        policyId: "fixed-unit-health-advisory",
        policyVersion: 0,
        taskId: null,
        approvalId: null,
        bindingHash: null,
        reservation: null,
      },
    };
  }

  function validateRequest(capability, request, rawBody) {
    if (!isStandingCapability(capability)) return null;
    if (!requestIsBounded(request, rawBody)) {
      return "Standing advisory accepts only capabilityId and params.confirm=true.";
    }
    if (!standingAdvisory || typeof standingAdvisory.invoke !== "function") {
      return "Standing advisory runtime is unavailable.";
    }
    return null;
  }

  async function callBackend(capability) {
    if (!isStandingCapability(capability)) return { handled: false, result: null };
    return { handled: true, result: await standingAdvisory.invoke() };
  }

  function summariseResult(capability, result) {
    if (!isStandingCapability(capability)) return null;
    return {
      kind: "system.standing_advisory",
      ok: result?.ok === true,
      status: result?.status ?? null,
      contextContentHash: result?.evidence?.contextContentHash ?? null,
      requestContentHash: result?.evidence?.requestContentHash ?? null,
      responseContentHash: result?.evidence?.responseContentHash ?? null,
      actionId: result?.evidence?.actionId ?? null,
      callsUsed: result?.evidence?.budget?.callsUsed ?? null,
      callsLimit: result?.evidence?.budget?.callsLimit ?? null,
      tokensUsed: result?.evidence?.budget?.tokensUsed ?? null,
      tokensLimit: result?.evidence?.budget?.tokensLimit ?? null,
      providerCalled: result?.governance?.providerCalled === true,
      createsTask: false,
      createsApproval: false,
      executesRecommendation: false,
      mutatesHost: false,
    };
  }

  return { authorizeRequest, validateRequest, callBackend, summariseResult };
}
