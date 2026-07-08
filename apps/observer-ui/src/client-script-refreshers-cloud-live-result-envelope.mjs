export const observerClientCloudLiveResultEnvelopeRefreshersScript = `function liveProviderResultEnvelopeNoEgressLines(summary, includeLiveProviderCall) {
  const lines = [
    "Credential value read: " + Boolean(summary.credentialValueRead),
    "Provider credential read: " + Boolean(summary.providerCredentialRead),
    "Endpoint contacted: " + Boolean(summary.endpointContacted),
    "Network egress: " + Boolean(summary.networkEgress),
  ];
  if (includeLiveProviderCall) {
    lines.push("Live provider call: " + Boolean(summary.liveProviderCallEnabled));
  }
  return lines;
}

async function refreshLiveProviderResultEnvelopeDescriptor(descriptor) {
  try {
    const data = await fetchJson(observerConfig.coreUrl + descriptor.requestPath);
    const summary = data.summary ?? {};
    const elements = descriptor.elements();
    elements.ready.textContent = String(Boolean(summary.ready));
    if (elements.source) elements.source.textContent = summary.sourceTaskId ?? "none";
    if (elements.approval) elements.approval.textContent = "required";
    if (elements.credential) elements.credential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    if (elements.network) elements.network.textContent = summary.networkEgress === true ? "egress" : "no egress";
    elements.next.textContent = descriptor.nextText(data, summary);
    elements.json.textContent = descriptor.jsonLines(data, summary).join("\\n");
  } catch {
    const elements = descriptor.elements();
    elements.ready.textContent = "false";
    if (elements.source) elements.source.textContent = "none";
    if (elements.approval) elements.approval.textContent = "required";
    if (elements.credential) elements.credential.textContent = "not read";
    if (elements.network) elements.network.textContent = "no egress";
    elements.next.textContent = descriptor.catchNextFallback;
    elements.json.textContent = descriptor.errorMessage;
  }
}

const liveProviderResultEnvelopePilotDescriptors = {
  route: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope route.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeRouteReady,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeRouteCredential,
      network: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeRouteNetwork,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeRouteNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeRouteJson,
    }),
    nextText: (data) => data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell",
    jsonLines: (data, summary) => [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell"),
      "Result envelope task created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskCreated),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, true),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell"),
    ],
  },
  taskShell: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope task shell readiness.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskShellReady,
      approval: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskShellApproval,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskShellCredential,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskShellNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskShellJson,
    }),
    nextText: () => "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred",
    jsonLines: (data, summary) => [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-v0",
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-tasks",
      "Result envelope task created on demand: false",
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, false),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred",
    ],
  },
  approvedDeferred: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope approved deferred evidence.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferredReady,
      source: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferredSource,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferredCredential,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferredNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferredJson,
    }),
    nextText: (data) => data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
    jsonLines: (data, summary) => [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-v0"),
      "Result envelope task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskApproved),
      "Result envelope deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, true),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight"),
    ],
  },
  finalReadinessPreflight: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope final readiness preflight.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightReady,
      source: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightSource,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightCredential,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightJson,
    }),
    nextText: (data) => data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
    jsonLines: (data, summary) => [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-v0"),
      "Result envelope task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskApproved),
      "Result envelope deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, true),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route"),
    ],
  },
  creationRoute: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope creation route.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRouteReady,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRouteCredential,
      network: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRouteNetwork,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRouteNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRouteJson,
    }),
    nextText: (data) => data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell",
    jsonLines: (data, summary) => [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-v0"),
      "Final readiness preflight recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflightRecorded),
      "Creation task created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskCreated),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, true),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell"),
    ],
  },
  creationTaskShell: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope creation task shell readiness.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskShellReady,
      approval: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskShellApproval,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskShellCredential,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskShellNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskShellJson,
    }),
    nextText: () => "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred",
    jsonLines: (data, summary) => [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-v0",
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-tasks",
      "Creation task created on demand: false",
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, false),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred",
    ],
  },
  creationApprovedDeferred: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope creation approved deferred evidence.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationApprovedDeferredReady,
      source: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationApprovedDeferredSource,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationApprovedDeferredCredential,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationApprovedDeferredNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationApprovedDeferredJson,
    }),
    nextText: (data) => data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
    jsonLines: (data, summary) => [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-v0"),
      "Creation task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskApproved),
      "Creation deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, true),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight"),
    ],
  },
  creationFinalReadinessPreflight: {
    requestPath: "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
    catchNextFallback: "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route",
    errorMessage: "Unable to read live provider credential value local read execution local read attempt local read result envelope creation final readiness preflight.",
    elements: () => ({
      ready: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightReady,
      source: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightSource,
      credential: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightCredential,
      next: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightNext,
      json: cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightJson,
    }),
    nextText: (data) => data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route",
    jsonLines: (data, summary) => [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-v0"),
      "Creation task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskApproved),
      "Creation deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      ...liveProviderResultEnvelopeNoEgressLines(summary, true),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route"),
    ],
  },
};

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeRoute() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.route);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTaskShell() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.taskShell);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeApprovedDeferred() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.approvedDeferred);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflight() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.finalReadinessPreflight);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationRoute() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.creationRoute);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTaskShell() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.creationTaskShell);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationApprovedDeferred() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.creationApprovedDeferred);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight() {
  await refreshLiveProviderResultEnvelopeDescriptor(liveProviderResultEnvelopePilotDescriptors.creationFinalReadinessPreflight);
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRoute() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell"),
      "Creation final readiness recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflightRecorded),
      "Creation execution task created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionRouteJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShell() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-v0",
      "Source Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-tasks",
      "Creation execution task created on demand: false",
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShellJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferred() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-v0"),
      "Creation execution task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved),
      "Creation execution deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionApprovedDeferredJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded.textContent = String(Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-v0"),
      "Creation execution task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved),
      "Creation execution deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution final readiness preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRoute() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell"),
      "Execution final readiness recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded),
      "Execution attempt task created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptRouteJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShell() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-v0",
      "Source Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-tasks",
      "Execution attempt task created on demand: false",
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShellJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferred() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-v0"),
      "Execution attempt task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved),
      "Execution attempt deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded.textContent = String(Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-v0"),
      "Approved deferred found: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptApprovedDeferredFound),
      "Execution attempt task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved),
      "Execution attempt deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt final readiness preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRoute() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell"),
      "Attempt final readiness recorded: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflightRecorded),
      "Local read task created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskCreated),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRouteJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt local read route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShell() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0",
      "Source Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-tasks",
      "Local read task created on demand: false",
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskShellJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt local read task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferred() {
  try {
    const data = await fetchJson(observerConfig.coreUrl + "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred");
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-task-v0"),
      "Local read task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTaskApproved),
      "Local read deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadDeferred),
      "Result envelope created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadApprovedDeferredJson.textContent = "Unable to read live provider credential value local read execution local read attempt local read result envelope creation execution attempt local read approved deferred evidence.";
  }
}

`;
