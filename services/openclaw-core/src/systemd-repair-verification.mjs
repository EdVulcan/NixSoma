import { createHash } from "node:crypto";

const POST_VERIFICATION_REGISTRY = "openclaw-systemd-repair-post-verification-v0";
const INCIDENT_DIAGNOSIS_REGISTRY = "openclaw-systemd-repair-incident-diagnosis-v0";
const INCIDENT_RECEIPT_REGISTRY = "openclaw-systemd-repair-incident-receipt-v0";
const JOURNAL_EVIDENCE_LINES = 25;

const HEALTH_SERVICE_KEY_BY_UNIT = new Map([
  ["openclaw-browser-runtime.service", "browserRuntime"],
  ["openclaw-system-sense.service", "systemSense"],
  ["openclaw-event-hub.service", "eventHub"],
  ["openclaw-system-heal.service", "systemHeal"],
]);

function findVerificationUnit(inventory, targetUnit) {
  return (inventory?.units ?? []).find((unit) => unit.unit === targetUnit) ?? null;
}

function compactUnitState(unit) {
  return unit
    ? {
        unit: unit.unit,
        activeState: unit.activeState ?? null,
        subState: unit.subState ?? null,
        loadState: unit.loadState ?? null,
        unitFileState: unit.unitFileState ?? null,
        mainPid: Number.isInteger(unit.mainPid) ? unit.mainPid : null,
        systemdObserved: unit.systemdObserved === true,
        observation: unit.observation ?? null,
      }
    : null;
}

function compactServiceHealth(service, healthServiceKey) {
  return service
    ? {
        key: healthServiceKey,
        name: service.name ?? healthServiceKey,
        ok: service.ok === true,
        status: service.status ?? null,
        url: service.url ?? null,
        latencyMs: service.latencyMs ?? null,
        checkedAt: service.checkedAt ?? null,
      }
    : null;
}

function unitStateHealthy(unit) {
  return unit?.systemdObserved === true
    && unit.loadState === "loaded"
    && unit.activeState === "active"
    && unit.subState === "running";
}

function snapshotHealthy(snapshot) {
  return unitStateHealthy(snapshot?.targetUnitState)
    && snapshot?.targetServiceHealth?.ok === true;
}

function compactJournalEvidence(journal, targetUnit) {
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  return {
    registry: journal?.registry ?? null,
    available: journal?.available === true,
    unit: journal?.unit ?? targetUnit,
    requestedLines: Number.isInteger(journal?.requestedLines) ? journal.requestedLines : JOURNAL_EVIDENCE_LINES,
    returned: Number.isInteger(journal?.summary?.returned) ? journal.summary.returned : entries.length,
    parseErrors: Number.isInteger(journal?.summary?.parseErrors) ? journal.summary.parseErrors : 0,
    filteredEntries: Number.isInteger(journal?.summary?.filteredEntries) ? journal.summary.filteredEntries : 0,
    latestEntryAt: entries[0]?.at ?? null,
    errorCode: journal?.error?.code ?? null,
    messagesPersisted: false,
  };
}

function compactHealthEvidence(snapshot) {
  return {
    checkedAt: snapshot?.checkedAt ?? null,
    healthServiceKey: snapshot?.targetHealthServiceKey ?? null,
    unit: snapshot?.targetUnitState ?? null,
    service: snapshot?.targetServiceHealth ?? null,
    healthy: snapshotHealthy(snapshot),
    errors: Array.isArray(snapshot?.errors) ? snapshot.errors : [],
  };
}

function hashReceipt(receipt) {
  return `sha256:${createHash("sha256").update(JSON.stringify(receipt)).digest("hex")}`;
}

export function systemdHealthServiceKeyForUnit(targetUnit) {
  return HEALTH_SERVICE_KEY_BY_UNIT.get(targetUnit) ?? null;
}

export function createSystemdRepairVerification({
  fetchJson,
  systemSenseUrl,
  postVerificationAttempts = 30,
  postVerificationPollMs = 100,
}) {
  async function captureSnapshot(targetUnit, stage) {
    const checkedAt = new Date().toISOString();
    const healthServiceKey = systemdHealthServiceKeyForUnit(targetUnit);
    const snapshot = {
      stage,
      checkedAt,
      targetUnit,
      targetHealthServiceKey: healthServiceKey,
      unitInventory: null,
      targetUnitState: null,
      systemHealth: null,
      targetServiceHealth: null,
      errors: [],
    };

    if (!healthServiceKey) {
      snapshot.errors.push("target_health_service_mapping_not_found");
    }

    try {
      const inventory = await fetchJson(`${systemSenseUrl}/system/systemd/units`);
      const unit = findVerificationUnit(inventory, targetUnit);
      snapshot.unitInventory = {
        registry: inventory.registry ?? null,
        observedAt: inventory.observedAt ?? null,
        systemdAvailable: inventory.source?.systemdAvailable ?? null,
        summary: inventory.summary ?? null,
      };
      snapshot.targetUnitState = compactUnitState(unit);
      if (!unit) {
        snapshot.errors.push("target_unit_not_found_in_inventory");
      }
    } catch (error) {
      snapshot.errors.push(`unit_inventory_unavailable:${error instanceof Error ? error.message : "unknown"}`);
    }

    try {
      const health = await fetchJson(`${systemSenseUrl}/system/health`);
      const service = healthServiceKey ? health.system?.services?.[healthServiceKey] ?? null : null;
      snapshot.systemHealth = {
        timestamp: health.system?.timestamp ?? null,
        alertCount: Array.isArray(health.system?.alerts) ? health.system.alerts.length : 0,
        online: health.system?.network?.online ?? null,
        checkedTargets: health.system?.network?.checkedTargets ?? null,
      };
      snapshot.targetServiceHealth = compactServiceHealth(service, healthServiceKey);
      if (healthServiceKey && !service) {
        snapshot.errors.push(`target_service_health_not_found:${healthServiceKey}`);
      }
    } catch (error) {
      snapshot.errors.push(`system_health_unavailable:${error instanceof Error ? error.message : "unknown"}`);
    }

    return snapshot;
  }

  async function capturePostRestartSnapshot(targetUnit, stage) {
    let snapshot;
    for (let attempt = 1; attempt <= postVerificationAttempts; attempt += 1) {
      snapshot = await captureSnapshot(targetUnit, stage);
      if (snapshotHealthy(snapshot)) {
        return { ...snapshot, readinessAttempts: attempt };
      }
      if (attempt < postVerificationAttempts) {
        await new Promise((resolve) => setTimeout(resolve, postVerificationPollMs));
      }
    }
    return { ...snapshot, readinessAttempts: postVerificationAttempts };
  }

  async function captureIncidentDiagnosis({ taskId, stepId, targetUnit, before }) {
    let journal;
    try {
      const journalUrl = new URL("/system/systemd/journal-evidence", `${systemSenseUrl}/`);
      journalUrl.searchParams.set("unit", targetUnit);
      journalUrl.searchParams.set("lines", String(JOURNAL_EVIDENCE_LINES));
      journal = await fetchJson(journalUrl.toString());
    } catch {
      journal = {
        registry: "openclaw-systemd-journal-evidence-v0",
        available: false,
        unit: targetUnit,
        requestedLines: JOURNAL_EVIDENCE_LINES,
        summary: { returned: 0, parseErrors: 0, filteredEntries: 0 },
        entries: [],
        error: { code: "JOURNAL_EVIDENCE_UNAVAILABLE" },
      };
    }

    const preHealth = compactHealthEvidence(before);
    return {
      registry: INCIDENT_DIAGNOSIS_REGISTRY,
      mode: "bounded_pre_repair_diagnosis",
      capturedAt: new Date().toISOString(),
      task: { id: taskId, stepId },
      target: {
        unit: targetUnit,
        healthServiceKey: before?.targetHealthServiceKey ?? systemdHealthServiceKeyForUnit(targetUnit),
      },
      preHealth,
      journalEvidence: compactJournalEvidence(journal, targetUnit),
      assessment: {
        unitHealthy: unitStateHealthy(before?.targetUnitState),
        serviceHealthy: before?.targetServiceHealth?.ok === true,
        preRepairHealthy: preHealth.healthy,
        boundedDiagnosisOnly: true,
      },
      governance: {
        hostMutation: false,
        authorizesRepair: false,
        triggersRepair: false,
        persistsJournalMessages: false,
      },
    };
  }

  function buildPostExecutionVerification(targetUnit, before, after, result) {
    const targetUnitHealthy = unitStateHealthy(after.targetUnitState);
    const targetServiceHealthy = after.targetServiceHealth?.ok === true;
    const targetHealthy = targetUnitHealthy && targetServiceHealthy;
    const nativeMutationVerified = result.ok === true
      && result.nativeMutation?.transport === "dbus_native"
      && result.nativeMutation?.method === "org.freedesktop.systemd1.Manager.RestartUnit"
      && result.nativeMutation?.unit === targetUnit
      && Number.isInteger(result.nativeMutation?.before?.mainPid)
      && Number.isInteger(result.nativeMutation?.after?.mainPid)
      && result.nativeMutation.before.mainPid !== result.nativeMutation.after.mainPid;
    const restoredHealthy = targetHealthy && nativeMutationVerified;
    return {
      registry: POST_VERIFICATION_REGISTRY,
      mode: restoredHealthy ? "native_restart_restored_health" : "recovery_recommendation_required",
      targetUnit,
      targetHealthServiceKey: after.targetHealthServiceKey ?? before.targetHealthServiceKey ?? null,
      checkedAt: new Date().toISOString(),
      commandExitCode: result.exitCode,
      commandSucceeded: result.ok === true,
      before,
      after,
      summary: {
        unitObservedBefore: before.targetUnitState?.systemdObserved === true,
        unitObservedAfter: after.targetUnitState?.systemdObserved === true,
        beforeActiveState: before.targetUnitState?.activeState ?? null,
        afterActiveState: after.targetUnitState?.activeState ?? null,
        afterSubState: after.targetUnitState?.subState ?? null,
        afterMainPid: after.targetUnitState?.mainPid ?? null,
        beforeServiceOk: before.targetServiceHealth?.ok ?? null,
        afterServiceOk: after.targetServiceHealth?.ok ?? null,
        errorCount: before.errors.length + after.errors.length,
        targetUnitHealthy,
        targetServiceHealthy,
        targetHealthy,
        nativeMutationVerified,
        restoredHealthy,
        noAutomaticRecovery: true,
      },
      recoveryRecommendation: restoredHealthy
        ? null
        : {
            strategy: "inspect_unit_and_restore_declarative_generation",
            targetUnit,
            automaticRestart: false,
            requiresOperatorReview: true,
          },
      governance: {
        recordsEvidenceOnly: true,
        triggersRecovery: false,
        retriesExecution: false,
        schedulesFollowUp: false,
      },
    };
  }

  function buildIncidentReceipt({ task, stepId, diagnosis, verification, result }) {
    const receipt = {
      registry: INCIDENT_RECEIPT_REGISTRY,
      mode: verification.summary.restoredHealthy
        ? "fixed_restart_verified_healthy"
        : "fixed_restart_requires_operator_recovery",
      recordedAt: new Date().toISOString(),
      task: {
        id: task.id,
        stepId,
        approvalId: task.approval?.requestId ?? task.approval?.id ?? null,
      },
      target: {
        unit: verification.targetUnit,
        healthServiceKey: verification.targetHealthServiceKey,
      },
      preHealth: diagnosis.preHealth,
      journalEvidence: diagnosis.journalEvidence,
      hostdReceipt: {
        invocationId: result.invocationId ?? null,
        owner: result.nativeMutation?.owner ?? null,
        transport: result.nativeMutation?.transport ?? null,
        method: result.nativeMutation?.method ?? null,
        unit: result.nativeMutation?.unit ?? verification.targetUnit,
        capability: result.nativeMutation?.capability ?? null,
        jobPath: result.nativeMutation?.jobPath ?? null,
        beforeMainPid: result.nativeMutation?.before?.mainPid ?? null,
        afterMainPid: result.nativeMutation?.after?.mainPid ?? null,
        commandSucceeded: result.ok === true,
        peerIdentity: result.peerIdentity ?? null,
      },
      postHealth: compactHealthEvidence(verification.after),
      restoredHealthy: verification.summary.restoredHealthy === true,
      governance: {
        fixedTarget: true,
        singleRestartAttempt: true,
        automaticRecovery: false,
        persistsJournalMessages: false,
      },
    };
    return { ...receipt, receiptHash: hashReceipt(receipt) };
  }

  return {
    captureSnapshot,
    capturePostRestartSnapshot,
    captureIncidentDiagnosis,
    buildPostExecutionVerification,
    buildIncidentReceipt,
  };
}

export {
  INCIDENT_DIAGNOSIS_REGISTRY,
  INCIDENT_RECEIPT_REGISTRY,
  POST_VERIFICATION_REGISTRY,
};
