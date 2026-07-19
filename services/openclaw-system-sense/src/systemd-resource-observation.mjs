export const SYSTEMD_UNIT_RESOURCE_OBSERVATION_REGISTRY =
  "openclaw-systemd-unit-resource-observation-v0";
const UINT64_MAX = 18_446_744_073_709_551_615n;

function optionalCounter(value) {
  if (typeof value === "bigint") {
    return value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalLabel(value) {
  return typeof value === "string" && /^[a-z0-9_-]{1,64}$/u.test(value) ? value : null;
}

function optionalLimit(value) {
  const bytes = optionalCounter(value);
  if (bytes !== null) return { bytes, limited: true };
  if (value === UINT64_MAX || value === Number(UINT64_MAX)) {
    return { bytes: null, limited: false };
  }
  return { bytes: null, limited: null };
}

export function createSystemdUnitResourceObservation(properties = {}) {
  const highLimit = optionalLimit(properties.MemoryHigh);
  const maxLimit = optionalLimit(properties.MemoryMax);
  const memory = {
    currentBytes: optionalCounter(properties.MemoryCurrent),
    peakBytes: optionalCounter(properties.MemoryPeak),
    availableBytes: optionalCounter(properties.MemoryAvailable),
    highBytes: highLimit.bytes,
    highLimited: highLimit.limited,
    maxBytes: maxLimit.bytes,
    maxLimited: maxLimit.limited,
    effectiveHighBytes: optionalCounter(properties.EffectiveMemoryHigh),
    effectiveMaxBytes: optionalCounter(properties.EffectiveMemoryMax),
  };
  const cpu = {
    usageNSec: optionalCounter(properties.CPUUsageNSec),
  };
  const tasks = {
    current: optionalCounter(properties.TasksCurrent),
    effectiveMax: optionalCounter(properties.EffectiveTasksMax),
  };
  const oom = {
    policy: optionalLabel(properties.OOMPolicy),
    managedKills: optionalCounter(properties.ManagedOOMKills),
    memoryPressureMode: optionalLabel(properties.ManagedOOMMemoryPressure),
    swapMode: optionalLabel(properties.ManagedOOMSwap),
  };
  const observed = [...Object.values(memory), ...Object.values(cpu), ...Object.values(tasks), ...Object.values(oom)]
    .some((value) => value !== null);

  return {
    registry: SYSTEMD_UNIT_RESOURCE_OBSERVATION_REGISTRY,
    observed,
    source: observed ? "dbus_native_service_properties" : "unavailable",
    readOnly: true,
    memory,
    cpu,
    tasks,
    oom,
  };
}

function sumObserved(observations, selector) {
  const values = observations.map(selector).filter((value) => value !== null);
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(total) ? total : null;
}

export function summarizeSystemdUnitResources(units = []) {
  const observations = units.map((unit) => unit.resources).filter((resources) => resources?.observed === true);
  return {
    registry: SYSTEMD_UNIT_RESOURCE_OBSERVATION_REGISTRY,
    observedUnits: observations.length,
    memoryCurrentBytes: sumObserved(observations, (resources) => resources.memory.currentBytes),
    memoryPeakBytes: sumObserved(observations, (resources) => resources.memory.peakBytes),
    memoryHighLimitedUnits: observations.filter((resources) => resources.memory.highLimited === true).length,
    memoryMaxLimitedUnits: observations.filter((resources) => resources.memory.maxLimited === true).length,
    cpuUsageNSec: sumObserved(observations, (resources) => resources.cpu.usageNSec),
    tasksCurrent: sumObserved(observations, (resources) => resources.tasks.current),
    managedOomKills: sumObserved(observations, (resources) => resources.oom.managedKills),
  };
}
