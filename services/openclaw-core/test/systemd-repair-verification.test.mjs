import test from "node:test";
import assert from "node:assert/strict";

import {
  createSystemdRepairVerification,
  systemdHealthServiceKeyForUnit,
} from "../src/systemd-repair-verification.mjs";

test("fixed systemd repair targets map to their application health owners", () => {
  assert.equal(systemdHealthServiceKeyForUnit("openclaw-system-sense.service"), "systemSense");
  assert.equal(systemdHealthServiceKeyForUnit("openclaw-event-hub.service"), "eventHub");
  assert.equal(systemdHealthServiceKeyForUnit("openclaw-system-heal.service"), "systemHeal");
  assert.equal(systemdHealthServiceKeyForUnit("unmanaged.service"), null);
});

test("repair verification binds bounded diagnosis, target health, and native receipt", async () => {
  let healthCalls = 0;
  const targetUnit = "openclaw-event-hub.service";
  const verificationOwner = createSystemdRepairVerification({
    systemSenseUrl: "http://127.0.0.1:4106",
    postVerificationAttempts: 3,
    postVerificationPollMs: 1,
    fetchJson: async (url) => {
      if (url.endsWith("/system/systemd/units")) {
        return {
          registry: "openclaw-systemd-unit-inventory-v0",
          units: [{
            unit: targetUnit,
            loadState: "loaded",
            activeState: "active",
            subState: "running",
            mainPid: 22,
            systemdObserved: true,
          }],
        };
      }
      if (url.includes("/system/systemd/journal-evidence?")) {
        return {
          registry: "openclaw-systemd-journal-evidence-v0",
          available: true,
          unit: targetUnit,
          requestedLines: 25,
          summary: { returned: 1, parseErrors: 0, filteredEntries: 0 },
          entries: [{ at: "2026-07-18T08:00:00.000Z", message: "secret token=must-not-persist" }],
        };
      }
      healthCalls += 1;
      const healthy = healthCalls !== 2;
      return {
        system: {
          timestamp: new Date().toISOString(),
          alerts: healthy ? [] : [{ code: "service.offline" }],
          network: { online: true, checkedTargets: 7 },
          services: {
            eventHub: { name: "eventHub", ok: healthy, status: healthy ? "healthy" : "offline" },
          },
        },
      };
    },
  });

  const before = await verificationOwner.captureSnapshot(targetUnit, "before");
  const diagnosis = await verificationOwner.captureIncidentDiagnosis({
    taskId: "repair-task-1",
    stepId: "execute-next-systemd-restart",
    targetUnit,
    before,
  });
  const after = await verificationOwner.capturePostRestartSnapshot(targetUnit, "after");
  const result = {
    ok: true,
    invocationId: "invocation-1",
    exitCode: 0,
    peerIdentity: { boundary: "kernel_so_peercred", verified: true, matched: true },
    nativeMutation: {
      owner: "openclaw-hostd",
      transport: "dbus_native",
      method: "org.freedesktop.systemd1.Manager.RestartUnit",
      unit: targetUnit,
      capability: { operation: "restart_event_hub", capabilityId: "hostd.restart_event_hub" },
      jobPath: "/org/freedesktop/systemd1/job/8",
      before: { mainPid: 11 },
      after: { mainPid: 22 },
    },
  };
  const postVerification = verificationOwner.buildPostExecutionVerification(targetUnit, before, after, result);
  const receipt = verificationOwner.buildIncidentReceipt({
    task: { id: "repair-task-1", approval: { requestId: "approval-1" } },
    stepId: "execute-next-systemd-restart",
    diagnosis,
    verification: postVerification,
    result,
  });

  assert.equal(before.targetHealthServiceKey, "eventHub");
  assert.equal(before.targetServiceHealth.key, "eventHub");
  assert.equal(after.readinessAttempts, 2);
  assert.equal(postVerification.summary.targetUnitHealthy, true);
  assert.equal(postVerification.summary.targetServiceHealthy, true);
  assert.equal(postVerification.summary.restoredHealthy, true);
  assert.equal(diagnosis.journalEvidence.returned, 1);
  assert.equal(diagnosis.journalEvidence.messagesPersisted, false);
  assert.deepEqual(receipt.task, {
    id: "repair-task-1",
    stepId: "execute-next-systemd-restart",
    approvalId: "approval-1",
  });
  assert.equal(receipt.target.healthServiceKey, "eventHub");
  assert.equal(receipt.hostdReceipt.jobPath, "/org/freedesktop/systemd1/job/8");
  assert.equal(receipt.restoredHealthy, true);
  assert.match(receipt.receiptHash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify({ diagnosis, receipt }).includes("must-not-persist"), false);
});

test("running systemd state does not count as restored application health", () => {
  const verificationOwner = createSystemdRepairVerification({
    fetchJson: async () => ({ ok: true }),
    systemSenseUrl: "http://127.0.0.1:4106",
  });
  const snapshot = {
    targetHealthServiceKey: "systemHeal",
    targetUnitState: {
      unit: "openclaw-system-heal.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      mainPid: 40,
      systemdObserved: true,
    },
    targetServiceHealth: { key: "systemHeal", ok: false, status: "offline" },
    errors: [],
  };
  const result = {
    ok: true,
    exitCode: 0,
    nativeMutation: {
      transport: "dbus_native",
      method: "org.freedesktop.systemd1.Manager.RestartUnit",
      unit: "openclaw-system-heal.service",
      before: { mainPid: 30 },
      after: { mainPid: 40 },
    },
  };

  const verification = verificationOwner.buildPostExecutionVerification(
    "openclaw-system-heal.service",
    snapshot,
    snapshot,
    result,
  );

  assert.equal(verification.summary.targetUnitHealthy, true);
  assert.equal(verification.summary.targetServiceHealthy, false);
  assert.equal(verification.summary.restoredHealthy, false);
  assert.equal(verification.mode, "recovery_recommendation_required");
});
