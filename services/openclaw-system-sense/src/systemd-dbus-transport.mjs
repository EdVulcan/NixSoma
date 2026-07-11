import dbus from "@homebridge/dbus-native";

const SYSTEMD_DESTINATION = "org.freedesktop.systemd1";
const SYSTEMD_MANAGER_PATH = "/org/freedesktop/systemd1";
const SYSTEMD_MANAGER_INTERFACE = "org.freedesktop.systemd1.Manager";
const DBUS_PROPERTIES_INTERFACE = "org.freedesktop.DBus.Properties";
const SERVICE_UNIT_PATTERN = /^[A-Za-z0-9_.@:-]+\.service$/u;

function validateUnitName(unitName) {
  if (!SERVICE_UNIT_PATTERN.test(unitName)) {
    throw new Error(`Native systemd transport rejects invalid service unit: ${unitName}`);
  }
}

function decodeProperties(entries) {
  if (!Array.isArray(entries)) return {};
  return Object.fromEntries(entries.map(([name, variant]) => [name, variant?.[1]?.[0]]));
}

function invoke(bus, message, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`D-Bus ${message.member} timed out.`)), timeoutMs);
    bus.invoke(message, (error, value) => {
      clearTimeout(timeout);
      if (error) {
        const failure = new Error(error.message ?? `D-Bus ${message.member} failed.`);
        failure.code = error.name ?? "dbus_method_failed";
        reject(failure);
        return;
      }
      resolve(value);
    });
  });
}

export function createSystemdDbusTransport({
  createSystemBus = dbus.systemBus,
  timeoutMs = 1500,
} = {}) {
  const bus = createSystemBus();

  async function getAll(path, interfaceName) {
    return decodeProperties(await invoke(bus, {
      destination: SYSTEMD_DESTINATION,
      path,
      interface: DBUS_PROPERTIES_INTERFACE,
      member: "GetAll",
      signature: "s",
      body: [interfaceName],
    }, timeoutMs));
  }

  async function getUnitPath(unitName) {
    validateUnitName(unitName);
    return invoke(bus, {
      destination: SYSTEMD_DESTINATION,
      path: SYSTEMD_MANAGER_PATH,
      interface: SYSTEMD_MANAGER_INTERFACE,
      member: "GetUnit",
      signature: "s",
      body: [unitName],
    }, timeoutMs);
  }

  async function restartUnit(unitName) {
    validateUnitName(unitName);
    return invoke(bus, {
      destination: SYSTEMD_DESTINATION,
      path: SYSTEMD_MANAGER_PATH,
      interface: SYSTEMD_MANAGER_INTERFACE,
      member: "RestartUnit",
      signature: "ss",
      body: [unitName, "replace"],
    }, timeoutMs);
  }

  function close() {
    const stream = bus?.connection?.stream;
    if (typeof stream?.end === "function") stream.end();
    else if (typeof stream?.destroy === "function") stream.destroy();
  }

  return {
    managerPath: SYSTEMD_MANAGER_PATH,
    managerInterface: SYSTEMD_MANAGER_INTERFACE,
    getAll,
    getUnitPath,
    restartUnit,
    close,
  };
}
