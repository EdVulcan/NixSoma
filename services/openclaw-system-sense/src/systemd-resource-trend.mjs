export const SYSTEMD_UNIT_RESOURCE_TREND_REGISTRY =
  "openclaw-systemd-unit-resource-trend-v0";

const DEFAULT_MAX_SAMPLES = 4;
const DEFAULT_MIN_SAMPLE_INTERVAL_MS = 1000;
const DEFAULT_WARNING_PERCENT = 80;
const DEFAULT_CRITICAL_PERCENT = 95;
const DEFAULT_GROWTH_WARNING_BYTES = 64 * 1024 * 1024;
const DEFAULT_GROWTH_WARNING_PERCENT = 25;

function finiteCounter(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function roundPercent(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function selectHardLimit(memory = {}) {
  if (memory.maxLimited === true && finiteCounter(memory.maxBytes) !== null) {
    return { bytes: memory.maxBytes, source: "memory_max" };
  }
  if (finiteCounter(memory.effectiveMaxBytes) !== null) {
    return { bytes: memory.effectiveMaxBytes, source: "effective_memory_max" };
  }
  return { bytes: null, source: "unavailable" };
}

function selectWarningLimit(memory = {}, hardLimit) {
  if (memory.highLimited === true && finiteCounter(memory.highBytes) !== null) {
    return { bytes: memory.highBytes, source: "memory_high" };
  }
  if (finiteCounter(memory.effectiveHighBytes) !== null) {
    return { bytes: memory.effectiveHighBytes, source: "effective_memory_high" };
  }
  return hardLimit;
}

function classifyTrend(current, previous, options) {
  const hardLimit = selectHardLimit(current.memory);
  const warningLimit = selectWarningLimit(current.memory, hardLimit);
  const utilizationPercent = hardLimit.bytes > 0
    ? roundPercent((current.memoryCurrentBytes / hardLimit.bytes) * 100)
    : null;
  const warningUtilizationPercent = warningLimit.bytes > 0
    ? roundPercent((current.memoryCurrentBytes / warningLimit.bytes) * 100)
    : null;
  const deltaBytes = previous ? current.memoryCurrentBytes - previous.memoryCurrentBytes : null;
  const deltaPercent = previous?.memoryCurrentBytes > 0
    ? roundPercent((deltaBytes / previous.memoryCurrentBytes) * 100)
    : null;
  const oomIncreased = previous
    && current.managedOomKills !== null
    && previous.managedOomKills !== null
    && current.managedOomKills > previous.managedOomKills;

  let status = previous ? "normal" : "baseline";
  let reason = previous ? "stable" : "first_sample";
  if (oomIncreased) {
    status = "critical";
    reason = "managed_oom_kills_increased";
  } else if (utilizationPercent !== null && utilizationPercent >= options.criticalPercent) {
    status = "critical";
    reason = "memory_limit_critical";
  } else if (warningUtilizationPercent !== null && warningUtilizationPercent >= options.warningPercent) {
    status = "warning";
    reason = "memory_limit_warning";
  } else if (deltaBytes !== null
    && deltaPercent !== null
    && deltaBytes >= options.growthWarningBytes
    && deltaPercent >= options.growthWarningPercent) {
    status = "warning";
    reason = "memory_growth_warning";
  }

  return {
    registry: SYSTEMD_UNIT_RESOURCE_TREND_REGISTRY,
    status,
    reason,
    samples: current.samples,
    observedAt: current.observedAt,
    currentBytes: current.memoryCurrentBytes,
    previousBytes: previous?.memoryCurrentBytes ?? null,
    deltaBytes,
    deltaPercent,
    limitBytes: hardLimit.bytes,
    limitSource: hardLimit.source,
    utilizationPercent,
    warningLimitBytes: warningLimit.bytes,
    warningLimitSource: warningLimit.source,
    warningUtilizationPercent,
    managedOomKills: current.managedOomKills,
    previousManagedOomKills: previous?.managedOomKills ?? null,
    readOnly: true,
    persisted: false,
  };
}

function unavailableTrend(observedAt) {
  return {
    registry: SYSTEMD_UNIT_RESOURCE_TREND_REGISTRY,
    status: "unavailable",
    reason: "resource_observation_unavailable",
    samples: 0,
    observedAt,
    currentBytes: null,
    previousBytes: null,
    deltaBytes: null,
    deltaPercent: null,
    limitBytes: null,
    limitSource: "unavailable",
    utilizationPercent: null,
    warningLimitBytes: null,
    warningLimitSource: "unavailable",
    warningUtilizationPercent: null,
    managedOomKills: null,
    previousManagedOomKills: null,
    readOnly: true,
    persisted: false,
  };
}

export function createSystemdResourceTrend({
  maxSamples = DEFAULT_MAX_SAMPLES,
  minSampleIntervalMs = DEFAULT_MIN_SAMPLE_INTERVAL_MS,
  warningPercent = DEFAULT_WARNING_PERCENT,
  criticalPercent = DEFAULT_CRITICAL_PERCENT,
  growthWarningBytes = DEFAULT_GROWTH_WARNING_BYTES,
  growthWarningPercent = DEFAULT_GROWTH_WARNING_PERCENT,
} = {}) {
  const histories = new Map();
  const options = {
    maxSamples: Math.max(2, Math.min(8, maxSamples)),
    minSampleIntervalMs: Math.max(0, minSampleIntervalMs),
    warningPercent,
    criticalPercent,
    growthWarningBytes,
    growthWarningPercent,
  };

  function observeUnit(unit, observedAt) {
    const currentBytes = finiteCounter(unit.resources?.memory?.currentBytes);
    if (unit.resources?.observed !== true || currentBytes === null) {
      histories.delete(unit.unit);
      return unavailableTrend(observedAt);
    }

    const history = histories.get(unit.unit) ?? [];
    const last = history.at(-1) ?? null;
    const observedAtMs = Date.parse(observedAt);
    const lastAtMs = Date.parse(last?.observedAt ?? "");
    if (!last || !Number.isFinite(lastAtMs) || observedAtMs - lastAtMs >= options.minSampleIntervalMs) {
      history.push({
        observedAt,
        memoryCurrentBytes: currentBytes,
        memory: unit.resources.memory,
        managedOomKills: finiteCounter(unit.resources?.oom?.managedKills),
      });
      if (history.length > options.maxSamples) history.splice(0, history.length - options.maxSamples);
      histories.set(unit.unit, history);
    }

    const current = history.at(-1);
    current.samples = history.length;
    return classifyTrend(current, history.at(-2) ?? null, options);
  }

  function observe(units = [], observedAt = new Date().toISOString()) {
    const knownUnits = new Set(units.map((unit) => unit.unit));
    for (const unit of histories.keys()) {
      if (!knownUnits.has(unit)) histories.delete(unit);
    }
    const trendedUnits = units.map((unit) => ({
      ...unit,
      resourceTrend: observeUnit(unit, observedAt),
    }));
    const trends = trendedUnits.map((unit) => unit.resourceTrend);
    const observedUnitCount = trends.filter((trend) => trend.status !== "unavailable").length;
    const warningUnits = trendedUnits.filter((unit) => ["warning", "critical"].includes(unit.resourceTrend.status));
    return {
      units: trendedUnits,
      summary: {
        registry: SYSTEMD_UNIT_RESOURCE_TREND_REGISTRY,
        status: trends.some((trend) => trend.status === "critical")
          ? "critical"
          : trends.some((trend) => trend.status === "warning")
            ? "warning"
            : trends.some((trend) => trend.status === "baseline")
              ? "baseline"
              : observedUnitCount > 0 ? "normal" : "unavailable",
        observedUnits: observedUnitCount,
        baselineUnits: trends.filter((trend) => trend.status === "baseline").length,
        warningUnits: trends.filter((trend) => trend.status === "warning").length,
        criticalUnits: trends.filter((trend) => trend.status === "critical").length,
        warnings: warningUnits.map((unit) => ({
          unit: unit.unit,
          status: unit.resourceTrend.status,
          reason: unit.resourceTrend.reason,
        })),
        sampleLimit: options.maxSamples,
        persisted: false,
        hostMutation: false,
      },
    };
  }

  return { observe };
}
