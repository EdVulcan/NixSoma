import test from "node:test";
import assert from "node:assert/strict";

import { createTrustedWorkViewHelperRuntime } from "../src/trusted-work-view-helper-runtime.mjs";

test("trusted work-view helper runtime binds a browser observation to one session lease", () => {
  let tick = 0;
  const runtime = createTrustedWorkViewHelperRuntime({
    createId: () => "lease-1",
    now: () => `2026-07-10T10:00:0${tick++}.000Z`,
  });

  const started = runtime.start({
    sessionId: "session-1",
    workViewId: "work-view-primary",
    displayTarget: "workspace-2",
  });
  assert.equal(started.status, "awaiting_browser");
  assert.equal(started.externalProcessStarted, false);

  const lease = runtime.leaseEnvelope();
  const active = runtime.observeBrowserLease({
    sessionId: "session-1",
    trustedHelperLease: lease,
  });
  assert.equal(active.status, "active");
  assert.equal(active.leaseMatched, true);
  assert.equal(active.browserLeaseId, "lease-1");

  const heartbeat = runtime.heartbeat({
    sessionId: "session-1",
    visibility: "hidden",
    action: "hide_work_view",
  });
  assert.equal(heartbeat.status, "active");
  assert.equal(heartbeat.heartbeatCount, 2);
  assert.equal(heartbeat.rootRequired, false);
  assert.equal(heartbeat.desktopWideCapture, false);
  assert.equal(heartbeat.providerEgress, false);
});

test("trusted work-view helper runtime exposes divergent browser lease without repairing it", () => {
  const runtime = createTrustedWorkViewHelperRuntime({
    createId: () => "lease-authoritative",
    now: () => "2026-07-10T10:00:00.000Z",
  });
  runtime.start({
    sessionId: "session-1",
    workViewId: "work-view-primary",
    displayTarget: "workspace-2",
  });

  const divergent = runtime.observeBrowserLease({
    sessionId: "session-1",
    trustedHelperLease: {
      ...runtime.leaseEnvelope(),
      leaseId: "lease-other",
    },
  });
  assert.equal(divergent.status, "divergent");
  assert.equal(divergent.leaseMatched, false);
  assert.equal(divergent.externalProcessStarted, false);
});
