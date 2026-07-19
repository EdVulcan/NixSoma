import test from "node:test";
import assert from "node:assert/strict";

import { createSystemdResourceTrend } from "../src/systemd-resource-trend.mjs";

function unit({ current, high = null, max = 1024, oomKills = 0 } = {}) {
  return {
    unit: "openclaw-core.service",
    resources: {
      observed: true,
      memory: {
        currentBytes: current,
        maxBytes: max,
        maxLimited: true,
        highBytes: null,
        highLimited: false,
        effectiveHighBytes: high ?? max,
        effectiveMaxBytes: max,
      },
      oom: { managedKills: oomKills },
    },
  };
}

test("resource trend establishes a restart-safe baseline before warning", () => {
  const owner = createSystemdResourceTrend({ minSampleIntervalMs: 0 });
  const first = owner.observe([unit({ current: 100 })], "2026-07-19T01:00:00.000Z");
  const second = owner.observe([unit({ current: 110 })], "2026-07-19T01:00:05.000Z");

  assert.equal(first.units[0].resourceTrend.status, "baseline");
  assert.equal(first.summary.status, "baseline");
  assert.equal(second.units[0].resourceTrend.status, "normal");
  assert.equal(second.units[0].resourceTrend.deltaBytes, 10);
  assert.equal(second.summary.warningUnits, 0);
  assert.equal(second.summary.persisted, false);
});

test("resource trend warns on bounded growth and critical limit or OOM evidence", () => {
  const growth = createSystemdResourceTrend({
    minSampleIntervalMs: 0,
    growthWarningBytes: 64,
    growthWarningPercent: 25,
  });
  growth.observe([unit({ current: 100, max: 1000 })], "2026-07-19T01:00:00.000Z");
  const rising = growth.observe([unit({ current: 180, max: 1000 })], "2026-07-19T01:00:05.000Z");
  assert.equal(rising.units[0].resourceTrend.status, "warning");
  assert.equal(rising.units[0].resourceTrend.reason, "memory_growth_warning");

  const limit = createSystemdResourceTrend({ minSampleIntervalMs: 0 });
  const critical = limit.observe([unit({ current: 970, max: 1000 })], "2026-07-19T01:00:00.000Z");
  assert.equal(critical.units[0].resourceTrend.status, "critical");
  assert.equal(critical.units[0].resourceTrend.reason, "memory_limit_critical");

  const softLimit = createSystemdResourceTrend({ minSampleIntervalMs: 0 });
  const warning = softLimit.observe([unit({ current: 850, high: 1000, max: 2000 })], "2026-07-19T01:00:00.000Z");
  assert.equal(warning.units[0].resourceTrend.status, "warning");
  assert.equal(warning.units[0].resourceTrend.reason, "memory_limit_warning");
  assert.equal(warning.units[0].resourceTrend.warningLimitSource, "effective_memory_high");
  assert.equal(warning.units[0].resourceTrend.limitSource, "memory_max");

  const oom = createSystemdResourceTrend({ minSampleIntervalMs: 0 });
  oom.observe([unit({ current: 100, oomKills: 0 })], "2026-07-19T01:00:00.000Z");
  const killed = oom.observe([unit({ current: 90, oomKills: 1 })], "2026-07-19T01:00:05.000Z");
  assert.equal(killed.units[0].resourceTrend.status, "critical");
  assert.equal(killed.units[0].resourceTrend.reason, "managed_oom_kills_increased");
});

test("resource trend bounds samples, deduplicates rapid reads, and clears unavailable units", () => {
  const owner = createSystemdResourceTrend({ maxSamples: 2, minSampleIntervalMs: 1000 });
  owner.observe([unit({ current: 100 })], "2026-07-19T01:00:00.000Z");
  const duplicate = owner.observe([unit({ current: 900 })], "2026-07-19T01:00:00.500Z");
  assert.equal(duplicate.units[0].resourceTrend.samples, 1);
  assert.equal(duplicate.units[0].resourceTrend.currentBytes, 100);
  owner.observe([unit({ current: 110 })], "2026-07-19T01:00:02.000Z");
  const bounded = owner.observe([unit({ current: 120 })], "2026-07-19T01:00:04.000Z");
  assert.equal(bounded.units[0].resourceTrend.samples, 2);
  assert.equal(bounded.units[0].resourceTrend.previousBytes, 110);

  const unavailable = owner.observe([{
    unit: "openclaw-core.service",
    resources: { observed: false, memory: {}, oom: {} },
  }], "2026-07-19T01:00:06.000Z");
  assert.equal(unavailable.units[0].resourceTrend.status, "unavailable");
  assert.equal(unavailable.summary.status, "unavailable");
  const restored = owner.observe([unit({ current: 130 })], "2026-07-19T01:00:08.000Z");
  assert.equal(restored.units[0].resourceTrend.status, "baseline");
});
