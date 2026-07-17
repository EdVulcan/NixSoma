import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { isNativeDeclarativeEvolutionStagingTask } from "./task-recovery.mjs";

const EXECUTION_REGISTRY = "openclaw-native-declarative-evolution-staging-execution-v0";

function compactExecution(execution) {
  return {
    status: execution?.status ?? null,
    reason: execution?.reason ?? null,
    candidateHash: execution?.candidateHash ?? null,
    staging: execution?.staging
      ? {
          status: execution.staging.status ?? null,
          directory: execution.staging.directory ?? null,
          path: execution.staging.path ?? null,
          candidateHash: execution.staging.candidateHash ?? null,
          candidateBytes: execution.staging.candidateBytes ?? null,
        }
      : null,
    validation: execution?.validation ?? null,
    evaluation: execution?.evaluation ?? null,
    build: execution?.build ?? null,
    governance: execution?.governance ?? null,
  };
}

function approvalMatchesCandidate(task, approval) {
  const expectedHash = task?.nativeDeclarativeEvolution?.approvalBinding?.candidateHash;
  return typeof expectedHash === "string"
    && approval?.binding?.kind === "native_declarative_evolution_candidate"
    && approval.binding.candidateHash === expectedHash;
}

export function createNativeDeclarativeEvolutionTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  planBuilder,
  publishEvent,
}) {
  const { approvals } = state;
  const {
    serialiseTask,
    isActiveTask,
    setTaskPhase,
    completeTask,
    failTask,
  } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy, isPolicyExecutionAllowed } = policyEvaluator;

  async function executeNativeDeclarativeEvolutionStagingTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("Native declarative evolution staging task is not active.");
    }

    const policy = ensureTaskPolicy(task, { stage: "declarative_evolution.staging.execute" });
    await publishEvent(createEventName("policy.evaluated"), {
      task: serialiseTask(task),
      policy: policy.decision,
    });
    if (policy.decision?.decision === "deny") {
      const failedTask = failTask(task, "Policy denied declarative evolution staging execution.", {
        executor: EXECUTION_REGISTRY,
        policy: policy.decision,
        candidateHash: task.nativeDeclarativeEvolution?.candidate?.candidateHash ?? null,
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: "policy_denied",
        executor: EXECUTION_REGISTRY,
      });
      return {
        task: failedTask,
        blocked: false,
        actions: [],
        capabilityInvocations: [],
        verification: null,
        policy: policy.decision,
      };
    }

    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!approval || approval.status !== "approved") {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: EXECUTION_REGISTRY,
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          candidateHash: task.nativeDeclarativeEvolution?.candidate?.candidateHash ?? null,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: EXECUTION_REGISTRY,
      });
      return {
        task: waitingTask,
        blocked: true,
        reason: "policy_requires_approval",
        actions: [],
        capabilityInvocations: [],
        verification: null,
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
      };
    }

    if (!approvalMatchesCandidate(task, approval)) {
      const failedTask = failTask(task, "Approval binding does not match the declarative evolution candidate hash.", {
        executor: EXECUTION_REGISTRY,
        reason: "approval_candidate_hash_mismatch",
        approvalId: approval.id,
        approvalCandidateHash: approval.binding?.candidateHash ?? null,
        taskCandidateHash: task.nativeDeclarativeEvolution?.candidate?.candidateHash ?? null,
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: "approval_candidate_hash_mismatch",
        executor: EXECUTION_REGISTRY,
      });
      return {
        task: failedTask,
        blocked: false,
        actions: [],
        capabilityInvocations: [],
        verification: null,
        policy: policy.decision,
        approval: serialiseApproval(approval),
      };
    }

    if (!isPolicyExecutionAllowed(policy.decision)) {
      const failedTask = failTask(task, `Policy blocked declarative evolution staging: ${policy.decision.reason}`, {
        executor: EXECUTION_REGISTRY,
        policy: policy.decision,
        approval: serialiseApproval(approval),
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: "policy_blocked",
        executor: EXECUTION_REGISTRY,
      });
      return {
        task: failedTask,
        blocked: false,
        actions: [],
        capabilityInvocations: [],
        verification: null,
        policy: policy.decision,
        approval: serialiseApproval(approval),
      };
    }

    const expectedHash = task.nativeDeclarativeEvolution?.candidate?.candidateHash ?? null;
    const changes = task.nativeDeclarativeEvolution?.candidate?.changes ?? [];
    await setTaskPhase(task, "revalidating_candidate_hash", {
      status: "running",
      details: {
        executor: EXECUTION_REGISTRY,
        candidateHash: expectedHash,
        approvalId: approval.id,
      },
    });

    try {
      const candidate = await planBuilder.buildNativeDeclarativeEvolutionCandidate({ changes });
      if (candidate?.candidateStatus !== "validated" || candidate.candidateHash !== expectedHash) {
        const failedTask = failTask(task, "Declarative evolution candidate changed after approval; staging was refused.", {
          executor: EXECUTION_REGISTRY,
          reason: "candidate_hash_mismatch",
          expectedCandidateHash: expectedHash,
          observedCandidateHash: candidate?.candidateHash ?? null,
          validationStatus: candidate?.validation?.status ?? null,
        });
        await publishEvent(createEventName("task.failed"), {
          task: serialiseTask(failedTask),
          reason: "candidate_hash_mismatch",
          executor: EXECUTION_REGISTRY,
        });
        return {
          task: failedTask,
          blocked: false,
          actions: [],
          capabilityInvocations: [],
          verification: null,
          policy: policy.decision,
          approval: serialiseApproval(approval),
        };
      }

      await setTaskPhase(task, "staging_and_read_only_nixos_build", {
        status: "running",
        details: {
          executor: EXECUTION_REGISTRY,
          candidateHash: expectedHash,
          approvalId: approval.id,
          writesManagedConfig: false,
          switchesGeneration: false,
          executesRollback: false,
        },
      });
      const execution = await planBuilder.executeNativeDeclarativeEvolutionCandidate({
        candidateText: candidate.candidateText,
        candidateHash: expectedHash,
      });
      const compact = compactExecution({ ...execution, registry: EXECUTION_REGISTRY });
      task.nativeDeclarativeEvolution.execution = compact;
      task.nativeDeclarativeEvolution.governance = {
        ...task.nativeDeclarativeEvolution.governance,
        executed: execution.status === "passed",
        candidateHashBound: true,
        approvalBoundToCandidateHash: true,
      };

      if (execution.status !== "passed") {
        const failedTask = failTask(task, `Read-only NixOS candidate check failed: ${execution.reason ?? "unknown"}.`, {
          executor: EXECUTION_REGISTRY,
          candidateHash: expectedHash,
          execution: compact,
          approvalId: approval.id,
        });
        await publishEvent(createEventName("task.failed"), {
          task: serialiseTask(failedTask),
          reason: execution.reason ?? "nixos_candidate_check_failed",
          executor: EXECUTION_REGISTRY,
        });
        return {
          task: failedTask,
          blocked: false,
          actions: [],
          capabilityInvocations: [],
          verification: null,
          policy: policy.decision,
          approval: serialiseApproval(approval),
        };
      }

      const completedTask = completeTask(task, {
        executor: EXECUTION_REGISTRY,
        summary: `Staged and read-only checked approved managed Nix candidate ${expectedHash}.`,
        candidateHash: expectedHash,
        approvalId: approval.id,
        execution: compact,
        governance: execution.governance,
      });
      await publishEvent(createEventName("task.completed"), {
        task: serialiseTask(completedTask),
        executor: EXECUTION_REGISTRY,
        candidateHash: expectedHash,
      });
      return {
        task: completedTask,
        blocked: false,
        actions: [],
        capabilityInvocations: [],
        verification: {
          ok: true,
          checks: ["candidate_hash_bound", "approval_hash_bound", "staging_file_written", "nixos_evaluation", "nixos_build"],
          failedChecks: [],
        },
        policy: policy.decision,
        approval: serialiseApproval(approval),
        declarativeEvolution: compact,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown declarative evolution execution error";
      const failedTask = failTask(task, message, {
        executor: EXECUTION_REGISTRY,
        candidateHash: expectedHash,
        approvalId: approval.id,
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: "declarative_evolution_execution_error",
        executor: EXECUTION_REGISTRY,
      });
      return {
        task: failedTask,
        blocked: false,
        actions: [],
        capabilityInvocations: [],
        verification: null,
        policy: policy.decision,
        approval: serialiseApproval(approval),
      };
    }
  }

  return [
    {
      name: "native-declarative-evolution-staging",
      predicate: isNativeDeclarativeEvolutionStagingTask,
      execute: executeNativeDeclarativeEvolutionStagingTask,
    },
  ];
}
