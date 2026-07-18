import { createHash } from "node:crypto";

function receiptHash(receipt) {
  return `sha256:${createHash("sha256").update(JSON.stringify(receipt)).digest("hex")}`;
}

export function createSystemdIncidentRepairTask({
  id = "systemd-incident-source-1",
  status = "failed",
  restoredHealthy = false,
} = {}) {
  const targetUnit = "openclaw-event-hub.service";
  const receipt = {
    registry: "openclaw-systemd-repair-incident-receipt-v0",
    mode: restoredHealthy
      ? "fixed_restart_verified_healthy"
      : "fixed_restart_requires_operator_recovery",
    recordedAt: "2026-07-18T09:00:00.000Z",
    task: {
      id,
      stepId: "execute-next-systemd-restart",
      approvalId: "systemd-repair-approval-1",
    },
    target: {
      unit: targetUnit,
      healthServiceKey: "eventHub",
    },
    preHealth: {
      checkedAt: "2026-07-18T08:59:58.000Z",
      healthServiceKey: "eventHub",
      unit: {
        unit: targetUnit,
        loadState: "loaded",
        activeState: "failed",
        subState: "failed",
        mainPid: 0,
        systemdObserved: true,
      },
      service: {
        key: "eventHub",
        name: "eventHub",
        ok: false,
        status: "offline",
        url: "http://127.0.0.1:4101/private-health",
        checkedAt: "2026-07-18T08:59:58.000Z",
      },
      healthy: false,
      errors: ["private diagnostic text must not leave the host"],
    },
    journalEvidence: {
      registry: "openclaw-systemd-journal-evidence-v0",
      available: true,
      unit: targetUnit,
      requestedLines: 25,
      returned: 3,
      parseErrors: 0,
      filteredEntries: 0,
      latestEntryAt: "2026-07-18T08:59:57.000Z",
      errorCode: null,
      messagesPersisted: false,
    },
    hostdReceipt: {
      invocationId: "hostd-private-invocation",
      owner: "openclaw-hostd",
      transport: "dbus_native",
      method: "org.freedesktop.systemd1.Manager.RestartUnit",
      unit: targetUnit,
      capability: {
        operation: "restart_event_hub",
        capabilityId: "hostd.restart_event_hub",
      },
      jobPath: "/org/freedesktop/systemd1/job/72",
      beforeMainPid: 101,
      afterMainPid: 202,
      commandSucceeded: true,
      peerIdentity: {
        boundary: "kernel_so_peercred",
        verified: true,
        matched: true,
      },
    },
    postHealth: {
      checkedAt: "2026-07-18T09:00:00.000Z",
      healthServiceKey: "eventHub",
      unit: {
        unit: targetUnit,
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        mainPid: 202,
        systemdObserved: true,
      },
      service: {
        key: "eventHub",
        name: "eventHub",
        ok: restoredHealthy,
        status: restoredHealthy ? "healthy" : "offline",
        url: "http://127.0.0.1:4101/private-health",
        checkedAt: "2026-07-18T09:00:00.000Z",
      },
      healthy: restoredHealthy,
      errors: [],
    },
    restoredHealthy,
    governance: {
      fixedTarget: true,
      singleRestartAttempt: true,
      automaticRecovery: false,
      persistsJournalMessages: false,
    },
  };

  return {
    id,
    type: "systemd_next_repair_task",
    status,
    goal: "Restore the fixed event-hub service and verify application health.",
    outcome: {
      kind: status === "completed"
        ? "systemd_next_repair_execution_completed"
        : "systemd_next_repair_execution_failed",
      details: {
        incidentReceipt: {
          ...receipt,
          receiptHash: receiptHash(receipt),
        },
      },
    },
  };
}
