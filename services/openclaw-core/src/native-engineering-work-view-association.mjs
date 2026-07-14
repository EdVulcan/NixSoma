export const NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_REGISTRY =
  "openclaw-native-engineering-work-view-association-v0";

export async function readNativeEngineeringWorkViewState({
  sessionManagerUrl,
  fetchImpl = fetch,
} = {}) {
  if (typeof sessionManagerUrl !== "string" || !sessionManagerUrl.trim()) {
    return { ok: false, data: null };
  }
  try {
    const response = await fetchImpl(`${sessionManagerUrl}/work-view/state`);
    const data = await response.json().catch(() => null);
    return response.ok && data?.ok === true
      ? { ok: true, data }
      : { ok: false, data: null };
  } catch {
    return { ok: false, data: null };
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function buildBinding({ task, requestedTaskId, session, workView, trustedSession, helperRuntime }) {
  if (requestedTaskId && !task) {
    return {
      status: "task_not_found",
      taskHasWorkView: false,
      taskSessionPresent: false,
      sessionMatched: false,
      workViewMatched: false,
    };
  }
  if (!task) {
    return {
      status: "no_task_selected",
      taskHasWorkView: false,
      taskSessionPresent: false,
      sessionMatched: false,
      workViewMatched: false,
    };
  }

  const taskWorkView = asObject(task.workView);
  const taskSessionPresent = hasText(taskWorkView.sessionId);
  const taskWorkViewIdPresent = hasText(taskWorkView.workViewId);
  const sessionMatched = taskSessionPresent
    && hasText(session.sessionId)
    && taskWorkView.sessionId === session.sessionId;
  const workViewMatched = taskWorkViewIdPresent
    && hasText(workView.workViewId)
    && taskWorkView.workViewId === workView.workViewId;
  const authorityReady = trustedSession.sessionIdentity?.status === "authoritative"
    && helperRuntime.actionAuthority === "active"
    && helperRuntime.leaseMatched === true;

  let status = "task_unbound";
  if (!taskSessionPresent) {
    status = "task_unbound";
  } else if (!hasText(session.sessionId)) {
    status = "current_session_unavailable";
  } else if (!sessionMatched) {
    status = "stale_session_binding";
  } else if (taskWorkViewIdPresent && !workViewMatched) {
    status = "stale_work_view_binding";
  } else if (!authorityReady) {
    status = "authority_not_ready";
  } else if (!taskWorkViewIdPresent) {
    status = "session_bound_work_view_unverified";
  } else {
    status = "bound";
  }

  return {
    status,
    taskHasWorkView: true,
    taskSessionPresent,
    taskWorkViewIdPresent,
    sessionMatched,
    workViewMatched: taskWorkViewIdPresent ? workViewMatched : null,
  };
}

export function buildNativeEngineeringWorkViewAssociation({
  task = null,
  taskId = null,
  workViewState = null,
  readStatus = "available",
  now = () => new Date().toISOString(),
} = {}) {
  const source = asObject(workViewState);
  const workView = asObject(source.workView ?? source);
  const trustedSession = asObject(source.trustedSession ?? workView.trustedSession);
  const session = asObject(source.session);
  const helperRuntime = asObject(trustedSession.helperRuntime ?? workView.helperRuntime);
  const sessionIdentity = asObject(trustedSession.sessionIdentity);
  const requestedTaskId = hasText(taskId) ? taskId.trim() : null;
  const selectedTaskId = task?.id ?? requestedTaskId;
  const stateAvailable = readStatus === "available" && hasText(workView.workViewId);
  const binding = stateAvailable
    ? buildBinding({ task, requestedTaskId, session, workView, trustedSession, helperRuntime })
    : {
        status: "work_view_state_unavailable",
        taskHasWorkView: Boolean(task?.workView),
        taskSessionPresent: hasText(task?.workView?.sessionId),
        sessionMatched: false,
        workViewMatched: false,
      };
  const recoveryAction = hasText(trustedSession.recoveryRecommendation?.action)
    ? trustedSession.recoveryRecommendation.action
    : "none";
  const status = stateAvailable
    ? binding.status === "no_task_selected" ? "work_view_observed" : binding.status
    : "work_view_state_unavailable";
  const summary = {
    status,
    taskId: selectedTaskId ?? null,
    taskStatus: task?.status ?? null,
    workViewId: stateAvailable ? workView.workViewId : null,
    sessionStatus: stateAvailable ? session.status ?? null : null,
    sessionIdentityStatus: stateAvailable ? sessionIdentity.status ?? null : null,
    helperStatus: stateAvailable ? helperRuntime.status ?? null : null,
    actionAuthority: stateAvailable ? helperRuntime.actionAuthority ?? "inactive" : "inactive",
    leaseMatched: stateAvailable ? helperRuntime.leaseMatched === true : false,
    bindingStatus: binding.status,
    recoveryAction,
  };

  return {
    ok: stateAvailable,
    registry: NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_REGISTRY,
    mode: "compact_trusted_work_view_task_association",
    generatedAt: now(),
    identityLevel: "Level 2: trusted session/work-view component",
    source: {
      owner: "openclaw-session-manager",
      stateRoute: "/work-view/state",
      localOnly: true,
    },
    task: {
      id: selectedTaskId ?? null,
      type: task?.type ?? null,
      status: task?.status ?? null,
      workViewStrategy: task?.workViewStrategy ?? null,
      selected: Boolean(task),
    },
    workView: {
      id: stateAvailable ? workView.workViewId : null,
      status: stateAvailable ? workView.status ?? null : null,
      visibility: stateAvailable ? workView.visibility ?? null : null,
      mode: stateAvailable ? workView.mode ?? null : null,
      captureStrategy: stateAvailable ? workView.captureStrategy ?? null : null,
      helperStatus: stateAvailable ? workView.helperStatus ?? null : null,
      browserStatus: stateAvailable ? workView.browserStatus ?? null : null,
    },
    session: {
      status: stateAvailable ? session.status ?? null : null,
      idPresent: stateAvailable ? hasText(session.sessionId) : false,
      role: stateAvailable ? session.role ?? null : null,
      displayTarget: stateAvailable ? session.displayTarget ?? null : null,
    },
    authority: {
      identityStatus: stateAvailable ? sessionIdentity.status ?? null : null,
      authority: stateAvailable ? sessionIdentity.authority ?? null : null,
      sessionManagerBacked: stateAvailable ? sessionIdentity.sessionManagerBacked === true : false,
      browserRuntimeBacked: stateAvailable ? sessionIdentity.browserRuntimeBacked === true : false,
      helperStatus: stateAvailable ? helperRuntime.status ?? null : null,
      actionAuthority: stateAvailable ? helperRuntime.actionAuthority ?? "inactive" : "inactive",
      leaseMatched: stateAvailable ? helperRuntime.leaseMatched === true : false,
      scope: stateAvailable ? helperRuntime.scope ?? "ai_owned_work_view_only" : "ai_owned_work_view_only",
      recoveryAction,
    },
    binding,
    summary,
    governance: {
      readOnly: true,
      localSessionReadOnly: true,
      mutatesTaskState: false,
      mutatesWorkViewState: false,
      exposesSessionId: false,
      exposesLeaseId: false,
      exposesActiveUrl: false,
      exposesCapturePayload: false,
      createsTask: false,
      createsApproval: false,
      executesAction: false,
      callsProvider: false,
      networkEgress: false,
    },
  };
}
