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
    goal: "Run an approval-gated bounded trusted work-view sidecar heartbeat process",
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
          processStartEnabledAfterApproval: true,
          rootRequired: false,
        },
      },
      {
        id: "approved-start-probe",
        kind: "work_view.trusted_sidecar_start_probe",
        phase: "deferred_user_space_start_probe",
        title: "Start one bounded user-space sidecar heartbeat process after approval",
        status: "blocked",
        capabilityId: draft.plannedCapabilityId,
        risk: "high",
        requiresApproval: true,
        params: {
          executionStatus: "approval_gated",
          processStartEnabledAfterApproval: true,
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
        goal: "Run an approval-gated bounded trusted work-view sidecar heartbeat process",
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
      processStartEnabledAfterApproval: true,
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

function sidecarTaskIdFromActionPath(pathname, action) {
  const prefix = "/work-view/trusted-sidecar/lifecycle-tasks/";
  const suffix = `/${action}`;
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }
  return pathname.slice(prefix.length, -suffix.length);
}

function buildSidecarStartProbeReadback({
  task,
  approval,
  status,
  reason,
  sidecar = null,
  generatedAt = new Date().toISOString(),
}) {
  const running = sidecar?.running === true;
  return {
    status,
    reason,
    generatedAt,
    taskId: task.id,
    approvalId: approval?.id ?? task.approval?.requestId ?? null,
    approvalStatus: approval?.status ?? task.approval?.status ?? "missing",
    execution: {
      processStarted: running,
      processStartEnabled: approval?.status === "approved",
      pid: running ? sidecar.pid ?? null : null,
      supervisorStatus: sidecar?.status ?? "not_started",
      heartbeatAt: sidecar?.heartbeatAt ?? null,
      heartbeatCount: sidecar?.heartbeatCount ?? 0,
      sessionManagerOwned: sidecar?.sessionManagerOwned === true,
      boundedProcess: sidecar?.boundedProcess === true,
      installRequired: false,
      credentialEnvironmentInherited: sidecar?.credentialEnvironmentInherited === true,
      networkAccessRequired: sidecar?.networkAccessRequired === true,
      networkScope: sidecar?.networkScope ?? "none",
      captureObservation: sidecar?.captureObservation ?? null,
      filesystemAccessRequired: sidecar?.filesystemAccessRequired === true,
      rootRequired: false,
      systemDaemonRequired: false,
      desktopWideCapture: false,
      hostMutation: false,
      providerEgress: false,
    },
  };
}

async function recordSidecarStartProbeReadback({
  mode,
  action = "start-probe",
  task,
  readback,
  taskManager,
  serialiseTask,
  publishEvent,
}) {
  const record = {
    mode,
    route: `/work-view/trusted-sidecar/lifecycle-tasks/${task.id}/${action}`,
    ...readback,
  };
  task.workViewTrustedSidecarLifecycle = {
    ...(task.workViewTrustedSidecarLifecycle ?? {}),
    execution: record,
  };
  const updatedTask = taskManager.appendTaskPhase(task, `trusted_sidecar_${action.replaceAll("-", "_")}_${readback.status}`, {
    workViewTrustedSidecarLifecycle: {
      mode,
      readback: record,
    },
  });
  await publishEvent(createEventName("task.phase_changed"), { task: serialiseTask(updatedTask) });
  return { record, task: updatedTask };
}

async function handleSidecarStartProbe({
  res,
  requestUrl,
  state,
  taskManager,
  serialiseTask,
  serialiseApproval,
  publishEvent,
  sessionManagerUrl,
}) {
  const taskId = sidecarTaskIdFromActionPath(requestUrl.pathname, "start-probe");
  if (!taskId) {
    return false;
  }

  const task = taskManager.getTaskById(taskId);
  if (!task || task.type !== "work_view_trusted_sidecar_lifecycle") {
    sendJson(res, 404, { ok: false, error: "Trusted work-view sidecar lifecycle task not found." });
    return true;
  }

  const approval = task.approval?.requestId ? state.approvals.get(task.approval.requestId) : null;
  if (approval?.status !== "approved") {
    const readback = buildSidecarStartProbeReadback({
      task,
      approval,
      status: "blocked_before_approval",
      reason: "approval_required_before_sidecar_start_probe",
    });
    const recorded = await recordSidecarStartProbeReadback({
      mode: "trusted-sidecar-start-probe-blocked",
      task,
      readback,
      taskManager,
      serialiseTask,
      publishEvent,
    });
    sendJson(res, 409, {
      ok: false,
      mode: "trusted-sidecar-start-probe-blocked",
      readback: recorded.record,
      task: serialiseTask(recorded.task),
      approval: approval ? serialiseApproval(approval) : null,
    });
    return true;
  }

  let sidecarResponse;
  try {
    const response = await fetch(`${sessionManagerUrl}/work-view/trusted-sidecar/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        approvalId: approval.id,
        approvalStatus: approval.status,
      }),
    });
    sidecarResponse = await response.json().catch(() => null);
    if (!response.ok || sidecarResponse?.ok !== true || sidecarResponse?.sidecar?.running !== true) {
      throw new Error(sidecarResponse?.error ?? "Trusted sidecar process did not start.");
    }
  } catch (error) {
    const readback = buildSidecarStartProbeReadback({
      task,
      approval,
      status: "start_failed_after_approval",
      reason: errorMessage(error),
      sidecar: sidecarResponse?.sidecar ?? null,
    });
    const recorded = await recordSidecarStartProbeReadback({
      mode: "trusted-sidecar-start-probe-failed-after-approval",
      task,
      readback,
      taskManager,
      serialiseTask,
      publishEvent,
    });
    sendJson(res, 409, {
      ok: false,
      mode: "trusted-sidecar-start-probe-failed-after-approval",
      readback: recorded.record,
      task: serialiseTask(recorded.task),
      approval: serialiseApproval(approval),
    });
    return true;
  }

  const readback = buildSidecarStartProbeReadback({
    task,
    approval,
    status: "running_after_approval",
    reason: "bounded_user_space_sidecar_heartbeat_running",
    sidecar: sidecarResponse.sidecar,
  });
  const recorded = await recordSidecarStartProbeReadback({
    mode: "trusted-sidecar-start-probe-running-after-approval",
    task,
    readback,
    taskManager,
    serialiseTask,
    publishEvent,
  });
  sendJson(res, 200, {
    ok: true,
    mode: "trusted-sidecar-start-probe-running-after-approval",
    readback: recorded.record,
    task: serialiseTask(recorded.task),
    approval: serialiseApproval(approval),
  });
  return true;
}

async function handleSidecarStop({
  res,
  requestUrl,
  state,
  taskManager,
  serialiseTask,
  serialiseApproval,
  publishEvent,
  sessionManagerUrl,
}) {
  const taskId = sidecarTaskIdFromActionPath(requestUrl.pathname, "stop");
  if (!taskId) {
    return false;
  }
  const task = taskManager.getTaskById(taskId);
  if (!task || task.type !== "work_view_trusted_sidecar_lifecycle") {
    sendJson(res, 404, { ok: false, error: "Trusted work-view sidecar lifecycle task not found." });
    return true;
  }
  const approval = task.approval?.requestId ? state.approvals.get(task.approval.requestId) : null;
  if (approval?.status !== "approved") {
    sendJson(res, 409, { ok: false, error: "Approved sidecar lifecycle task is required before stop." });
    return true;
  }
  try {
    const response = await fetch(`${sessionManagerUrl}/work-view/trusted-sidecar/stop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.error ?? "Trusted sidecar process did not stop.");
    }
    const readback = buildSidecarStartProbeReadback({
      task,
      approval,
      status: "stopped_after_operator_action",
      reason: "bounded_user_space_sidecar_stopped",
      sidecar: data.sidecar,
    });
    const recorded = await recordSidecarStartProbeReadback({
      mode: "trusted-sidecar-stopped-after-operator-action",
      action: "stop",
      task,
      readback,
      taskManager,
      serialiseTask,
      publishEvent,
    });
    sendJson(res, 200, {
      ok: true,
      mode: "trusted-sidecar-stopped-after-operator-action",
      readback: recorded.record,
      task: serialiseTask(recorded.task),
      approval: serialiseApproval(approval),
    });
  } catch (error) {
    sendJson(res, 409, { ok: false, error: errorMessage(error), task: serialiseTask(task) });
  }
  return true;
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
  if (req.method === "POST" && await handleSidecarStartProbe({
    res,
    requestUrl,
    state,
    taskManager,
    serialiseTask,
    serialiseApproval,
    publishEvent,
    sessionManagerUrl,
  })) {
    return true;
  }

  if (req.method === "POST" && await handleSidecarStop({
    res,
    requestUrl,
    state,
    taskManager,
    serialiseTask,
    serialiseApproval,
    publishEvent,
    sessionManagerUrl,
  })) {
    return true;
  }

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
