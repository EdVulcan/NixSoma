import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";

const WORK_VIEW_SIDECAR_LIFECYCLE_TASK_REGISTRY = "openclaw-work-view-trusted-sidecar-lifecycle-task-v0";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function compactTrustedSession(trustedSession) {
  return {
    identityLevel: trustedSession?.identityLevel ?? null,
    readiness: trustedSession?.readiness ?? null,
    helperReadiness: trustedSession?.helperReadiness?.state ?? null,
    recoveryRecommendation: trustedSession?.recoveryRecommendation?.action ?? null,
    sidecarContract: {
      status: trustedSession?.sidecarContract?.status ?? null,
      lifecycleProposal: trustedSession?.sidecarContract?.lifecycleProposal?.status ?? null,
      approvalTaskDraft: trustedSession?.sidecarContract?.approvalTaskDraft?.status ?? null,
      processStartEnabled: Boolean(trustedSession?.sidecarContract?.approvalTaskDraft?.processStartEnabled),
      rootRequired: Boolean(trustedSession?.sidecarContract?.approvalTaskDraft?.rootRequired),
    },
  };
}

function buildSidecarLifecyclePlan({ trustedSession, now }) {
  const draft = trustedSession.sidecarContract.approvalTaskDraft;
  return {
    planId: `plan-${randomUUID()}`,
    strategy: "work-view-trusted-sidecar-lifecycle-v0",
    planner: WORK_VIEW_SIDECAR_LIFECYCLE_TASK_REGISTRY,
    capabilityAware: true,
    status: "planned",
    goal: "Review approval-gated trusted work-view sidecar lifecycle without starting a process",
    targetUrl: null,
    intent: "openclaw.work_view.trusted_sidecar.lifecycle",
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 1,
      ids: [
        "sense.openclaw.work_view.trusted_session",
        "plan.openclaw.work_view.trusted_sidecar_lifecycle",
        draft.plannedCapabilityId,
      ],
      byRisk: {
        low: 1,
        medium: 1,
        high: 1,
      },
    },
    steps: [
      {
        id: "review-sidecar-contract",
        kind: "work_view.trusted_sidecar_contract_review",
        phase: "review_sidecar_contract",
        title: "Review the trusted sidecar contract and lifecycle proposal",
        status: "pending",
        capabilityId: "plan.openclaw.work_view.trusted_sidecar_lifecycle",
        risk: "medium",
        requiresApproval: false,
        params: compactTrustedSession(trustedSession),
      },
      {
        id: "operator-approval",
        kind: "approval.wait",
        phase: "wait_for_operator_approval",
        title: "Wait for operator approval before any sidecar lifecycle probe",
        status: "blocked",
        capabilityId: draft.plannedCapabilityId,
        risk: "high",
        requiresApproval: true,
        params: {
          approvalGate: "required_before_process_start",
          processStartEnabled: false,
          rootRequired: false,
        },
      },
      {
        id: "deferred-start-probe",
        kind: "work_view.trusted_sidecar_start_probe",
        phase: "deferred_user_space_start_probe",
        title: "Keep sidecar process start deferred after approval until a later slice enables it",
        status: "blocked",
        capabilityId: draft.plannedCapabilityId,
        risk: "high",
        requiresApproval: true,
        params: {
          executionStatus: "deferred",
          processStartEnabled: false,
          installRequired: false,
          rootRequired: false,
          desktopWideCapture: false,
        },
      },
    ],
  };
}

function buildPolicy({ now }) {
  const policyRequest = {
    intent: "openclaw.work_view.trusted_sidecar.lifecycle",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    approved: false,
    capabilityId: "act.openclaw.work_view.trusted_sidecar_lifecycle",
    tags: ["work_view", "trusted_session", "sidecar_lifecycle", "explicit_approval_required"],
  };
  return {
    request: policyRequest,
    decision: {
      id: randomUUID(),
      at: now,
      engine: WORK_VIEW_SIDECAR_LIFECYCLE_TASK_REGISTRY,
      stage: "work_view.trusted_sidecar.lifecycle.task.materialize",
      subject: {
        taskId: null,
        type: "work_view_trusted_sidecar_lifecycle",
        goal: "Review approval-gated trusted work-view sidecar lifecycle without starting a process",
        targetUrl: null,
        intent: policyRequest.intent,
      },
      domain: policyRequest.domain,
      risk: policyRequest.risk,
      decision: "require_approval",
      reason: "trusted_work_view_sidecar_lifecycle_requires_explicit_operator_approval",
      approved: false,
      autonomyMode: null,
      autonomous: false,
    },
  };
}

async function readTrustedSession(sessionManagerUrl) {
  const response = await fetch(`${sessionManagerUrl}/work-view/state`);
  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error ?? "Unable to read work-view trusted session state.");
  }
  const trustedSession = data.workView?.trustedSession ?? data.trustedSession;
  if (trustedSession?.sidecarContract?.approvalTaskDraft?.status !== "draft_ready") {
    throw new Error("Trusted work-view sidecar approval task draft is not ready.");
  }
  return trustedSession;
}

async function createTrustedSidecarLifecycleTask({
  confirm,
  sessionManagerUrl,
  state,
  taskManager,
  approvalEngine,
  publishEvent,
  serialisePlanForPublic,
}) {
  if (confirm !== true) {
    throw new Error("Trusted work-view sidecar lifecycle task creation requires confirm=true.");
  }

  const trustedSession = await readTrustedSession(sessionManagerUrl);
  const now = new Date().toISOString();
  const plan = buildSidecarLifecyclePlan({ trustedSession, now });
  const policy = buildPolicy({ now });
  policy.decision.autonomyMode = state.autonomyMode;

  const task = taskManager.createTask({
    goal: plan.goal,
    type: "work_view_trusted_sidecar_lifecycle",
    workViewStrategy: "work-view-trusted-sidecar-lifecycle",
    plan,
    policy: policy.request,
  }, { skipInitialPolicy: true });
  task.policy = policy;
  task.workViewTrustedSidecarLifecycle = {
    registry: WORK_VIEW_SIDECAR_LIFECYCLE_TASK_REGISTRY,
    mode: "approval-gated-work-view-trusted-sidecar-lifecycle-task",
    trustedSession: compactTrustedSession(trustedSession),
    execution: null,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      processStartEnabled: false,
      rootRequired: false,
      systemDaemonRequired: false,
      desktopWideCapture: false,
      hostMutation: false,
      providerEgress: false,
    },
  };

  const approval = approvalEngine.createApprovalRequestForTask(task, policy.decision);
  const reclaimedTasks = taskManager.supersedeOtherActiveTasks(task.id);
  taskManager.reconcileRuntimeState();
  state.persistState();

  await publishEvent(createEventName("task.created"), { task: taskManager.serialiseTask(task), planner: WORK_VIEW_SIDECAR_LIFECYCLE_TASK_REGISTRY });
  await approvalEngine.publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: taskManager.serialiseTask(task), plan: serialisePlanForPublic(plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: taskManager.serialiseTask(reclaimedTask),
  })));

  return { task, approval, trustedSession };
}

export async function handleWorkViewSidecarTaskRoute({
  req,
  res,
  requestUrl,
  sessionManagerUrl,
  state,
  taskManager,
  approvalEngine,
  publishEvent,
  serialiseTask,
  serialiseApproval,
  serialisePlanForPublic,
  buildTaskSummary,
}) {
  if (req.method !== "POST" || requestUrl.pathname !== "/work-view/trusted-sidecar/lifecycle-tasks") {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const result = await createTrustedSidecarLifecycleTask({
      confirm: body.confirm === true,
      sessionManagerUrl,
      state,
      taskManager,
      approvalEngine,
      publishEvent,
      serialisePlanForPublic,
    });
    sendJson(res, 201, {
      ok: true,
      registry: WORK_VIEW_SIDECAR_LIFECYCLE_TASK_REGISTRY,
      mode: "approval-gated-work-view-trusted-sidecar-lifecycle-task",
      generatedAt: new Date().toISOString(),
      trustedSession: compactTrustedSession(result.trustedSession),
      task: serialiseTask(result.task),
      approval: serialiseApproval(result.approval),
      governance: result.task.workViewTrustedSidecarLifecycle.governance,
      summary: buildTaskSummary(),
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: errorMessage(error) });
  }
  return true;
}

