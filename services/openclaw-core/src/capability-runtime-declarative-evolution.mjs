const CAPABILITY_ID = "plan.openclaw.declarative_evolution.managed_config_candidate";

export function createDeclarativeEvolutionCapabilityHandlers({
  buildNativeDeclarativeEvolutionCandidate,
} = {}) {
  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return null;
    }
    if (!Array.isArray(request.params?.changes) || request.params.changes.length === 0) {
      return "Declarative evolution candidate requires a non-empty changes array.";
    }
    return null;
  }

  async function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    return {
      handled: true,
      result: await buildNativeDeclarativeEvolutionCandidate({
        changes: request.params.changes,
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) {
      return null;
    }
    return {
      kind: "declarative_evolution.managed_config_candidate",
      ok: result?.ok === true,
      candidateStatus: result?.candidateStatus ?? null,
      validationStatus: result?.validation?.status ?? null,
      changeCount: Array.isArray(result?.changes) ? result.changes.length : 0,
      candidateBytes: result?.candidateBytes ?? null,
      candidateHash: result?.candidateHash ?? null,
      targetPath: result?.target?.path ?? null,
      noManagedConfigWrite: result?.governance?.writesManagedConfig === false,
      noGenerationSwitch: result?.governance?.switchesGeneration === false,
      noRollback: result?.governance?.executesRollback === false,
      noTaskCreation: result?.governance?.createsTask === false,
      noApprovalCreation: result?.governance?.createsApproval === false,
      noProviderEgress: result?.governance?.callsProvider === false
        && result?.governance?.networkEgress === false,
      candidateTextInSummary: false,
    };
  }

  return { validateRequest, callBackend, summariseResult };
}
