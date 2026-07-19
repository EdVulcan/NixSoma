import { createHash } from "node:crypto";

const RUNTIME_ADAPTER_MODULE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract-v0";
const PROVIDER_REQUEST_BUILDER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-request-builder-v0";
const CREDENTIAL_REFERENCE_RESOLVER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-v0";
const PROVIDER_REQUEST_SENDER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-send-provider-request-v0";
const EGRESS_TRANSCRIPT_RECORDER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-v0";
const PROVIDER_RESPONSE_VERIFIER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-response-verifier-v0";
const ROLLBACK_NOTE_BUILDER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-rollback-note-v0";

const ADAPTER_METHODS = [
  {
    name: "buildProviderRequest",
    implemented: true,
    boundary: "pure serialization only; no credential values, SDK calls, or network egress",
  },
  {
    name: "resolveCredentialReference",
    implemented: true,
    boundary: "reference validation only; no credential values are read or exposed",
  },
  {
    name: "sendProviderRequest",
    implemented: true,
    boundary: "no-network sender envelope only; endpoint contact and network egress remain deferred",
  },
  {
    name: "recordEgressTranscript",
    implemented: true,
    boundary: "local transcript recorder only; no credential values, endpoint contact, or network egress",
  },
  {
    name: "verifyProviderResponse",
    implemented: true,
    boundary: "local response rehearsal verifier only; no provider response creation or live calls",
  },
  {
    name: "buildRollbackNote",
    implemented: true,
    boundary: "operator-visible local rollback note only; no rollback command or host mutation",
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

function stableHash(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
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
  if (Object.prototype.hasOwnProperty.call(requestEnvelope, "temperature")) {
    body.temperature = requestEnvelope.temperature;
  }
  if (Object.prototype.hasOwnProperty.call(requestEnvelope, "max_tokens")) {
    body.max_tokens = requestEnvelope.max_tokens;
  }
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

export function resolveCredentialReference({
  executionPlan = {},
  credentialReference,
} = {}) {
  const reference = credentialReference ?? executionPlan.credentialReference ?? null;
  const validReference = typeof reference === "string" && reference.startsWith("openclaw://credential/");
  return {
    ok: true,
    registry: CREDENTIAL_REFERENCE_RESOLVER_REGISTRY,
    mode: "phase_32_credential_reference_resolver",
    credential: {
      reference,
      validReference,
      scope: validReference ? reference.replace("openclaw://credential/", "") : null,
      value: null,
      valueHash: null,
      resolvedValue: null,
    },
    governance: {
      pureFunction: true,
      referenceOnly: true,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready: validReference,
      credentialReferencePresent: typeof reference === "string",
      validReference,
      referenceOnly: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
  };
}

export function sendProviderRequest({
  providerRequest = {},
  credentialResolution = {},
  operatorAuthorization = {},
} = {}) {
  const request = providerRequest.request ?? {};
  const credential = credentialResolution.credential ?? {};
  const credentialReference = request.credentialReference ?? credential.reference ?? null;
  const bodyText = typeof request.bodyText === "string" ? request.bodyText : stableJson(request.body ?? null);
  const ready = typeof bodyText === "string"
    && bodyText.length > 0
    && typeof credentialReference === "string"
    && credential.value === null
    && credential.resolvedValue === null;
  return {
    ok: true,
    registry: PROVIDER_REQUEST_SENDER_REGISTRY,
    mode: "phase_36_no_network_provider_request_sender",
    egressEnvelope: {
      dispatch: "deferred",
      method: request.method ?? "POST",
      path: request.path ?? "/v1/chat/completions",
      headers: {
        ...(request.headers ?? {}),
        "x-openclaw-egress-mode": "disabled",
      },
      bodyText,
      credentialReference,
      credentialValue: null,
      endpoint: {
        ...(request.endpoint ?? {}),
        contacted: false,
      },
      operatorAuthorizationState: operatorAuthorization.state ?? "not_authorized",
      response: null,
    },
    governance: {
      pureFunction: true,
      noNetworkSenderEnvelope: true,
      referenceOnly: true,
      dispatchDeferred: true,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready,
      noNetworkSenderReady: ready,
      requestPrepared: typeof bodyText === "string" && bodyText.length > 0,
      credentialReferencePresent: typeof credentialReference === "string",
      referenceOnly: true,
      dispatchDeferred: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      liveProviderCallEnabled: false,
    },
  };
}

export function recordEgressTranscript({
  egressEnvelope = {},
  providerRequest = {},
  credentialResolution = {},
  operatorAuthorization = {},
} = {}) {
  const envelope = egressEnvelope.egressEnvelope ?? egressEnvelope ?? {};
  const request = providerRequest.request ?? {};
  const credential = credentialResolution.credential ?? {};
  const endpoint = envelope.endpoint ?? request.endpoint ?? {};
  const bodyText = typeof envelope.bodyText === "string"
    ? envelope.bodyText
    : typeof request.bodyText === "string"
      ? request.bodyText
      : stableJson(request.body ?? null);
  const requestContentHash = stableHash(bodyText);
  const credentialReference = envelope.credentialReference ?? request.credentialReference ?? credential.reference ?? null;
  const dispatch = envelope.dispatch ?? "deferred";
  const transcriptSeed = {
    schema: "openclaw.cloud_consciousness.live_provider_egress_transcript.v0",
    requestContentHash,
    endpointFingerprint: endpoint.fingerprint ?? null,
    credentialReference,
    dispatch,
  };
  const transcript = {
    id: `openclaw-live-provider-egress-transcript-${stableHash(transcriptSeed).slice(0, 16)}`,
    createdAt: new Date().toISOString(),
    schema: "openclaw.cloud_consciousness.live_provider_egress_transcript.v0",
    requestId: request.body?.metadata?.openclawRequestId ?? requestContentHash,
    requestContentHash,
    operatorChecklistHash: operatorAuthorization.operatorChecklistHash ?? null,
    endpointFingerprint: endpoint.fingerprint ?? null,
    credentialSource: {
      reference: credentialReference,
      referenceOnly: true,
      valueIncluded: false,
      valueHash: null,
    },
    redactionPolicy: {
      bodyStored: false,
      bodyHashOnly: true,
      credentialValueIncluded: false,
      providerResponseIncluded: false,
    },
    egressDecision: {
      dispatch,
      authorized: operatorAuthorization.state === "authorized",
      reason: dispatch === "deferred"
        ? "no_network_sender_deferred"
        : "non_live_transcript_recorded_without_dispatch",
    },
    liveCallStatus: "operator_deferred",
    noNetworkEnvelope: {
      method: envelope.method ?? request.method ?? "POST",
      path: envelope.path ?? request.path ?? "/v1/chat/completions",
      headerNames: Object.keys(envelope.headers ?? request.headers ?? {}).sort(),
      dispatchDeferred: dispatch === "deferred",
      endpointContacted: false,
      networkEgress: false,
    },
    providerResponse: null,
  };
  transcript.contentHash = stableHash(transcript);
  const ready = typeof credentialReference === "string"
    && bodyText.length > 0
    && dispatch === "deferred"
    && envelope.response === null
    && (envelope.credentialValue ?? null) === null
    && (credential.value ?? null) === null
    && (credential.resolvedValue ?? null) === null;
  return {
    ok: true,
    registry: EGRESS_TRANSCRIPT_RECORDER_REGISTRY,
    mode: "phase_40_local_egress_transcript_recorder",
    transcript,
    governance: {
      pureFunction: true,
      transcriptRecorded: true,
      localOnly: true,
      referenceOnly: true,
      dispatchDeferred: true,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready,
      transcriptRecorded: true,
      localOnly: true,
      referenceOnly: true,
      dispatchDeferred: dispatch === "deferred",
      credentialReferencePresent: typeof credentialReference === "string",
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    },
  };
}

export function verifyProviderResponse({
  providerResponseReadback = {},
  egressTranscriptRecord = {},
  operatorAuthorization = {},
} = {}) {
  const latest = providerResponseReadback.response?.latest ?? providerResponseReadback.latest ?? null;
  const transcript = egressTranscriptRecord.transcript ?? egressTranscriptRecord ?? null;
  const localRehearsal = latest?.schema === "openclaw.cloud_consciousness.provider_call_rehearsal.v0";
  const transcriptDeferred = transcript?.egressDecision?.dispatch === "deferred"
    && transcript?.providerResponse === null
    && transcript?.noNetworkEnvelope?.networkEgress === false;
  const safeReadback = localRehearsal
    && latest?.transmittedExternally === false
    && latest?.cloudCallExecuted === false
    && latest?.providerSdkLoaded === false
    && latest?.credentialRead === false
    && typeof latest?.contentHash === "string"
    && latest.contentHash.length > 0;
  const ready = safeReadback && transcriptDeferred;
  return {
    ok: true,
    registry: PROVIDER_RESPONSE_VERIFIER_REGISTRY,
    mode: "phase_44_local_provider_response_verifier",
    verification: {
      responseRecordId: latest?.id ?? null,
      responseContentHash: latest?.contentHash ?? null,
      responseSchema: latest?.schema ?? null,
      responseSource: "local_rehearsal_readback",
      transcriptId: transcript?.id ?? null,
      transcriptContentHash: transcript?.contentHash ?? null,
      transcriptDispatch: transcript?.egressDecision?.dispatch ?? null,
      authorized: operatorAuthorization.state === "authorized",
      localRehearsal,
      safeReadback,
      transcriptDeferred,
      providerResponseCreated: false,
    },
    governance: {
      pureFunction: true,
      responseVerified: true,
      localOnly: true,
      responseSource: "local_rehearsal_readback",
      dispatchDeferred: transcriptDeferred,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready,
      responseVerified: true,
      localOnly: true,
      responseSource: "local_rehearsal_readback",
      localRehearsal,
      safeReadback,
      transcriptDeferred,
      dispatchDeferred: transcriptDeferred,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    },
  };
}

export function buildRollbackNote({
  responseVerification = {},
  egressTranscriptRecord = {},
  operatorAuthorization = {},
} = {}) {
  const verification = responseVerification.verification ?? responseVerification ?? {};
  const transcript = egressTranscriptRecord.transcript ?? egressTranscriptRecord ?? {};
  const noExternalSend = verification.transcriptDeferred === true
    && verification.providerResponseCreated === false
    && responseVerification.summary?.networkEgress !== true;
  const noteSeed = {
    responseRecordId: verification.responseRecordId ?? null,
    transcriptId: transcript.id ?? verification.transcriptId ?? null,
    noExternalSend,
  };
  const note = {
    id: `openclaw-live-provider-rollback-note-${stableHash(noteSeed).slice(0, 16)}`,
    createdAt: new Date().toISOString(),
    schema: "openclaw.cloud_consciousness.live_provider_rollback_note.v0",
    responseRecordId: verification.responseRecordId ?? null,
    responseContentHash: verification.responseContentHash ?? null,
    transcriptId: transcript.id ?? verification.transcriptId ?? null,
    transcriptContentHash: transcript.contentHash ?? verification.transcriptContentHash ?? null,
    operatorAuthorizationState: operatorAuthorization.state ?? "not_authorized",
    rollbackRequired: false,
    rollbackExecuted: false,
    rollbackCommand: null,
    rollbackReason: noExternalSend
      ? "No external provider send or provider response creation occurred; rollback is note-only and operator-visible."
      : "Rollback remains operator-reviewed because the adapter did not prove a safe deferred state.",
    operatorGuidance: [
      "Keep live provider egress disabled.",
      "Do not retry with real network egress until a separate operator-reviewed launch path is approved.",
      "Use transcript and response verifier evidence for audit before any future live call.",
    ],
    nextSafeAction: "review_before_any_live_provider_launch",
  };
  note.contentHash = stableHash(note);
  const ready = noExternalSend && typeof verification.responseRecordId === "string";
  return {
    ok: true,
    registry: ROLLBACK_NOTE_BUILDER_REGISTRY,
    mode: "phase_48_local_provider_rollback_note",
    note,
    governance: {
      pureFunction: true,
      rollbackNoteReady: true,
      localOnly: true,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      dispatchDeferred: verification.transcriptDeferred === true,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    },
    summary: {
      ready,
      rollbackNoteReady: true,
      localOnly: true,
      rollbackRequired: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      dispatchDeferred: verification.transcriptDeferred === true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
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
      pureCredentialReferenceResolverReady: true,
      noNetworkProviderRequestSenderReady: true,
      localEgressTranscriptRecorderReady: true,
      localProviderResponseVerifierReady: true,
      localRollbackNoteBuilderReady: true,
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
