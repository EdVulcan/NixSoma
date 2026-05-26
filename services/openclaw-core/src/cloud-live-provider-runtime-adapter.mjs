const RUNTIME_ADAPTER_MODULE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract-v0";
const PROVIDER_REQUEST_BUILDER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-request-builder-v0";

const ADAPTER_METHODS = [
  {
    name: "buildProviderRequest",
    implemented: true,
    boundary: "pure serialization only; no credential values, SDK calls, or network egress",
  },
  {
    name: "resolveCredentialReference",
    implemented: false,
    boundary: "future operator-approved credential lookup; current module must not read values",
  },
  {
    name: "sendProviderRequest",
    implemented: false,
    boundary: "future bounded egress adapter; current module must not contact endpoints",
  },
  {
    name: "recordEgressTranscript",
    implemented: false,
    boundary: "future transcript writer; current module must not create live-call records",
  },
  {
    name: "verifyProviderResponse",
    implemented: false,
    boundary: "future response verifier; current module must not call providers",
  },
  {
    name: "buildRollbackNote",
    implemented: false,
    boundary: "future operator-visible rollback note; current module is contract-only",
  },
];

function stableJson(value) {
  if (value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normaliseMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }
  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: typeof message.role === "string" && message.role.trim() ? message.role.trim() : "user",
      content: typeof message.content === "string" ? message.content : "",
    }));
}

export function buildProviderRequest({
  executionPlan = {},
  requestEnvelope = {},
  operatorAuthorization = {},
} = {}) {
  const messages = normaliseMessages(requestEnvelope.messages ?? requestEnvelope.request?.messages);
  const body = {
    model: requestEnvelope.model ?? "operator-selected-model",
    messages,
    metadata: {
      openclawRequestId: requestEnvelope.id ?? executionPlan.requestEnvelopeHash ?? null,
      runbookRecordId: executionPlan.runbookRecordId ?? requestEnvelope.runbookRecordId ?? null,
      runbookContentHash: executionPlan.runbookContentHash ?? requestEnvelope.runbookContentHash ?? null,
      requestEnvelopeHash: executionPlan.requestEnvelopeHash ?? requestEnvelope.contentHash ?? null,
      endpointFingerprint: executionPlan.endpointFingerprint ?? requestEnvelope.endpointFingerprint ?? null,
      authorizationState: operatorAuthorization.state ?? "not_authorized",
    },
  };
  const bodyText = stableJson(body);
  return {
    ok: true,
    registry: PROVIDER_REQUEST_BUILDER_REGISTRY,
    mode: "phase_28_pure_provider_request_builder",
    request: {
      method: "POST",
      path: "/v1/chat/completions",
      headers: {
        "content-type": "application/json",
        "x-openclaw-egress-mode": "disabled",
      },
      body,
      bodyText,
      credentialReference: executionPlan.credentialReference ?? null,
      credentialValue: null,
      endpoint: {
        fingerprint: executionPlan.endpointFingerprint ?? null,
        contacted: false,
      },
    },
    governance: {
      pureFunction: true,
      mutatesModule: false,
      writesSource: false,
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready: messages.length > 0,
      messageCount: messages.length,
      hasCredentialReference: typeof executionPlan.credentialReference === "string",
      credentialValueIncluded: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
  };
}

export function buildCloudLiveProviderRuntimeAdapterModuleContract() {
  const implementedMethodCount = ADAPTER_METHODS.filter((method) => method.implemented).length;
  return {
    ok: true,
    registry: RUNTIME_ADAPTER_MODULE_REGISTRY,
    module: "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs",
    mode: "phase_24_live_provider_runtime_adapter_module_contract",
    status: "contract_skeleton_ready_no_live_egress",
    adapterKind: "cloud_consciousness_live_provider_call_runtime_adapter",
    implementationStatus: "contract_skeleton_only",
    methods: ADAPTER_METHODS,
    forbiddenOperations: [
      "provider_sdk_import",
      "credential_value_read",
      "endpoint_contact",
      "network_egress",
      "live_provider_call",
    ],
    governance: {
      phase: "phase-24",
      moduleBoundaryDefined: true,
      implementsRuntimeAdapter: false,
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready: true,
      complete: true,
      completionPercent: 100,
      moduleBoundaryDefined: true,
      methodCount: ADAPTER_METHODS.length,
      implementedMethodCount,
      pureProviderRequestBuilderReady: true,
      implementsRuntimeAdapter: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
  };
}
