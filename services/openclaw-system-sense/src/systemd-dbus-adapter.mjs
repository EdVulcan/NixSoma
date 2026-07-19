import dbus from "@homebridge/dbus-native";
import { createSystemdDbusTransport } from "./systemd-dbus-transport.mjs";

const SYSTEMD_UNIT_INTERFACE = "org.freedesktop.systemd1.Unit";
const SYSTEMD_SERVICE_INTERFACE = "org.freedesktop.systemd1.Service";
const SERVICE_UNIT_PATTERN = /^[A-Za-z0-9_.@:-]+\.service$/u;
const UNIT_PROPERTY_NAMES = [
  "Description",
  "LoadState",
  "ActiveState",
  "SubState",
  "UnitFileState",
  "FragmentPath",
  "After",
];
const SERVICE_PROPERTY_NAMES = [
  "MainPID",
  "ExecMainStatus",
  "MemoryCurrent",
  "MemoryPeak",
  "MemoryAvailable",
  "MemoryHigh",
  "MemoryMax",
  "EffectiveMemoryHigh",
  "EffectiveMemoryMax",
  "CPUUsageNSec",
  "TasksCurrent",
  "EffectiveTasksMax",
  "OOMPolicy",
  "ManagedOOMKills",
  "ManagedOOMMemoryPressure",
  "ManagedOOMSwap",
];

function selectProperties(properties, names) {
  return Object.fromEntries(names.filter((name) => name in properties).map((name) => [name, properties[name]]));
}

function selectKnownServiceDependencies(after, knownUnitNames) {
  if (!Array.isArray(after)) return null;
  return [...new Set(after.flatMap((dependency) => {
    if (typeof dependency !== "string") return [];
    if (knownUnitNames.has(dependency)) return [dependency];
    const serviceName = dependency.endsWith(".service") ? dependency : `${dependency}.service`;
    return knownUnitNames.has(serviceName) ? [serviceName] : [];
  }))].sort();
}

export function createSystemdDbusAdapter({
  createTransport = (options) => createSystemdDbusTransport(options),
  createSystemBus = dbus.systemBus,
  timeoutMs = 1500,
} = {}) {
  async function inspectUnit(transport, unitName) {
    if (!SERVICE_UNIT_PATTERN.test(unitName)) {
      throw new Error(`Native systemd inventory rejects invalid service unit: ${unitName}`);
    }
    try {
      const path = await transport.getUnitPath(unitName);
      const [unitProperties, serviceProperties] = await Promise.all([
        transport.getAll(path, SYSTEMD_UNIT_INTERFACE),
        transport.getAll(path, SYSTEMD_SERVICE_INTERFACE),
      ]);
      return {
        unitName,
        found: true,
        properties: {
          ...selectProperties(unitProperties, UNIT_PROPERTY_NAMES),
          ...selectProperties(serviceProperties, SERVICE_PROPERTY_NAMES),
        },
      };
    } catch (error) {
      return {
        unitName,
        found: false,
        error: error instanceof Error ? error.message : "Native systemd unit inspection failed.",
        errorCode: error?.code ?? null,
      };
    }
  }

  async function inspectUnits(unitNames) {
    const names = [...new Set(unitNames)];
    for (const unitName of names) {
      if (!SERVICE_UNIT_PATTERN.test(unitName)) {
        throw new Error(`Native systemd inventory rejects invalid service unit: ${unitName}`);
      }
    }
    const transport = createTransport({ createSystemBus, timeoutMs });
    try {
      const manager = await transport.getAll(transport.managerPath, transport.managerInterface);
      const units = await Promise.all(names.map((unitName) => inspectUnit(transport, unitName)));
      const knownUnitNames = new Set(names);
      const nativeDependencies = new Map();
      const nativeDependencyObservedUnits = [];
      for (const unit of units) {
        const dependencies = selectKnownServiceDependencies(unit.properties?.After, knownUnitNames);
        if (unit.found !== true || dependencies === null) continue;
        nativeDependencies.set(unit.unitName, dependencies);
        nativeDependencyObservedUnits.push(unit.unitName);
      }
      return {
        available: true,
        transport: "dbus_native",
        version: manager.Version ? `systemd ${manager.Version}` : "systemd D-Bus",
        units: new Map(units.map((unit) => [unit.unitName, unit])),
        nativeDependencies,
        nativeDependencyObservedUnits: nativeDependencyObservedUnits.sort(),
        readOnlyMethods: [
          "org.freedesktop.systemd1.Manager.GetUnit",
          "org.freedesktop.DBus.Properties.GetAll",
        ],
      };
    } finally {
      transport.close();
    }
  }

  return { inspectUnits };
}
