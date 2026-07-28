import assert from "node:assert/strict";
import test from "node:test";

import { createAiWorkbenchLifecycle } from "../src/ai-workbench-lifecycle.mjs";

function harness({ initiallyActive = false } = {}) {
  let active = initiallyActive;
  const pid = 4242;
  const calls = [];
  const execFileAsync = async (command, args) => {
    calls.push({ command, args });
    const operation = args[1];
    if (operation === "start") active = true;
    if (operation === "stop") active = false;
    if (operation === "show") {
      return {
        stdout: [
          `ActiveState=${active ? "active" : "inactive"}`,
          `SubState=${active ? "running" : "dead"}`,
          `MainPID=${active ? pid : 0}`,
          "",
        ].join("\n"),
      };
    }
    return { stdout: "" };
  };
  const observeSurfaceInventory = () => ({
    registry: "nixsoma-ai-surface-inventory-v0",
    status: "available",
    available: true,
    sequence: active ? 2 : 3,
    surfaces: active
      ? [{ surfaceId: 71, pid, width: 1280, height: 720, activated: true }]
      : [],
  });
  const lifecycle = createAiWorkbenchLifecycle({
    env: {
      OPENCLAW_AI_APPLICATION_LIFECYCLE_ENABLED: "1",
      OPENCLAW_AI_WORKBENCH_UNIT: "nixsoma-ai-workbench.service",
      OPENCLAW_AI_WORKBENCH_SYSTEMCTL: "/nix/store/systemd/bin/systemctl",
      OPENCLAW_AI_WORKBENCH_POLL_MS: "5",
      OPENCLAW_AI_WORKBENCH_SETTLE_TIMEOUT_MS: "250",
    },
    execFileAsync,
    observeSurfaceInventory,
    sleep: async () => {},
  });
  return { lifecycle, calls };
}

test("fixed workbench start waits for the matching compositor surface", async () => {
  const { lifecycle, calls } = harness();
  const result = await lifecycle.start();
  assert.equal(result.status, "running");
  assert.equal(result.mainPid, 4242);
  assert.equal(result.surfaceAttached, true);
  assert.equal(result.matchingSurface.surfaceId, 71);
  assert.deepEqual(calls.find(({ args }) => args[1] === "start")?.args, [
    "--user",
    "start",
    "nixsoma-ai-workbench.service",
  ]);
  assert.equal(calls.some(({ args }) => args.includes("--now")), false);
});

test("fixed workbench stop waits for its prior surface to disappear", async () => {
  const { lifecycle, calls } = harness({ initiallyActive: true });
  await lifecycle.reconcile();
  const result = await lifecycle.stop();
  assert.equal(result.status, "stopped");
  assert.equal(result.active, false);
  assert.equal(result.surfaceAttached, false);
  assert.deepEqual(calls.find(({ args }) => args[1] === "stop")?.args, [
    "--user",
    "stop",
    "nixsoma-ai-workbench.service",
  ]);
});

test("restart reconciliation recovers an already-running bounded application", async () => {
  const { lifecycle, calls } = harness({ initiallyActive: true });
  const result = await lifecycle.reconcile();
  assert.equal(result.status, "running");
  assert.equal(result.surfaceAttached, true);
  assert.equal(calls.some(({ args }) => ["start", "stop"].includes(args[1])), false);
});
