export const observerClientRuntimeSemanticTargetTaskScript = `let latestSemanticTargetSelection = null;

function semanticTargetTaskUrl(screen) {
  const candidate = screen?.workView?.activeUrl
    ?? screen?.captureMetadata?.activeUrl
    ?? screen?.workViewSummary?.url
    ?? null;
  if (typeof candidate !== "string" || !candidate.trim()) {
    return null;
  }
  try {
    const url = new URL(candidate.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function renderSemanticTargetSelection(screen) {
  if (!screenSemanticTargetSelect) {
    return;
  }

  const previousValue = screenSemanticTargetSelect.value;
  const inventory = screen?.semanticTargets ?? null;
  const targets = inventory?.available === true && Array.isArray(inventory.items)
    ? inventory.items.filter((target) => target?.visible === true
      && target.disabled !== true
      && typeof target.name === "string"
      && target.name.trim())
    : [];
  const targetUrl = semanticTargetTaskUrl(screen);
  latestSemanticTargetSelection = targets.length > 0 && targetUrl
    ? { targetUrl, targets }
    : null;

  screenSemanticTargetSelect.replaceChildren();
  if (!latestSemanticTargetSelection) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = targetUrl ? "No enabled named target" : "Open an HTTP(S) work view first";
    screenSemanticTargetSelect.append(option);
    screenSemanticTargetSelect.value = "";
    screenSemanticTargetSelect.disabled = true;
    if (createSemanticClickTaskButton) {
      createSemanticClickTaskButton.disabled = true;
    }
    if (screenSemanticTargetTaskJson) {
      screenSemanticTargetTaskJson.textContent = "No current semantic target is eligible for task planning.";
    }
    return;
  }

  for (const target of targets) {
    const option = document.createElement("option");
    option.value = target.targetId;
    option.textContent = (target.role ? target.role + ": " : "") + target.name;
    screenSemanticTargetSelect.append(option);
  }
  screenSemanticTargetSelect.disabled = false;
  screenSemanticTargetSelect.value = targets.some((target) => target.targetId === previousValue)
    ? previousValue
    : targets[0].targetId;
  if (createSemanticClickTaskButton) {
    createSemanticClickTaskButton.disabled = false;
  }
  const selected = targets.find((target) => target.targetId === screenSemanticTargetSelect.value) ?? targets[0];
  if (screenSemanticTargetTaskJson) {
    screenSemanticTargetTaskJson.textContent = [
      "Selected semantic click intent",
      "Role: " + (selected.role ?? "none"),
      "Name: " + selected.name,
      "Task execution: explicit operator step required",
      "Frame and inventory: revalidated by the existing Core and trusted sidecar handoff",
    ].join("\\n");
  }
}

async function createOperatorReviewedSemanticClickTask(engineeringRecommendationLink = null) {
  const selection = latestSemanticTargetSelection;
  const targetId = screenSemanticTargetSelect?.value ?? "";
  const target = selection?.targets?.find((candidate) => candidate.targetId === targetId) ?? null;
  if (!selection || !target) {
    throw new Error("Select a current semantic target first.");
  }

  if (createSemanticClickTaskButton) {
    createSemanticClickTaskButton.disabled = true;
  }
  try {
    const targetIntent = {
      name: target.name,
      ...(target.role ? { role: target.role } : {}),
    };
    const response = await fetchJson(\`\${observerConfig.coreUrl}/tasks/plan\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "Create an operator-reviewed semantic click task for the selected AI work-view target",
        type: "browser_task",
        targetUrl: selection.targetUrl,
        workViewStrategy: "ai-work-view",
        planStrategy: "rule-v1",
        intent: "browser.semantic_click",
        actions: [{ kind: "browser.semantic_click", params: { target: targetIntent } }],
        ...(engineeringRecommendationLink ? { engineeringRecommendationLink } : {}),
      }),
    });
    if (response.ok !== true || !response.task?.id) {
      throw new Error(response.error ?? "Semantic click task was not created.");
    }

    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = response.task.id;
    taskDetailIdInput.value = response.task.id;
    renderPlanPanel(response.task ?? { plan: response.plan });
    screenSemanticTargetTaskJson.textContent = JSON.stringify({
      mode: "operator_reviewed_semantic_click_task",
      taskId: response.task.id,
      status: response.task.status ?? "queued",
      targetIntent,
      executionStarted: false,
      operatorActionRequired: "operator_step_or_run",
      targetReferenceMaterialisedAtDispatch: true,
      guidanceSourceTaskId: response.task?.engineeringRecommendationLink?.source?.taskId ?? null,
      guidanceActionId: response.task?.engineeringRecommendationLink?.action?.actionId ?? null,
      selectorsExposed: false,
      arbitraryPageScript: false,
    }, null, 2);
    setControlMessage("Created reviewed semantic click task " + response.task.id + "; execution remains explicit.");
    await refreshRuntime();
    await refreshTaskList();
    await refreshTaskHistoryDetail();
    await refreshOperatorState();
  } finally {
    if (createSemanticClickTaskButton) {
      createSemanticClickTaskButton.disabled = false;
    }
  }
}

createSemanticClickTaskButton?.addEventListener("click", () => {
  void createOperatorReviewedSemanticClickTask().catch((error) => {
    setControlMessage("Semantic click task was not created: " + formatError(error));
    if (createSemanticClickTaskButton) {
      createSemanticClickTaskButton.disabled = false;
    }
  });
});
`;
