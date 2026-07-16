const CAPABILITY_ID = "sense.openclaw.prompt_pack";

function requireBuilder(builder) {
  if (typeof builder !== "function") {
    throw new Error("Native OpenClaw prompt semantics builder is not configured.");
  }
  return builder;
}

export function createPromptPackCapabilityHandlers({
  buildNativeOpenClawPromptSemanticsProfile,
} = {}) {
  function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    return {
      handled: true,
      result: requireBuilder(buildNativeOpenClawPromptSemanticsProfile)({
        workspacePath: request.params?.workspacePath,
        query: request.params?.query ?? request.params?.q,
        limit: request.params?.limit,
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "openclaw.prompt_pack",
      ok: result?.ok === true,
      registry: result?.registry ?? null,
      totalFiles: summary.totalFiles ?? 0,
      contentRead: summary.contentRead ?? 0,
      expectedChecks: Array.isArray(summary.expectedChecks) ? summary.expectedChecks.length : 0,
      workStandardsStatus: summary.workStandardsStatus ?? result?.workStandards?.status ?? null,
      workStandardsSatisfied: summary.workStandardsSatisfied ?? result?.workStandards?.score?.satisfied ?? 0,
      workStandardsRequired: summary.workStandardsRequired ?? result?.workStandards?.score?.required ?? 0,
      noPromptContentExposure: summary.exposesPromptContent !== true
        && governance.exposesPromptContent !== true
        && governance.exposesSourceFileContent !== true,
      noPromptExecution: governance.canExecutePromptCode === false
        && governance.canExecuteToolCode === false,
      noMutation: governance.canMutate === false,
      noTaskCreation: governance.createsTask === false,
      noApprovalCreation: governance.createsApproval === false,
      noProviderEgress: governance.canCallProvider === false
        && governance.canUseNetwork === false,
    };
  }

  return { callBackend, summariseResult };
}
