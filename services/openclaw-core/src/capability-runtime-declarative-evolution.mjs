const CAPABILITY_ID = "plan.openclaw.declarative_evolution.managed_config_candidate";
const STAGING_TASK_CAPABILITY_ID = "act.openclaw.declarative_evolution.staging_task";

function blockedTaskResult(reason) {
  return {
    ok: false,
    blocked: true,
    reason,
    registry: "openclaw-native-declarative-evolution-staging-task-v0",
    mode: "capability-runtime-declarative-evolution-task",
    governance: {
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      writesManagedConfig: false,
      switchesGeneration: false,
      executesRollback: false,
      networkEgress: false,
    },
  };
}

export function createDeclarativeEvolutionCapabilityHandlers({
  buildNativeDeclarativeEvolutionCandidate,
  createNativeDeclarativeEvolutionStagingTask,
} = {}) {
  function validateRequest(capability, request) {
    if (![CAPABILITY_ID, STAGING_TASK_CAPABILITY_ID].includes(capability.id)) {
      return null;
    }
    if (!Array.isArray(request.params?.changes) || request.params.changes.length === 0) {
      return "Declarative evolution candidate requires a non-empty changes array.";
    }
    if (capability.id === STAGING_TASK_CAPABILITY_ID && request.params?.confirm !== undefined
      && typeof request.params.confirm !== "boolean") {
      return "Declarative evolution staging task confirm must be a boolean.";
    }
    return null;
  }

  async function callBackend(capability, request) {
    if (capability.id === STAGING_TASK_CAPABILITY_ID) {
      if (request.params?.confirm !== true) {
        return {
          handled: true,
          result: blockedTaskResult("operator_confirmation_required"),
        };
      }
      if (typeof createNativeDeclarativeEvolutionStagingTask !== "function") {
        throw new Error("Native declarative evolution staging task builder is unavailable.");
      }
      return {
        handled: true,
        result: await createNativeDeclarativeEvolutionStagingTask({
          changes: request.params.changes,
          confirm: true,
        }),
      };
    }
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
    if (capability.id === STAGING_TASK_CAPABILITY_ID) {
      return {
        kind: "declarative_evolution.staging_task",
        ok: result?.ok === true,
        blocked: result?.blocked === true,
        reason: result?.reason ?? null,
        taskId: result?.task?.id ?? null,
        approvalId: result?.approval?.id ?? null,
        candidateHash: result?.approvalBinding?.candidateHash ?? result?.candidate?.candidateHash ?? null,
        createsTask: result?.governance?.createsTask === true,
        createsApproval: result?.governance?.createsApproval === true,
        canExecuteWithoutApproval: result?.governance?.canExecuteWithoutApproval === true,
        noManagedConfigWrite: result?.governance?.writesManagedConfig === false,
        noGenerationSwitch: result?.governance?.switchesGeneration === false,
        noRollback: result?.governance?.executesRollback === false,
        noProviderEgress: result?.governance?.networkEgress === false,
      };
    }
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
