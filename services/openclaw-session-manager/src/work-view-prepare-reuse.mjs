export const WORK_VIEW_PREPARE_REUSE_REGISTRY = "openclaw-work-view-prepare-reuse-v0";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rejected(reason) {
  return {
    registry: WORK_VIEW_PREPARE_REUSE_REGISTRY,
    reused: false,
    reason,
  };
}

export function decideWorkViewPrepareReuse({
  session,
  workView,
  helperRuntime,
  browser,
  displayTarget,
  entryUrl,
} = {}) {
  const requestedDisplayTarget = text(displayTarget);
  const requestedEntryUrl = text(entryUrl);
  const sessionId = text(session?.sessionId);

  if (session?.status !== "running" || !sessionId) return rejected("session_not_running");
  if (text(session?.displayTarget) !== requestedDisplayTarget) return rejected("session_display_target_changed");
  if (!["prepared", "ready"].includes(workView?.status)) return rejected("work_view_not_prepared");
  if (text(workView?.displayTarget) !== requestedDisplayTarget) return rejected("display_target_changed");
  if (text(workView?.entryUrl) !== requestedEntryUrl) return rejected("entry_url_changed");
  if (workView?.helperStatus !== "active") return rejected("work_view_helper_not_active");
  if (workView?.browserStatus !== "running") return rejected("work_view_browser_not_running");
  if (text(workView?.browserSessionId) !== sessionId) return rejected("work_view_browser_session_changed");

  const leaseId = text(helperRuntime?.leaseId);
  if (helperRuntime?.status !== "active") return rejected("helper_runtime_not_active");
  if (helperRuntime?.actionAuthority !== "active") return rejected("helper_action_authority_not_active");
  if (text(helperRuntime?.sessionId) !== sessionId) return rejected("helper_session_changed");
  if (text(helperRuntime?.displayTarget) !== requestedDisplayTarget) return rejected("helper_display_target_changed");
  if (!leaseId || helperRuntime?.leaseMatched !== true || text(helperRuntime?.browserLeaseId) !== leaseId) {
    return rejected("helper_lease_not_matched");
  }

  if (browser?.running !== true) return rejected("browser_not_running");
  if (browser?.sessionAuthority !== "openclaw-session-manager") return rejected("browser_authority_changed");
  if (text(browser?.sessionId) !== sessionId) return rejected("browser_session_changed");
  if (!Array.isArray(browser?.tabs) || browser.tabs.length === 0) return rejected("browser_has_no_tabs");

  return {
    registry: WORK_VIEW_PREPARE_REUSE_REGISTRY,
    reused: true,
    reason: "same_authority",
    tabCount: browser.tabs.length,
  };
}
