import test from "node:test";
import assert from "node:assert/strict";

import { createSystemdDbusAdapter } from "../src/systemd-dbus-adapter.mjs";
import { createSystemdDbusTransport } from "../src/systemd-dbus-transport.mjs";

function variant(value) {
  return [[{ type: typeof value === "number" ? "u" : "s", child: [] }], [value]];
}

test("native systemd adapter reads fixed unit properties without mutation methods", async () => {
  const calls = [];
  let closed = false;
  const bus = {
    connection: { stream: { end: () => { closed = true; } } },
    invoke(message, callback) {
      calls.push(message);
      if (message.path === "/org/freedesktop/systemd1" && message.member === "GetAll") {
        callback(null, [["Version", variant("258.5")]]);
        return;
      }
      if (message.member === "GetUnit") {
        callback(null, "/org/freedesktop/systemd1/unit/openclaw_2dcore_2eservice");
        return;
      }
      if (message.body?.[0] === "org.freedesktop.systemd1.Unit") {
        callback(null, [
          ["Description", variant("OpenClaw Core")],
          ["LoadState", variant("loaded")],
          ["ActiveState", variant("active")],
          ["SubState", variant("running")],
          ["UnitFileState", variant("enabled")],
          ["FragmentPath", variant("/nix/store/openclaw-core.service")],
          ["Environment", variant("SECRET_MUST_NOT_ESCAPE=hidden")],
        ]);
        return;
      }
      callback(null, [
        ["MainPID", variant(1234)],
        ["ExecMainStatus", variant(0)],
      ]);
    },
  };
  const adapter = createSystemdDbusAdapter({ createSystemBus: () => bus });

  const result = await adapter.inspectUnits(["openclaw-core.service"]);
  const unit = result.units.get("openclaw-core.service");

  assert.equal(result.transport, "dbus_native");
  assert.equal(result.version, "systemd 258.5");
  assert.equal(unit.found, true);
  assert.equal(unit.properties.ActiveState, "active");
  assert.equal(unit.properties.MainPID, 1234);
  assert.equal("Environment" in unit.properties, false);
  assert.equal(closed, true);
  assert.deepEqual([...new Set(calls.map((call) => call.member))].sort(), ["GetAll", "GetUnit"]);
});

test("native systemd adapter rejects non-service unit names before bus invocation", async () => {
  let busCreated = false;
  const adapter = createSystemdDbusAdapter({
    createSystemBus: () => {
      busCreated = true;
      return null;
    },
  });

  await assert.rejects(
    adapter.inspectUnits(["../../invalid"]),
    /rejects invalid service unit/u,
  );
  assert.equal(busCreated, false);
});

test("native systemd transport emits only the fixed restart method shape", async () => {
  let closed = false;
  const calls = [];
  const bus = {
    connection: { stream: { end: () => { closed = true; } } },
    invoke(message, callback) {
      calls.push(message);
      callback(null, "/org/freedesktop/systemd1/job/42");
    },
  };
  const transport = createSystemdDbusTransport({ createSystemBus: () => bus });

  const jobPath = await transport.restartUnit("openclaw-system-sense.service");
  transport.close();

  assert.equal(jobPath, "/org/freedesktop/systemd1/job/42");
  assert.deepEqual(calls, [{
    destination: "org.freedesktop.systemd1",
    path: "/org/freedesktop/systemd1",
    interface: "org.freedesktop.systemd1.Manager",
    member: "RestartUnit",
    signature: "ss",
    body: ["openclaw-system-sense.service", "replace"],
  }]);
  assert.equal(closed, true);
});
