import test from "node:test";
import assert from "node:assert/strict";

import { observerClientConfigDomKernelEventsScript } from "../src/client-script-config-dom-kernel-events.mjs";
import { observerClientKernelEventRefreshersScript } from "../src/client-script-refreshers-kernel-events.mjs";
import { observerKernelEventPanels } from "../src/observer-panels-kernel-events.mjs";

test("Observer exposes bounded process-exec readback metrics", () => {
  const panel = observerKernelEventPanels();
  for (const token of [
    "kernel-process-exec-unique-comm-count",
    "kernel-process-exec-unique-pid-count",
    "kernel-process-exec-unique-uid-count",
    "kernel-process-exec-executable-identity-count",
    "kernel-process-exec-continuity-status",
    "kernel-process-exec-capture-sequence",
    "kernel-process-exec-activity",
    "kernel-process-exec-new-comm-count",
    "kernel-process-exec-readback-json",
  ]) {
    assert.equal(panel.includes(token), true, "panel is missing " + token);
  }

  for (const token of [
    "kernelProcessExecUniqueCommCount",
    "kernelProcessExecUniquePidCount",
    "kernelProcessExecUniqueUidCount",
    "kernelProcessExecExecutableIdentityCount",
    "kernelProcessExecContinuityStatus",
    "kernelProcessExecCaptureSequence",
    "kernelProcessExecActivity",
    "kernelProcessExecNewCommCount",
    "kernelProcessExecReadbackJson",
  ]) {
    assert.equal(
      observerClientConfigDomKernelEventsScript.includes(token),
      true,
      "DOM config is missing " + token,
    );
    assert.equal(
      observerClientKernelEventRefreshersScript.includes(token),
      true,
      "refresher is missing " + token,
    );
  }
  assert.equal(observerClientKernelEventRefreshersScript.includes("data.readback"), true);
});
