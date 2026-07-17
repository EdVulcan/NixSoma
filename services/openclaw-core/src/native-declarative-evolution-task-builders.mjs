import { randomUUID } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export const NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY = "openclaw-native-declarative-evolution-staging-task-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE = "native_declarative_evolution_staging";

function compactCandidate(candidate) {
  return {
    registry: candidate?.registry ?? null,
    candidateStatus: candidate?.candidateStatus ?? null,
    target: candidate?.target ?? null,
    changes: Array.isArray(candidate?.changes) ? candidate.changes : [],
    candidateHash: candidate?.candidateHash ?? null,
    candidateBytes: candidate?.candidateBytes ?? null,
    validation: candidate?.validation
      ? {
          status: candidate.validation.status ?? null,
          mode: candidate.validation.mode ?? null,
          resultType: candidate.validation.resultType ?? null,
          reason: candidate.validation.reason ?? null,
        }
      : null,
  };
}

export function createNativeDeclarativeEvolutionTaskBuilders(deps) {
  const {
    buildNativeDeclarativeEvolutionCandidate,
    stagingDirectory,
    autonomyMode,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
  } = deps;

  async function buildNativeDeclarativeEvolutionStagingTaskDraft({ changes = [] } = {}) {
    const candidate = await buildNativeDeclarativeEvolutionCandidate({ changes });
    if (candidate?.candidateStatus !== "validated" || typeof candidate.candidateHash !== "string") {
      throw new Error(`Declarative evolution candidate is not ready for staging: ${candidate?.validation?.reason ?? candidate?.candidateStatus ?? "validation_failed"}.`);
    }

    const compact = compactCandidate(candidate);
    const goal = `Stage and read-only evaluate approved OpenClaw managed Nix candidate ${candidate.candidateHash}`;
    const policyRequest = {
      intent: "openclaw.declarative_evolution.stage_candidate",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      approved: false,
      candidateHash: candidate.candidateHash,
      targetPath: candidate.target?.path ?? null,
      tags: [
        "declarative_evolution",
        "managed_nix_candidate",
        "staging_write",
        "read_only_nixos_build",
        "explicit_approval_required",
      ],
    };
    const policyDecision = evaluatePolicyIntent({
      type: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
      goal,
      policy: policyRequest,
    }, {
      stage: "declarative_evolution.staging_task.draft",
      type: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
      goal,
    });
    const approvalBinding = {
      kind: "native_declarative_evolution_candidate",
      candidateHash: candidate.candidateHash,
      targetPath: candidate.target?.path ?? null,
      candidateBytes: candidate.candidateBytes ?? null,
    };
    const now = new Date().toISOString();
    const plan = {
      planId: `plan-${randomUUID()}`,
      strategy: "native-declarative-evolution-staging-v0",
      planner: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY,
      capabilityAware: true,
      status: "planned",
      goal,
      targetUrl: null,
      intent: policyRequest.intent,
      createdAt: now,
      updatedAt: now,
      candidate: compact,
      stagingDirectory,
      approvalBinding,
      capabilitySummary: {
        total: 3,
        approvalGates: 1,
        ids: [
          "plan.openclaw.declarative_evolution.managed_config_candidate",
          "govern.policy.evaluate",
          "act.openclaw.declarative_evolution.staging_task",
        ],
        byRisk: { medium: 1, high: 2 },
      },
      steps: [
        {
          id: "step-review-managed-nix-candidate",
          kind: "openclaw.declarative_evolution.candidate_review",
          phase: "reviewing_managed_nix_candidate",
          title: "Review the validated managed Nix candidate hash and structured changes",
          status: "pending",
          capabilityId: "plan.openclaw.declarative_evolution.managed_config_candidate",
          risk: "medium",
          governance: "audit_only",
          requiresApproval: false,
          params: compact,
        },
        {
          id: "step-approve-managed-nix-candidate",
          kind: "approval.gate",
          phase: "waiting_for_approval",
          title: "Wait for explicit approval bound to this candidate hash",
          status: "pending",
          capabilityId: "govern.policy.evaluate",
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: approvalBinding,
        },
        {
          id: "step-stage-and-build-managed-nix-candidate",
          kind: "openclaw.declarative_evolution.stage_and_build",
          phase: "staging_and_read_only_nixos_build",
          title: "Write this exact candidate to OpenClaw staging and run read-only Nix evaluation/build",
          status: "pending",
          capabilityId: "act.openclaw.declarative_evolution.staging_task",
          risk: "high",
          governance: "require_approval",
          requiresApproval: true,
          params: {
            candidateHash: candidate.candidateHash,
            stagingDirectory,
            writesManagedConfig: false,
            switchesGeneration: false,
            executesRollback: false,
          },
        },
      ],
      governance: {
        mode: "native_declarative_evolution_staging_task_plan",
        runtimeOwner: "openclaw_on_nixos",
        candidateHashBound: true,
        approvalBoundToCandidateHash: true,
        writesOpenClawStaging: true,
        writesManagedConfig: false,
        runsReadOnlyNixEvaluation: true,
        runsReadOnlyNixBuild: true,
        switchesGeneration: false,
        executesRollback: false,
        healthGate: false,
        providerEgress: false,
        networkEgress: false,
        requiresExplicitApproval: true,
      },
    };

    return {
      ok: true,
      registry: `${NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY}-draft`,
      mode: "approval-gated-native-declarative-evolution-staging-task-draft",
      generatedAt: now,
      candidate: compact,
      stagingDirectory,
      approvalBinding,
      plan,
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      governance: {
        ...plan.governance,
        createsTask: false,
        createsApproval: false,
        canExecuteWithoutApproval: false,
      },
    };
  }

  async function createNativeDeclarativeEvolutionStagingTask({ changes = [], confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Declarative evolution staging task creation requires confirm=true.");
    }

    const draft = await buildNativeDeclarativeEvolutionStagingTaskDraft({ changes });
    const task = createTask({
      goal: draft.plan.goal,
      type: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
      workViewStrategy: "native-declarative-evolution-staging",
      plan: draft.plan,
      policy: draft.policy.request,
    }, { skipInitialPolicy: true });
    task.policy = draft.policy;
    task.nativeDeclarativeEvolution = {
      registry: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-staging-task",
      candidate: draft.candidate,
      approvalBinding: draft.approvalBinding,
      stagingDirectory: draft.stagingDirectory,
      execution: null,
      governance: draft.governance,
    };
    const approval = createApprovalRequestForTask(task, draft.policy.decision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent(createEventName("task.created"), {
      task: serialiseTask(task),
      planner: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY,
    });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), {
      task: serialiseTask(task),
      plan: serialisePlanForPublic(task.plan),
    });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      ok: true,
      registry: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_REGISTRY,
      mode: "approval-gated-native-declarative-evolution-staging-task",
      generatedAt: new Date().toISOString(),
      candidate: draft.candidate,
      stagingDirectory: draft.stagingDirectory,
      approvalBinding: draft.approvalBinding,
      task,
      approval,
      governance: {
        ...draft.governance,
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        executed: false,
      },
      autonomyMode,
    };
  }

  return {
    buildNativeDeclarativeEvolutionStagingTaskDraft,
    createNativeDeclarativeEvolutionStagingTask,
  };
}
