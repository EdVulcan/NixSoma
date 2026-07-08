import test from "node:test";
import assert from "node:assert/strict";

import { createSystemdInspection } from "../src/systemd-inspection.mjs";

const specs = [
  {
    key: "eventHub",
    name: "openclaw-event-hub",
    unit: "openclaw-event-hub.service",
    description: "OpenClaw Event Hub",
    component: "body",
    url: "http://127.0.0.1:4101",
    after: [],
  },
  {
    key: "core",
    name: "openclaw-core",
    unit: "openclaw-core.service",
    description: "OpenClaw Core",
    component: "body",
    url: "http://127.0.0.1:4100",
    after: ["openclaw-event-hub"],
  },
  {
    key: "observerUi",
    name: "observer-ui",
    unit: "observer-ui.service",
    description: "OpenClaw Observer UI",
    component: "observer",
    url: "http://127.0.0.1:4170",
    after: ["openclaw-core", "openclaw-event-hub"],
  },
];

test("systemd inspection returns planned inventory when systemd is unavailable", async () => {
  const inspection = createSystemdInspection({
    openClawSystemdUnitSpecs: specs,
    platform: "darwin",
  });

  const inventory = await inspection.buildSystemdUnitInventory();

  assert.equal(inventory.registry, "openclaw-systemd-unit-inventory-v0");
  assert.equal(inventory.source.systemdAvailable, false);
  assert.equal(inventory.summary.total, specs.length);
  assert.equal(inventory.summary.observed, 0);
  assert.equal(inventory.units[0].observation, "planned_inventory_only");
  assert.equal(inventory.governance.hostMutation, false);
});

test("systemd inspection reads unit state and builds dependency maps without mutation", async () => {
  const calls = [];
  const inspection = createSystemdInspection({
    openClawSystemdUnitSpecs: specs,
    platform: "linux",
    execFileAsync: async (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "--version") {
        return { stdout: "systemd 255\n" };
      }
      const unit = args[1];
      return {
        stdout: [
          `Id=${unit}`,
          "LoadState=loaded",
          "ActiveState=active",
          "SubState=running",
          "UnitFileState=enabled",
          `Description=${unit} description`,
          "MainPID=123",
          "ExecMainStatus=0",
          "FragmentPath=/nix/store/openclaw.service",
        ].join("\n"),
      };
    },
  });

  const inventory = await inspection.buildSystemdUnitInventory();
  const dependencyMap = await inspection.buildSystemdDependencyMap();

  assert.equal(inventory.source.systemdAvailable, true);
  assert.equal(inventory.source.systemdVersion, "systemd 255");
  assert.equal(inventory.summary.active, specs.length);
  assert.equal(inventory.units[0].systemdObserved, true);
  assert.equal(inventory.governance.hostMutation, false);
  assert.equal(dependencyMap.summary.nodes, specs.length);
  assert.equal(dependencyMap.summary.edges, 3);
  assert.deepEqual(dependencyMap.roots, ["openclaw-event-hub.service"]);
  assert.equal(dependencyMap.nodes.find((node) => node.unit === "openclaw-event-hub.service").impactClass, "foundational");
  assert.equal(calls.some((call) => call.includes("restart")), false);
});
