import assert from "node:assert/strict";
import test from "node:test";

import { decideWorkViewPrepareReuse } from "../src/work-view-prepare-reuse.mjs";

function validCandidate() {
  return {
    session: {
      status: "running",
      sessionId: "session-1",
      displayTarget: "workspace-2",
    },
    workView: {
      status: "ready",
      visibility: "visible",
      helperStatus: "active",
      browserStatus: "running",
      browserSessionId: "session-1",
      displayTarget: "workspace-2",
      entryUrl: "https://example.com/work-view",
      activeUrl: "https://example.com/operator-navigation",
    },
    helperRuntime: {
      status: "active",
      actionAuthority: "active",
      sessionId: "session-1",
      displayTarget: "workspace-2",
      leaseId: "lease-1",
      browserLeaseId: "lease-1",
      leaseMatched: true,
    },
    browser: {
      running: true,
      sessionAuthority: "openclaw-session-manager",
      sessionId: "session-1",
      activeUrl: "https://example.com/operator-navigation",
      tabs: [{ id: "tab-1", url: "https://example.com/operator-navigation" }],
    },
    displayTarget: "workspace-2",
    entryUrl: "https://example.com/work-view",
  };
}

test("same-authority prepare reuses a valid browser even after operator navigation", () => {
  const result = decideWorkViewPrepareReuse(validCandidate());

  assert.deepEqual(result, {
    registry: "openclaw-work-view-prepare-reuse-v0",
    reused: true,
    reason: "same_authority",
    tabCount: 1,
  });
});

test("prepare reuse rejects stale or changed authority evidence", async (t) => {
  const cases = [
    ["session_not_running", (value) => { value.session.status = "stopped"; }],
    ["session_display_target_changed", (value) => {
      value.displayTarget = "workspace-3";
      value.workView.displayTarget = "workspace-3";
      value.helperRuntime.displayTarget = "workspace-3";
    }],
    ["work_view_not_prepared", (value) => { value.workView.status = "degraded"; }],
    ["display_target_changed", (value) => { value.workView.displayTarget = "workspace-3"; }],
    ["entry_url_changed", (value) => { value.entryUrl = "https://example.com/other"; }],
    ["work_view_helper_not_active", (value) => { value.workView.helperStatus = "degraded"; }],
    ["work_view_browser_not_running", (value) => { value.workView.browserStatus = "stopped"; }],
    ["work_view_browser_session_changed", (value) => { value.workView.browserSessionId = "session-2"; }],
    ["helper_runtime_not_active", (value) => { value.helperRuntime.status = "suspended"; }],
    ["helper_action_authority_not_active", (value) => { value.helperRuntime.actionAuthority = "suspended"; }],
    ["helper_session_changed", (value) => { value.helperRuntime.sessionId = "session-2"; }],
    ["helper_display_target_changed", (value) => { value.helperRuntime.displayTarget = "workspace-3"; }],
    ["helper_lease_not_matched", (value) => { value.helperRuntime.browserLeaseId = "lease-2"; }],
    ["browser_not_running", (value) => { value.browser.running = false; }],
    ["browser_authority_changed", (value) => { value.browser.sessionAuthority = "browser-runtime-local"; }],
    ["browser_session_changed", (value) => { value.browser.sessionId = "session-2"; }],
    ["browser_has_no_tabs", (value) => { value.browser.tabs = []; }],
  ];

  for (const [reason, mutate] of cases) {
    await t.test(reason, () => {
      const candidate = validCandidate();
      mutate(candidate);
      const result = decideWorkViewPrepareReuse(candidate);
      assert.equal(result.reused, false);
      assert.equal(result.reason, reason);
    });
  }
});
