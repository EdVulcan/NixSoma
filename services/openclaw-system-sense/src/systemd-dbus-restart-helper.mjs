import { pathToFileURL } from "node:url";
import { createSystemdDbusTransport } from "./systemd-dbus-transport.mjs";

const TARGET_UNIT = "openclaw-system-sense.service";
const SYSTEMD_UNIT_INTERFACE = "org.freedesktop.systemd1.Unit";
const SYSTEMD_SERVICE_INTERFACE = "org.freedesktop.systemd1.Service";

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function readState(transport) {
  const path = await transport.getUnitPath(TARGET_UNIT);
  const [unit, service] = await Promise.all([
    transport.getAll(path, SYSTEMD_UNIT_INTERFACE),
    transport.getAll(path, SYSTEMD_SERVICE_INTERFACE),
  ]);
  return {
    loadState: unit.LoadState ?? "unknown",
    activeState: unit.ActiveState ?? "unknown",
    subState: unit.SubState ?? "unknown",
    mainPid: Number(service.MainPID) || null,
  };
}

export async function runFixedSystemdRestart({
  args = process.argv.slice(2),
  createTransport = createSystemdDbusTransport,
  verificationTimeoutMs = 10000,
  pollIntervalMs = 100,
} = {}) {
  if (args.length !== 0) {
    throw new Error("Native systemd restart helper accepts no arguments.");
  }

  const transport = createTransport();
  try {
    const before = await readState(transport);
    const jobPath = await transport.restartUnit(TARGET_UNIT);
    const deadline = Date.now() + verificationTimeoutMs;
    let after = await readState(transport);
    while (
      Date.now() < deadline
      && (after.activeState !== "active" || after.subState !== "running" || after.mainPid === before.mainPid)
    ) {
      await wait(pollIntervalMs);
      after = await readState(transport);
    }
    if (after.activeState !== "active" || after.subState !== "running" || after.mainPid === before.mainPid) {
      throw new Error(`Native systemd restart verification timed out for ${TARGET_UNIT}.`);
    }
    return {
      ok: true,
      transport: "dbus_native",
      method: "org.freedesktop.systemd1.Manager.RestartUnit",
      unit: TARGET_UNIT,
      jobPath,
      before,
      after,
    };
  } finally {
    transport.close();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runFixedSystemdRestart()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : "Native systemd restart failed."}\n`);
      process.exitCode = 1;
    });
}
