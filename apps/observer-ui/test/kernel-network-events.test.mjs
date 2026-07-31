import test from "node:test";
import assert from "node:assert/strict";

import { observerClientConfigDomKernelNetworkScript } from "../src/client-script-config-dom-kernel-network.mjs";
import { observerClientKernelNetworkRefreshersScript } from "../src/client-script-refreshers-kernel-network.mjs";
import { observerKernelNetworkPanels } from "../src/observer-panels-kernel-network.mjs";

test("Observer exposes bounded kernel network-connect readback", () => {
  const panel = observerKernelNetworkPanels();
  for (const token of [
    "kernel-network-connect-status",
    "kernel-network-connect-available",
    "kernel-network-connect-event-count",
    "kernel-network-connect-unique-comm-count",
    "kernel-network-connect-unique-family-count",
    "kernel-network-connect-unique-pid-count",
    "kernel-network-connect-unique-uid-count",
    "kernel-network-connect-continuity-status",
    "kernel-network-connect-capture-sequence",
    "kernel-network-connect-activity",
    "kernel-network-connect-new-comm-count",
    "kernel-network-connect-readback-json",
  ]) {
    assert.equal(panel.includes(token), true, "panel is missing " + token);
  }

  for (const token of [
    "kernelNetworkConnectStatus",
    "kernelNetworkConnectAvailable",
    "kernelNetworkConnectEventCount",
    "kernelNetworkConnectUniqueCommCount",
    "kernelNetworkConnectUniqueFamilyCount",
    "kernelNetworkConnectUniquePidCount",
    "kernelNetworkConnectUniqueUidCount",
    "kernelNetworkConnectContinuityStatus",
    "kernelNetworkConnectCaptureSequence",
    "kernelNetworkConnectActivity",
    "kernelNetworkConnectNewCommCount",
    "kernelNetworkConnectReadbackJson",
  ]) {
    assert.equal(observerClientConfigDomKernelNetworkScript.includes(token), true);
    assert.equal(observerClientKernelNetworkRefreshersScript.includes(token), true);
  }
  assert.equal(observerClientKernelNetworkRefreshersScript.includes("network-connect-events"), true);
  assert.equal(observerClientKernelNetworkRefreshersScript.includes("destinationCaptured"), false);
});
