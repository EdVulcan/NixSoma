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
];
const SERVICE_PROPERTY_NAMES = ["MainPID", "ExecMainStatus"];

function selectProperties(properties, names) {
  return Object.fromEntries(names.filter((name) => name in properties).map((name) => [name, properties[name]]));
}

export function createSystemdDbusAdapter({
  createTransport = (options) => createSystemdDbusTransport(options),
  createSystemBus,
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
      return {
        available: true,
        transport: "dbus_native",
        version: manager.Version ? `systemd ${manager.Version}` : "systemd D-Bus",
        units: new Map(units.map((unit) => [unit.unitName, unit])),
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
