export const BROWSER_TASK_ACTION_DESCRIPTORS = Object.freeze([
  { kind: "keyboard.type", endpoint: "/act/keyboard/type", capabilityId: "act.screen.pointer_keyboard" },
  { kind: "keyboard.hotkey", endpoint: "/act/keyboard/hotkey", capabilityId: "act.screen.pointer_keyboard" },
  { kind: "mouse.click", endpoint: "/act/mouse/click", capabilityId: "act.screen.pointer_keyboard" },
  { kind: "browser.new_tab", endpoint: "/act/browser/new-tab", capabilityId: "act.browser.open" },
]);

const descriptorByKind = new Map(BROWSER_TASK_ACTION_DESCRIPTORS.map((descriptor) => [descriptor.kind, descriptor]));

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
