import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerSystemPanels } from "../src/observer-panels-system.mjs";

test("Observer exposes an explicit compact process lifecycle snapshot", () => {
  const html = observerSystemPanels();
  const client = clientScript();
  for (const token of [
    "Process Lifecycle Snapshot",
    "capture-kernel-process-lifecycle-button",
    "kernel-process-lifecycle-start-count",
    "kernel-process-lifecycle-exit-count",
  ]) assert.match(html, new RegExp(token, "u"));
  for (const token of [
    "/system/kernel/process-lifecycle-snapshot",
    "captureKernelProcessLifecycleSnapshot",
    "captureKernelProcessLifecycleButton.addEventListener",
  ]) assert.match(client, new RegExp(token.replaceAll("/", "\\/"), "u"));
  assert.equal(client.includes("setInterval(captureKernelProcessLifecycleSnapshot"), false);
});
