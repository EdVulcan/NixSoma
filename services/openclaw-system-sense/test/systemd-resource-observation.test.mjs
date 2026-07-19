import test from "node:test";
import assert from "node:assert/strict";

import {
  createSystemdUnitResourceObservation,
  summarizeSystemdUnitResources,
} from "../src/systemd-resource-observation.mjs";

test("systemd resource observation projects bounded read-only service properties", () => {
  const resources = createSystemdUnitResourceObservation({
    MemoryCurrent: 48 * 1024 * 1024,
    MemoryPeak: 64 * 1024 * 1024,
    MemoryAvailable: 1024 * 1024 * 1024,
    MemoryHigh: 1536 * 1024 * 1024,
    MemoryMax: 2 * 1024 * 1024 * 1024,
    EffectiveMemoryHigh: 1536 * 1024 * 1024,
    EffectiveMemoryMax: 2 * 1024 * 1024 * 1024,
    CPUUsageNSec: 123_000_000,
    TasksCurrent: 7,
    EffectiveTasksMax: 100,
    OOMPolicy: "stop",
    ManagedOOMKills: 0,
    ManagedOOMMemoryPressure: "auto",
    ManagedOOMSwap: "auto",
    Environment: "SECRET_MUST_NOT_ESCAPE=hidden",
  });

  assert.equal(resources.observed, true);
  assert.equal(resources.readOnly, true);
  assert.equal(resources.memory.currentBytes, 48 * 1024 * 1024);
  assert.equal(resources.memory.highLimited, true);
  assert.equal(resources.memory.maxLimited, true);
  assert.equal(resources.memory.effectiveHighBytes, 1536 * 1024 * 1024);
  assert.equal(resources.tasks.current, 7);
  assert.equal(resources.oom.policy, "stop");
  assert.doesNotMatch(JSON.stringify(resources), /SECRET_MUST_NOT_ESCAPE/u);
});

test("systemd resource observation rejects unsafe counters and summarizes observed units", () => {
  const first = createSystemdUnitResourceObservation({
    MemoryCurrent: 10,
    MemoryPeak: 20,
    CPUUsageNSec: 30,
    TasksCurrent: 2,
    ManagedOOMKills: 1,
  });
  const second = createSystemdUnitResourceObservation({
    MemoryCurrent: 15n,
    MemoryPeak: 25n,
    CPUUsageNSec: 35n,
    TasksCurrent: 3n,
    ManagedOOMKills: 0n,
  });
  const unsafe = createSystemdUnitResourceObservation({
    MemoryCurrent: Number.MAX_SAFE_INTEGER + 1,
    MemoryHigh: Number.MAX_SAFE_INTEGER + 1,
    MemoryMax: 18_446_744_073_709_551_615n,
    OOMPolicy: "invalid value",
  });
  const summary = summarizeSystemdUnitResources([
    { resources: first },
    { resources: second },
    { resources: unsafe },
    {},
  ]);

  assert.equal(unsafe.observed, true);
  assert.equal(unsafe.memory.currentBytes, null);
  assert.equal(unsafe.memory.highLimited, null);
  assert.equal(unsafe.memory.maxLimited, false);
  assert.equal(unsafe.oom.policy, null);
  assert.equal(summary.observedUnits, 3);
  assert.equal(summary.memoryCurrentBytes, 25);
  assert.equal(summary.memoryPeakBytes, 45);
  assert.equal(summary.cpuUsageNSec, 65);
  assert.equal(summary.tasksCurrent, 5);
  assert.equal(summary.managedOomKills, 1);
  assert.equal(summary.memoryHighLimitedUnits, 0);
  assert.equal(summary.memoryMaxLimitedUnits, 0);
});
