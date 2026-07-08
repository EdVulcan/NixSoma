import { createCredentialLocalReadExecutionLocalReadAttemptRuntime } from "./cloud-live-provider-runtime-credential-local-read-execution-local-read-attempt.mjs";
import { createCredentialLocalReadExecutionLocalReadAttemptLocalReadRuntime } from "./cloud-live-provider-runtime-credential-local-read-execution-local-read-attempt-local-read.mjs";
import { createCredentialLocalReadResultEnvelopeRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope.mjs";
import { createCredentialLocalReadResultEnvelopeCreationRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-attempt.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionAttemptRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt.mjs";
import { createCredentialLocalReadResultEnvelopeCreationExecutionRuntime } from "./cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution.mjs";

export function createCloudLiveProviderRuntimeCredentialLocalReadLateBuilders(context) {
  const {
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadFinalReadinessPreflight,
    createTask,
    createApprovalRequestForTask,
    evaluatePolicyIntent,
    publishEvent,
    publishTaskApprovalIfPending,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    serialiseTask,
    appendTaskPhase,
    completeTask,
    approvals,
    getTaskById,
    listTasks,
  } = context;

  const taskRuntimeContext = {
    createTask,
    createApprovalRequestForTask,
    evaluatePolicyIntent,
    publishEvent,
    publishTaskApprovalIfPending,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    serialiseTask,
    appendTaskPhase,
    completeTask,
    approvals,
    getTaskById,
    listTasks,
  };

  const attemptRuntime = createCredentialLocalReadExecutionLocalReadAttemptRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadFinalReadinessPreflight,
    ...taskRuntimeContext,
  });

  const attemptLocalReadRuntime = createCredentialLocalReadExecutionLocalReadAttemptLocalReadRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptFinalReadinessPreflight:
      attemptRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptFinalReadinessPreflight,
    ...taskRuntimeContext,
  });

  const resultEnvelopeRuntime = createCredentialLocalReadResultEnvelopeRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflight:
      attemptLocalReadRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflight,
    ...taskRuntimeContext,
  });

  const resultEnvelopeCreationRuntime = createCredentialLocalReadResultEnvelopeCreationRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflight:
      resultEnvelopeRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflight,
    ...taskRuntimeContext,
  });

  const resultEnvelopeCreationExecutionRuntime = createCredentialLocalReadResultEnvelopeCreationExecutionRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight:
      resultEnvelopeCreationRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight,
    ...taskRuntimeContext,
  });

  const resultEnvelopeCreationExecutionAttemptRuntime = createCredentialLocalReadResultEnvelopeCreationExecutionAttemptRuntime({
    buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight:
      resultEnvelopeCreationExecutionRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight,
    ...taskRuntimeContext,
  });

  const resultEnvelopeCreationExecutionAttemptLocalReadRuntime =
    createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadRuntime({
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight:
        resultEnvelopeCreationExecutionAttemptRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight,
      ...taskRuntimeContext,
    });

  const resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime =
    createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime({
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflight:
        resultEnvelopeCreationExecutionAttemptLocalReadRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadFinalReadinessPreflight,
      ...taskRuntimeContext,
    });
  const resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime =
    createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime({
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight:
        resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeFinalReadinessPreflight,
      ...taskRuntimeContext,
    });
  const resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime =
    createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime({
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionRoute:
        resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionRoute,
      ...taskRuntimeContext,
    });
  const resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRuntime =
    createCredentialLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRuntime({
      buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight:
        resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime.buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight,
    });

  return {
    ...attemptRuntime,
    ...attemptLocalReadRuntime,
    ...resultEnvelopeRuntime,
    ...resultEnvelopeCreationRuntime,
    ...resultEnvelopeCreationExecutionRuntime,
    ...resultEnvelopeCreationExecutionAttemptRuntime,
    ...resultEnvelopeCreationExecutionAttemptLocalReadRuntime,
    ...resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeRuntime,
    ...resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationRuntime,
    ...resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShellRuntime,
    ...resultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttemptRuntime,
  };
}
