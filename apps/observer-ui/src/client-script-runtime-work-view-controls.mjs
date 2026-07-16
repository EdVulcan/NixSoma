export const observerClientRuntimeWorkViewControlsScript = `function workViewOperationForPath(path) {
  return {
    "/work-view/prepare": "work_view.prepare",
    "/work-view/reveal": "work_view.reveal",
    "/work-view/hide": "work_view.hide",
  }[path] ?? null;
}

async function postWorkView(path, payload = {}, { refresh = true } = {}) {
  const operation = workViewOperationForPath(path);
  if (!operation) {
    throw new Error("Work view control route is not allowlisted.");
  }

  const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.work_view.control",
      operation,
      params: payload,
    }),
  });
  if (response.invoked !== true) {
    throw new Error("Work view control capability was not invoked.");
  }

  const result = response.result ?? {};
  if (currentTaskState?.id) {
    const phase =
      path === "/work-view/prepare"
        ? "preparing_work_view"
        : path === "/work-view/reveal"
          ? "visible"
          : path === "/work-view/hide"
            ? "backgrounded"
            : null;
    if (phase) {
      await updateTaskPhase(currentTaskState.id, phase, {
        visibility: result.workView?.visibility ?? null,
        mode: result.workView?.mode ?? null,
        workViewRecoveryAction: result.workView?.recoveryAction ?? null,
      });
    }
  }
  setControlMessage(\`Work view \${result.workView?.status ?? "updated"} / \${result.workView?.visibility ?? "unknown"}\`);
  if (refresh) {
    await refreshRuntime();
    await refreshTaskList();
    await refreshTaskHistoryDetail();
    await refreshWorkView();
    await refreshScreen();
  }
  return result;
}

async function readLatestWorkViewStateForAction() {
  const data = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/state\`);
  latestWorkViewState = data.workView ?? null;
  return latestWorkViewState;
}

async function runRecommendedWorkViewAction() {
  const workView = await readLatestWorkViewStateForAction();
  const recommendation = workView?.trustedSession?.recoveryRecommendation ?? {};
  const action = recommendation.action ?? "none";

  if (action === "none") {
    setControlMessage("Work view helper is ready; no recovery action recommended.");
    await refreshWorkView();
    await refreshScreen();
    return;
  }

  if (action === "prepare_work_view") {
    await postWorkView("/work-view/prepare", {
      displayTarget: workView?.displayTarget ?? "workspace-2",
      entryUrl: getDesiredWorkViewUrl(),
    });
    return;
  }

  if (action === "reveal_work_view") {
    await postWorkView("/work-view/reveal", {
      entryUrl: workView?.activeUrl ?? workView?.entryUrl ?? getDesiredWorkViewUrl(),
    });
    return;
  }

  if (action === "hide_work_view") {
    await postWorkView("/work-view/hide");
    return;
  }

  setControlMessage(\`Unsupported work view recommendation: \${action}\`);
}
`;
