import {
  NATIVE_DECLARATIVE_EVOLUTION_HEALTH_GATE_CAPABILITY_ID,
} from "./native-declarative-evolution-health-gate.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_CAPABILITY_ID,
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY,
} from "./native-declarative-evolution-activation-decision.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_CAPABILITY_ID,
  NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY,
} from "./native-declarative-evolution-activation.mjs";

const CAPABILITY_ID = "plan.openclaw.declarative_evolution.managed_config_candidate";
const STAGING_TASK_CAPABILITY_ID = "act.openclaw.declarative_evolution.staging_task";
const HEALTH_GATE_CAPABILITY_ID = NATIVE_DECLARATIVE_EVOLUTION_HEALTH_GATE_CAPABILITY_ID;
const ACTIVATION_DECISION_CAPABILITY_ID = NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_CAPABILITY_ID;
const ACTIVATION_CAPABILITY_ID = NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_CAPABILITY_ID;

function blockedTaskResult(reason, registry = "openclaw-native-declarative-evolution-staging-task-v0") {
  return {
    ok: false,
    blocked: true,
    reason,
    registry,
    mode: "capability-runtime-declarative-evolution-task",
    governance: {
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      writesManagedConfig: false,
      switchesGeneration: false,
      executesActivation: false,
      executesRollback: false,
      automaticActivation: false,
      automaticRollback: false,
      networkEgress: false,
    },
  };
}

export function createDeclarativeEvolutionCapabilityHandlers({
  buildNativeDeclarativeEvolutionCandidate,
  buildNativeDeclarativeEvolutionHealthGate,
  createNativeDeclarativeEvolutionStagingTask,
  createNativeDeclarativeEvolutionActivationDecisionTask,
  createNativeDeclarativeEvolutionActivationTask,
} = {}) {
  function validateRequest(capability, request) {
    if (![CAPABILITY_ID, STAGING_TASK_CAPABILITY_ID, HEALTH_GATE_CAPABILITY_ID, ACTIVATION_DECISION_CAPABILITY_ID, ACTIVATION_CAPABILITY_ID].includes(capability.id)) {
      return null;
    }
    if (capability.id === HEALTH_GATE_CAPABILITY_ID) {
      if (typeof request.params?.taskId !== "string" || !request.params.taskId.trim()) {
        return "Declarative evolution health gate requires taskId.";
      }
      return null;
    }
    if (capability.id === ACTIVATION_DECISION_CAPABILITY_ID) {
      if (typeof request.params?.taskId !== "string" || !request.params.taskId.trim()) {
        return "Declarative evolution activation decision requires taskId.";
      }
      if (!["approve_activation_review", "reject_activation"].includes(request.params?.decision)) {
        return "Declarative evolution activation decision requires a supported decision.";
      }
      if (request.params?.confirm !== undefined && typeof request.params.confirm !== "boolean") {
        return "Declarative evolution activation decision confirm must be a boolean.";
      }
      return null;
    }
    if (capability.id === ACTIVATION_CAPABILITY_ID) {
      if (typeof request.params?.activationDecisionTaskId !== "string" || !request.params.activationDecisionTaskId.trim()) {
        return "Declarative evolution activation requires activationDecisionTaskId.";
      }
      if (request.params?.confirm !== undefined && typeof request.params.confirm !== "boolean") {
        return "Declarative evolution activation confirm must be a boolean.";
      }
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
    if (capability.id === HEALTH_GATE_CAPABILITY_ID) {
      if (typeof buildNativeDeclarativeEvolutionHealthGate !== "function") {
        throw new Error("Native declarative evolution health-gate builder is unavailable.");
      }
      return {
        handled: true,
        result: await buildNativeDeclarativeEvolutionHealthGate({
          taskId: request.params.taskId,
        }),
      };
    }
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
    if (capability.id === ACTIVATION_DECISION_CAPABILITY_ID) {
      if (request.params?.confirm !== true) {
        return {
          handled: true,
          result: blockedTaskResult("operator_confirmation_required", NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_DECISION_REGISTRY),
        };
      }
      if (typeof createNativeDeclarativeEvolutionActivationDecisionTask !== "function") {
        throw new Error("Native declarative evolution activation decision builder is unavailable.");
      }
      return {
        handled: true,
        result: await createNativeDeclarativeEvolutionActivationDecisionTask({
          taskId: request.params.taskId,
          decision: request.params.decision,
          confirm: true,
        }),
      };
    }
    if (capability.id === ACTIVATION_CAPABILITY_ID) {
      if (request.params?.confirm !== true) {
        return {
          handled: true,
          result: blockedTaskResult("operator_confirmation_required", NATIVE_DECLARATIVE_EVOLUTION_ACTIVATION_REGISTRY),
        };
      }
      if (typeof createNativeDeclarativeEvolutionActivationTask !== "function") {
        throw new Error("Native declarative evolution activation builder is unavailable.");
      }
      return {
        handled: true,
        result: await createNativeDeclarativeEvolutionActivationTask({
          activationDecisionTaskId: request.params.activationDecisionTaskId,
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
    if (capability.id === HEALTH_GATE_CAPABILITY_ID) {
      return {
        kind: "declarative_evolution.health_gate",
        ok: result?.ok === true,
        blocked: result?.blocked === true,
        reason: result?.reason ?? null,
        taskId: result?.taskId ?? null,
        candidateHash: result?.candidate?.candidateHash ?? null,
        stagedFileHash: result?.staging?.fileHash ?? null,
        evaluatedToplevelPath: result?.evaluatedClosure?.path ?? null,
        assessment: result?.assessment?.status ?? null,
        eligibleForActivationReview: result?.assessment?.eligibleForActivationReview === true,
        failedCheckCount: Array.isArray(result?.failedChecks) ? result.failedChecks.length : null,
        hostHealth: result?.assessment?.hostHealth ?? "not_assessed",
        noManagedConfigWrite: result?.governance?.writesManagedConfig === false,
        noGenerationSwitch: result?.governance?.switchesGeneration === false,
        noRollback: result?.governance?.executesRollback === false,
        noHostHealthAssessment: result?.governance?.assessesHostHealth === false,
        noAutomaticActivation: result?.governance?.automaticActivation === false,
        noAutomaticRollback: result?.governance?.automaticRollback === false,
        candidateTextInSummary: false,
      };
    }
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
    if (capability.id === ACTIVATION_DECISION_CAPABILITY_ID) {
      return {
        kind: "declarative_evolution.activation_decision",
        ok: result?.ok === true,
        blocked: result?.blocked === true,
        reason: result?.reason ?? null,
        taskId: result?.task?.id ?? null,
        approvalId: result?.approval?.id ?? null,
        sourceStagingTaskId: result?.approvalBinding?.sourceStagingTaskId ?? result?.review?.sourceTaskId ?? null,
        decision: result?.approvalBinding?.decision ?? null,
        candidateHash: result?.approvalBinding?.candidateHash ?? null,
        hostHealthHash: result?.approvalBinding?.hostHealthHash ?? null,
        hostHealthStatus: result?.review?.hostHealth?.status ?? null,
        activationReady: result?.review?.activationReady === true,
        createsTask: result?.governance?.createsTask === true,
        createsApproval: result?.governance?.createsApproval === true,
        activationExecuted: result?.task?.nativeDeclarativeEvolution?.execution?.activationExecuted === true,
        noManagedConfigWrite: result?.governance?.writesManagedConfig === false,
        noGenerationSwitch: result?.governance?.switchesGeneration === false,
        noRollback: result?.governance?.executesRollback === false,
        noAutomaticActivation: result?.governance?.automaticActivation === false,
        noAutomaticRollback: result?.governance?.automaticRollback === false,
        candidateTextInSummary: false,
      };
    }
    if (capability.id === ACTIVATION_CAPABILITY_ID) {
      return {
        kind: "declarative_evolution.activation",
        ok: result?.ok === true,
        blocked: result?.blocked === true,
        reason: result?.reason ?? null,
        taskId: result?.task?.id ?? null,
        approvalId: result?.approval?.id ?? null,
        activationDecisionTaskId: result?.approvalBinding?.activationDecisionTaskId ?? null,
        sourceStagingTaskId: result?.approvalBinding?.sourceStagingTaskId ?? null,
        candidateHash: result?.approvalBinding?.candidateHash ?? null,
        evaluatedClosurePath: result?.approvalBinding?.evaluatedClosurePath ?? null,
        createsTask: result?.governance?.createsTask === true,
        createsApproval: result?.governance?.createsApproval === true,
        activationExecuted: result?.task?.nativeDeclarativeEvolution?.execution?.activationExecuted === true,
        noAutomaticActivation: result?.governance?.automaticActivation === false,
        noAutomaticRollback: result?.governance?.automaticRollback === false,
        rollbackManualOnly: result?.governance?.executesRollback === false,
        candidateTextInSummary: false,
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
