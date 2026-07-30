import { pathToFileURL } from "node:url";
import dbus from "@homebridge/dbus-native";
import { createSystemdDbusTransport } from "../../../packages/shared-systemd/src/systemd-dbus-transport.mjs";
import {
  HOSTD_RESTART_CAPABILITY_REGISTRY,
  hostdRestartCapabilityForTarget,
} from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";

export const HOSTD_TARGET_UNIT = "openclaw-system-sense.service";
export const HOSTD_RESTART_METHOD = "org.freedesktop.systemd1.Manager.RestartUnit";

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function readState(transport, unit = HOSTD_TARGET_UNIT) {
  const path = await transport.getUnitPath(unit);
  const [unitProperties, service] = await Promise.all([
    transport.getAll(path, "org.freedesktop.systemd1.Unit"),
    transport.getAll(path, "org.freedesktop.systemd1.Service"),
  ]);
  const mainPid = Number(service.MainPID);
  return {
    loadState: unitProperties.LoadState ?? "unknown",
    activeState: unitProperties.ActiveState ?? "unknown",
    subState: unitProperties.SubState ?? "unknown",
    mainPid: Number.isInteger(mainPid) && mainPid >= 0 ? mainPid : null,
  };
}

function createDefaultTransport(options = {}) {
  return createSystemdDbusTransport({
    ...options,
    createSystemBus: options.createSystemBus ?? dbus.systemBus,
  });
}

export async function runFixedSystemdRestart({
  args = [],
  unit = HOSTD_TARGET_UNIT,
  createTransport = createDefaultTransport,
  verificationTimeoutMs = 10000,
  pollIntervalMs = 100,
} = {}) {
  if (!Array.isArray(args) || args.length !== 0) {
    throw new Error("OpenClaw hostd restart capability accepts no arguments.");
  }
  const capability = hostdRestartCapabilityForTarget(unit);
  if (!capability) {
    throw new Error(`OpenClaw hostd restart capability rejects ${unit}.`);
  }

  const transport = createTransport();
  try {
    const before = await readState(transport, capability.targetUnit);
    const jobPath = await transport.restartUnit(capability.targetUnit);
    const deadline = Date.now() + verificationTimeoutMs;
    let after = await readState(transport, capability.targetUnit);
    while (
      Date.now() < deadline
      && (after.activeState !== "active" || after.subState !== "running" || after.mainPid === before.mainPid)
    ) {
      await wait(pollIntervalMs);
      after = await readState(transport, capability.targetUnit);
    }
    if (after.activeState !== "active" || after.subState !== "running" || after.mainPid === before.mainPid) {
      throw new Error(`OpenClaw hostd restart verification timed out for ${capability.targetUnit}.`);
    }
    return {
      ok: true,
      owner: "openclaw-hostd",
      transport: "dbus_native",
      method: HOSTD_RESTART_METHOD,
      unit: capability.targetUnit,
      capability: {
        registry: HOSTD_RESTART_CAPABILITY_REGISTRY,
        operation: capability.operation,
        capabilityId: capability.capabilityId,
      },
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
  runFixedSystemdRestart({ args: process.argv.slice(2) })
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : "OpenClaw hostd restart failed."}\n`);
      process.exitCode = 1;
    });
}
