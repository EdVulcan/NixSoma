export const BROWSER_TASK_ACTION_DESCRIPTORS = Object.freeze([
  { kind: "keyboard.type", endpoint: "/act/keyboard/type", capabilityId: "act.screen.pointer_keyboard" },
  { kind: "keyboard.hotkey", endpoint: "/act/keyboard/hotkey", capabilityId: "act.screen.pointer_keyboard" },
  { kind: "mouse.click", endpoint: "/act/mouse/click", capabilityId: "act.screen.pointer_keyboard" },
  { kind: "browser.new_tab", endpoint: "/act/browser/new-tab", capabilityId: "act.browser.open" },
]);

const descriptorByKind = new Map(BROWSER_TASK_ACTION_DESCRIPTORS.map((descriptor) => [descriptor.kind, descriptor]));

function normaliseBrowserTaskActions(actions) {
  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      params: action.params && typeof action.params === "object" ? action.params : {},
    }));
}

export function browserTaskActionsForExecution(task, explicitActions) {
  if (Array.isArray(explicitActions) && explicitActions.length > 0) {
    return normaliseBrowserTaskActions(explicitActions);
  }

  if (task?.type === "browser_task" && task?.plan?.strategy === "rule-v1") {
    const plannedActions = (task.plan.steps ?? [])
      .filter((step) => step.phase === "acting_on_target" && step.status !== "completed");
    return normaliseBrowserTaskActions(plannedActions);
  }

  return [
    { kind: "keyboard.type", params: { text: "hello from openclaw-task-executor" } },
    { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
  ];
}

export function screenActEndpointForBrowserTaskAction(kind) {
  return descriptorByKind.get(kind)?.endpoint ?? "/act/mouse/click";
}

export function capabilityIdForBrowserTaskAction(kind) {
  return descriptorByKind.get(kind)?.capabilityId ?? null;
}

export function observedBrowserTaskUrl({ workViewSummary, workView, snapshotText } = {}) {
  return workViewSummary?.url
    ?? workView?.activeUrl
    ?? snapshotText?.match(/^URL: (.+)$/m)?.[1]
    ?? null;
}

function compactVisualFrameReference(frame) {
  if (!frame
    || typeof frame.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(frame.sha256)
    || !Number.isInteger(frame.sequence)
    || frame.sequence < 1) {
    return null;
  }
  return {
    registry: frame.registry === "openclaw-browser-visual-frame-v0" ? frame.registry : null,
    sha256: frame.sha256,
    sequence: frame.sequence,
    pageUrl: typeof frame.pageUrl === "string" ? frame.pageUrl.slice(0, 2048) : null,
    capturedAt: typeof frame.capturedAt === "string" ? frame.capturedAt : null,
    fresh: frame.fresh === true,
    width: frame.width === 960 ? 960 : null,
    height: frame.height === 540 ? 540 : null,
    byteLength: Number.isInteger(frame.byteLength) ? frame.byteLength : null,
    sourceScope: frame.sourceScope === "ai_owned_active_page_only" ? frame.sourceScope : null,
    dataExposed: false,
    persisted: false,
  };
}

export function compactBrowserTaskVisualGrounding(grounding) {
  if (grounding?.registry !== "openclaw-trusted-work-view-visual-action-grounding-v0") return null;
  return {
    registry: grounding.registry,
    required: grounding.required === true,
    status: typeof grounding.status === "string" ? grounding.status.slice(0, 80) : "unknown",
    before: compactVisualFrameReference(grounding.before),
    after: compactVisualFrameReference(grounding.after),
    sequenceAdvanced: grounding.sequenceAdvanced === true,
    imageDataRetained: false,
    desktopWideCapture: false,
    persisted: false,
  };
}

const CAPTURE_INTERRUPTION_REASONS = new Set([
  "trusted_sidecar_capture_source_unavailable",
  "trusted_sidecar_capture_stale",
  "trusted_sidecar_capture_not_ready",
]);

export async function executeBrowserTaskActionWithCaptureRecovery({
  action,
  postAction,
  prepareWorkView,
  recoveryEnabled = true,
} = {}) {
  const endpoint = screenActEndpointForBrowserTaskAction(action?.kind);
  const first = await postAction(endpoint, action?.params ?? {});
  const reason = first?.action?.mediation?.reason ?? null;
  if (!recoveryEnabled || !CAPTURE_INTERRUPTION_REASONS.has(reason)) {
    return first;
  }

  const prepared = await prepareWorkView();
  const retried = await postAction(endpoint, action?.params ?? {});
  return {
    ...retried,
    action: retried?.action ? {
      ...retried.action,
      recovery: {
        attempted: true,
        boundedAttempts: 1,
        reason,
        action: "prepare_work_view",
        prepareOk: prepared?.ok === true,
        firstResult: first?.action?.result ?? null,
        retryResult: retried.action.result ?? null,
      },
    } : retried?.action,
  };
}
