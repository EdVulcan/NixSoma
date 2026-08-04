import assert from "node:assert/strict";
import test from "node:test";

import { createAiNativeIntakeLifecycle } from "../src/ai-native-intake-lifecycle.mjs";

function harness({ initiallyActive = false, activationLag = false } = {}) {
  let active = initiallyActive;
  let activeInventoryReads = 0;
  const pid = 5252;
  const calls = [];
  const lifecycle = createAiNativeIntakeLifecycle({
    env: {
      OPENCLAW_AI_APPLICATION_LIFECYCLE_ENABLED: "1",
      OPENCLAW_AI_NATIVE_INTAKE_UNIT: "nixsoma-ai-native-intake.service",
      OPENCLAW_AI_NATIVE_INTAKE_SYSTEMCTL: "/nix/store/systemd/bin/systemctl",
      OPENCLAW_AI_NATIVE_INTAKE_POLL_MS: "5",
      OPENCLAW_AI_NATIVE_INTAKE_SETTLE_TIMEOUT_MS: "250",
    },
    execFileAsync: async (command, args) => {
      calls.push({ command, args });
      if (args[1] === "start") active = true;
      if (args[1] === "stop") active = false;
      if (args[1] === "show") {
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
    },
    observeSurfaceInventory: () => {
      if (active) activeInventoryReads += 1;
      return {
        status: "available",
        available: true,
        sequence: active ? 8 : 9,
        surfaces: active
          ? [{
            surfaceId: 81,
            pid,
            width: 1280,
            height: 720,
            activated: !activationLag || activeInventoryReads > 1,
          }]
          : [],
      };
    },
    sleep: async () => {},
  });
  return { lifecycle, calls };
}

test("native intake lifecycle owns only the exact static user unit", async () => {
  const { lifecycle, calls } = harness();
  const started = await lifecycle.start();
  assert.equal(started.registry, "nixsoma-ai-native-intake-lifecycle-v0");
  assert.equal(started.status, "running");
  assert.equal(started.matchingSurface.surfaceId, 81);
  assert.equal(started.matchingSurface.activated, true);
  assert.deepEqual(calls.find(({ args }) => args[1] === "start")?.args, [
    "--user",
    "start",
    "nixsoma-ai-native-intake.service",
  ]);

  const stopped = await lifecycle.stop();
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.active, false);
  assert.equal(stopped.surfaceAttached, false);
  assert.deepEqual(calls.find(({ args }) => args[1] === "stop")?.args, [
    "--user",
    "stop",
    "nixsoma-ai-native-intake.service",
  ]);
});

test("native intake lifecycle rejects a widened unit configuration", () => {
  assert.throws(() => createAiNativeIntakeLifecycle({
    env: {
      OPENCLAW_AI_APPLICATION_LIFECYCLE_ENABLED: "1",
      OPENCLAW_AI_NATIVE_INTAKE_UNIT: "arbitrary.service",
    },
    observeSurfaceInventory: () => ({ surfaces: [] }),
  }), /configuration is invalid/u);
});

test("native intake start waits for its fixed surface to become active", async () => {
  const { lifecycle } = harness({ activationLag: true });
  const started = await lifecycle.start();

  assert.equal(started.status, "running");
  assert.equal(started.matchingSurface.activated, true);
});
