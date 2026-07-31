import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerSystemPanels } from "../src/observer-panels-system.mjs";

test("Observer exposes only an explicit compact kernel activity snapshot", () => {
  const html = observerSystemPanels();
  const client = clientScript();
  for (const token of [
    "Kernel Activity Snapshot",
    "capture-kernel-activity-button",
    "kernel-activity-available-lanes",
    "kernel-activity-process-count",
    "kernel-activity-network-count",
    "kernel-activity-file-count",
  ]) assert.match(html, new RegExp(token, "u"));
  for (const token of [
    "/system/kernel/activity-snapshot",
    "captureKernelActivitySnapshot",
    "kernelActivityAvailableLanes",
    "captureKernelActivityButton.addEventListener",
  ]) assert.match(client, new RegExp(token.replaceAll("/", "\\/"), "u"));
  assert.equal(client.includes("setInterval(captureKernelActivitySnapshot"), false);
  assert.doesNotMatch(client, /kernelActivityEvents|kernelActivityCommNames|kernelActivityPath/u);
});
