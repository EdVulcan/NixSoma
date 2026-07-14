export const NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY =
  "openclaw-native-engineering-work-view-bind-v0";

const MAX_OPERATOR_ACTION_SOURCE_CHARS = 120;

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function compactSource(value) {
  return (hasText(value) ? value.trim() : "observer_engineering_context_packet")
    .slice(0, MAX_OPERATOR_ACTION_SOURCE_CHARS);
}

function stateParts(workViewState) {
  const source = asObject(workViewState);
  const workView = asObject(source.workView ?? source);
  const trustedSession = asObject(source.trustedSession ?? workView.trustedSession);
  const session = asObject(source.session);
  const sessionIdentity = asObject(trustedSession.sessionIdentity);
  const helperRuntime = asObject(trustedSession.helperRuntime ?? workView.helperRuntime);
  return { workView, trustedSession, session, sessionIdentity, helperRuntime };
}

function buildReadback({
  task,
  taskId,
  status,
  stateAvailable,
  workView,
  session,
  sessionIdentity,
  helperRuntime,
  trustedSession,
  existingSessionPresent,
  existingWorkViewIdPresent,
  sessionMatched,
  workViewMatched,
  rebindRequested = false,
  operatorActionSource,
  now,
} = {}) {
  const selectedTaskId = task?.id ?? taskId ?? null;
  return {
    registry: NATIVE_ENGINEERING_WORK_VIEW_BIND_REGISTRY,
    mode: "operator_reviewed_trusted_work_view_bind",
    generatedAt: now(),
    identityLevel: "Level 2: trusted session/work-view component",
    task: {
      id: selectedTaskId,
      status: task?.status ?? null,
      selected: Boolean(task),
    },
    workView: {
      id: stateAvailable ? workView.workViewId : null,
      status: stateAvailable ? workView.status ?? null : null,
      visibility: stateAvailable ? workView.visibility ?? null : null,
      mode: stateAvailable ? workView.mode ?? null : null,
      helperStatus: stateAvailable ? helperRuntime.status ?? null : null,
    },
    authority: {
      identityStatus: stateAvailable ? sessionIdentity.status ?? null : null,
      actionAuthority: stateAvailable ? helperRuntime.actionAuthority ?? "inactive" : "inactive",
      leaseMatched: stateAvailable ? helperRuntime.leaseMatched === true : false,
      recoveryAction: stateAvailable
        ? asObject(trustedSession.recoveryRecommendation).action ?? "none"
        : "none",
    },
    summary: {
      status,
      taskId: selectedTaskId,
      bindingStatus: status,
      taskSessionPresent: existingSessionPresent,
      taskWorkViewIdPresent: existingWorkViewIdPresent,
      sessionMatched,
      workViewMatched,
      operation: status === "ready_to_rebind" ? "rebind" : status === "already_bound" ? "noop" : "bind",
      rebindRequested,
      changed: status === "ready_to_bind" || status === "ready_to_rebind",
      operatorActionSource,
    },
    governance: {
      explicitOperatorConfirmation: true,
      revalidatedAuthoritativeState: stateAvailable,
      readSessionManagerOnly: true,
      mutatesTaskState: status === "ready_to_bind" || status === "ready_to_rebind",
      mutatesWorkViewState: false,
      changesTaskStatus: false,
      explicitRebindRequested: rebindRequested,
      replacesExistingBinding: status === "ready_to_rebind",
      dispatchesAction: false,
      createsTask: false,
      createsApproval: false,
      executesAction: false,
      exposesSessionId: false,
      exposesLeaseId: false,
      exposesActiveUrl: false,
      callsProvider: false,
      networkEgress: false,
    },
    deferredExecutionBoundaries: [
      "no automatic action dispatch or task execution",
      "no automatic recovery or rebinding after authority changes",
      "no lease value transfer to the task consumer or provider",
      "no provider call, credential access, or external network egress",
    ],
  };
}

export function buildNativeEngineeringWorkViewBindDecision({
  task = null,
  taskId = null,
  workViewState = null,
  readStatus = "available",
  confirm = false,
  rebind = false,
  operatorActionSource = null,
  now = () => new Date().toISOString(),
} = {}) {
  const selectedTaskId = hasText(taskId) ? taskId.trim() : task?.id ?? null;
  const parts = stateParts(workViewState);
  const taskWorkView = asObject(task?.workView);
  const existingSession = hasText(taskWorkView.sessionId) ? taskWorkView.sessionId.trim() : null;
  const existingWorkViewId = hasText(taskWorkView.workViewId) ? taskWorkView.workViewId.trim() : null;
  const stateAvailable = readStatus === "available"
    && hasText(parts.session.sessionId)
    && hasText(parts.workView.workViewId);
  const sessionMatched = Boolean(existingSession && stateAvailable && existingSession === parts.session.sessionId);
  const workViewMatched = Boolean(existingWorkViewId && stateAvailable && existingWorkViewId === parts.workView.workViewId);
  const authorityReady = stateAvailable
    && parts.session.status === "running"
    && parts.workView.status !== "idle"
    && parts.workView.status !== "stopped"
    && parts.sessionIdentity.status === "authoritative"
    && parts.helperRuntime.actionAuthority === "active"
    && parts.helperRuntime.leaseMatched === true;
  const source = compactSource(operatorActionSource);

  let status = "ready_to_bind";
  if (!task) {
    status = "task_not_found";
  } else if (confirm !== true) {
    status = "operator_confirmation_required";
  } else if (!stateAvailable) {
    status = "work_view_state_unavailable";
  } else if (!authorityReady) {
    status = "authority_not_ready";
  } else if (rebind === true && (existingSession && !sessionMatched || existingWorkViewId && !workViewMatched)) {
    status = "ready_to_rebind";
  } else if (existingSession && !sessionMatched) {
    status = "stale_session_binding";
  } else if (existingWorkViewId && !workViewMatched) {
    status = "stale_work_view_binding";
  } else if (existingSession && existingWorkViewId && sessionMatched && workViewMatched) {
    status = "already_bound";
  }

  const readback = buildReadback({
    task,
    taskId: selectedTaskId,
    status,
    stateAvailable,
    workView: parts.workView,
    session: parts.session,
    sessionIdentity: parts.sessionIdentity,
    helperRuntime: parts.helperRuntime,
    trustedSession: parts.trustedSession,
    existingSessionPresent: Boolean(existingSession),
    existingWorkViewIdPresent: Boolean(existingWorkViewId),
    sessionMatched,
    workViewMatched,
    rebindRequested: rebind === true,
    operatorActionSource: source,
    now,
  });

  return {
    ok: status === "ready_to_bind" || status === "ready_to_rebind" || status === "already_bound",
    shouldMutate: status === "ready_to_bind" || status === "ready_to_rebind",
    status,
    readback,
    internalBinding: status === "ready_to_bind" || status === "ready_to_rebind"
      ? {
          workViewId: parts.workView.workViewId.trim(),
          sessionId: parts.session.sessionId.trim(),
          status: parts.workView.status ?? "ready",
          visibility: parts.workView.visibility ?? "hidden",
          mode: parts.workView.mode ?? "background",
          helperStatus: parts.helperRuntime.status ?? parts.workView.helperStatus ?? "active",
          displayTarget: parts.workView.displayTarget ?? null,
          operatorActionSource: source,
        }
      : null,
  };
}

export function buildNativeEngineeringWorkViewBindCompletion(readback, now = () => new Date().toISOString()) {
  const source = asObject(readback);
  const summary = asObject(source.summary);
  return {
    ...source,
    generatedAt: now(),
    summary: {
      ...summary,
      status: "bound",
      bindingStatus: "bound",
      changed: true,
    },
    governance: {
      ...asObject(source.governance),
      mutatesTaskState: true,
      changesTaskStatus: false,
    },
  };
}
