import test from "node:test";
import assert from "node:assert/strict";

import { runFixedSystemdRestart } from "../src/systemd-dbus-restart-helper.mjs";

test("fixed native restart helper verifies a new running process and closes transport", async () => {
  let readIndex = 0;
  let closed = false;
  const restartCalls = [];
  const states = [
    { activeState: "active", subState: "running", mainPid: 100 },
    { activeState: "activating", subState: "auto-restart", mainPid: null },
    { activeState: "active", subState: "running", mainPid: 200 },
  ];
  const transport = {
    async getUnitPath(unitName) {
      assert.equal(unitName, "openclaw-system-sense.service");
      return "/org/freedesktop/systemd1/unit/openclaw_2dsystem_2dsense_2eservice";
    },
    async getAll(_path, interfaceName) {
      const state = states[Math.min(readIndex, states.length - 1)];
      if (interfaceName.endsWith(".Unit")) {
        return {
          LoadState: "loaded",
          ActiveState: state.activeState,
          SubState: state.subState,
        };
      }
      readIndex += 1;
      return { MainPID: state.mainPid ?? 0 };
    },
    async restartUnit(unitName) {
      restartCalls.push(unitName);
      return "/org/freedesktop/systemd1/job/42";
    },
    close() {
      closed = true;
    },
  };

  const result = await runFixedSystemdRestart({
    createTransport: () => transport,
    pollIntervalMs: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.transport, "dbus_native");
  assert.equal(result.method, "org.freedesktop.systemd1.Manager.RestartUnit");
  assert.equal(result.before.mainPid, 100);
  assert.equal(result.after.mainPid, 200);
  assert.deepEqual(restartCalls, ["openclaw-system-sense.service"]);
  assert.equal(closed, true);
});

test("fixed native restart helper rejects arguments before opening a transport", async () => {
  let transportCreated = false;
  await assert.rejects(
    runFixedSystemdRestart({
      args: ["openclaw-core.service"],
      createTransport: () => {
        transportCreated = true;
        return null;
      },
    }),
    /accepts no arguments/u,
  );
  assert.equal(transportCreated, false);
});
