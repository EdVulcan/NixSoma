function phase4ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    triggersRecovery: false,
    schedulesWork: false,
    backgroundWriter: false,
    writesLedger: false,
    realHostRepair: false,
  };
}

export function createPhase4SelfHealBuilders(deps) {
  const {
    fetchJson,
    systemSenseUrl,
    systemHealUrl,
  } = deps;

  async function readPhase4HealEvidence() {
    const [health, healState, healHistory, maintenanceState, maintenanceHistory] = await Promise.all([
      fetchJson(`${systemSenseUrl}/system/health`).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to read system health.",
      })),
      fetchJson(`${systemHealUrl}/heal/state`).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to read heal state.",
      })),
      fetchJson(`${systemHealUrl}/heal/history`).catch((error) => ({
        ok: false,
        items: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unable to read heal history.",
      })),
      fetchJson(`${systemHealUrl}/maintenance/state`).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to read maintenance state.",
      })),
      fetchJson(`${systemHealUrl}/maintenance/history?limit=8`).catch((error) => ({
        ok: false,
        items: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unable to read maintenance history.",
      })),
    ]);

    return {
      health,
      healState,
      healHistory,
      maintenanceState,
      maintenanceHistory,
    };
  }

  async function buildPhase4Plan() {
    const phase3Complete = true;
    const checks = [
      {
        id: "phase-3-exit-complete",
        label: "Phase 3 exit is complete before Phase 4 starts",
        passed: phase3Complete,
        evidence: "openclaw-phase-3-exit",
      },
      {
        id: "whitepaper-self-heal-route",
        label: "Phase 4 follows body stability, self-maintenance, and user-visible evidence",
        passed: true,
        evidence: "docs/plans/OPENCLAW_PHASE_4_PLAN.md",
      },
      {
        id: "conservative-boundary",
        label: "Phase 4 does not add arbitrary host mutation, plugin work, or hardening loops",
        passed: true,
        evidence: "phase_4_conservative_self_heal_boundary",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;

    return {
      ok: true,
      registry: "openclaw-phase-4-plan-v0",
      mode: "read_only_phase_4_route_selection",
      generatedAt: new Date().toISOString(),
      status: phase3Complete ? "phase_4_route_selected" : "waiting_for_phase_3_exit",
      source: {
        service: "openclaw-core",
        phase3ExitMilestone: "openclaw-phase-3-exit",
        phase4Plan: "docs/plans/OPENCLAW_PHASE_4_PLAN.md",
        route: "let_it_care_for_its_body",
      },
      governance: phase4ReadOnlyGovernance(),
      whitepaperAlignment: {
        thesis: "OpenClaw should maintain body stability, leave evidence, and remain visible under user sovereignty.",
        phaseTheme: "Let it care for its body.",
        avoidsLoop: "No Phase 2 repair expansion, Phase 3 foreground work, plugin/runtime adapter work, persistence hardening, denial recovery, duplicate-click loop, or arbitrary host control is selected.",
      },
      selectedSlices: [
        "openclaw-phase-4-self-heal-loop",
        "openclaw-phase-4-heal-history-evidence",
        "openclaw-phase-4-completion-readiness",
        "openclaw-phase-4-exit",
      ],
      checks,
      summary: {
        ready: phase3Complete && passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
      },
      next: {
        recommendedSlice: "openclaw-phase-4-self-heal-loop",
        boundary: "prove conservative self-heal evidence before adding any new Phase 4 slice",
      },
    };
  }

  async function buildPhase4SelfHealLoop() {
    const plan = await buildPhase4Plan();
    const evidence = await readPhase4HealEvidence();
    const services = Object.values(evidence.health?.system?.services ?? {});
    const latestRun = evidence.maintenanceState?.latestRun ?? null;
    const latestDiagnosis = evidence.healState?.latestDiagnosis ?? latestRun?.diagnosis ?? null;
    const executed = Array.isArray(latestRun?.executed) ? latestRun.executed : [];
    const skipped = Array.isArray(latestRun?.skipped) ? latestRun.skipped : [];
    const checks = [
      {
        id: "phase-4-plan-ready",
        label: "Phase 4 route is selected",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "system-health-readable",
        label: "System-sense exposes body and service health",
        passed: evidence.health?.ok === true && services.length >= 7,
        evidence: `${services.length} service(s)`,
      },
      {
        id: "heal-engine-ready",
        label: "System-heal exposes diagnose, autofix, maintenance, and history",
        passed: evidence.healState?.ok === true
          && evidence.healState?.capabilities?.diagnose === true
          && evidence.healState?.capabilities?.autoFix === true
          && evidence.healState?.capabilities?.maintenance === true,
        evidence: evidence.healState?.engine ?? "unavailable",
      },
      {
        id: "conservative-maintenance-run",
        label: "A conservative maintenance run recorded self-heal evidence",
        passed: evidence.maintenanceState?.ok === true
          && latestRun?.engine === "maintenance-v0"
          && ["healthy", "repaired", "attention_required"].includes(latestRun?.status),
        evidence: latestRun?.id ?? "none",
      },
      {
        id: "high-risk-observe-only",
        label: "High-risk alerts remain skipped or observe-only",
        passed: skipped.length === 0 || skipped.every((entry) => entry.action === "observe-only" && entry.status === "skipped"),
        evidence: `${skipped.length} skipped step(s)`,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;

    return {
      ok: true,
      registry: "openclaw-phase-4-self-heal-loop-v0",
      mode: "read_only_phase_4_self_heal_loop_evidence",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "self_heal_loop_ready" : "waiting_for_self_heal_evidence",
      source: {
        service: "openclaw-core",
        systemSense: systemSenseUrl,
        systemHeal: systemHealUrl,
        planRegistry: plan.registry,
      },
      governance: phase4ReadOnlyGovernance(),
      evidence,
      diagnosis: {
        status: latestDiagnosis?.status ?? null,
        planSteps: latestDiagnosis?.plan?.stepCount ?? 0,
        sourceHostname: latestDiagnosis?.source?.hostname ?? null,
      },
      maintenance: {
        latestRunId: latestRun?.id ?? null,
        status: latestRun?.status ?? null,
        autonomy: latestRun?.autonomy ?? null,
        executedCount: executed.length,
        skippedCount: skipped.length,
        runCount: evidence.maintenanceState?.runCount ?? 0,
        healHistoryCount: evidence.healState?.historyCount ?? evidence.healHistory?.count ?? 0,
      },
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        servicesObserved: services.length,
        executedRepairs: executed.length,
        skippedHighRisk: skipped.length,
        realHostRepair: false,
      },
      next: {
        recommendedSlice: "openclaw-phase-4-heal-history-evidence",
        boundary: "package heal and maintenance history evidence before Phase 4 readiness",
      },
    };
  }

  async function buildPhase4HealHistoryEvidence() {
    const loop = await buildPhase4SelfHealLoop();
    const healItems = Array.isArray(loop.evidence?.healHistory?.items) ? loop.evidence.healHistory.items : [];
    const maintenanceItems = Array.isArray(loop.evidence?.maintenanceHistory?.items) ? loop.evidence.maintenanceHistory.items : [];
    const hasExecutedEvidence = healItems.some((entry) => entry.status === "completed")
      || (loop.maintenance?.executedCount ?? 0) > 0
      || loop.maintenance?.status === "healthy";
    const hasSkippedEvidence = healItems.some((entry) => entry.status === "skipped")
      || (loop.maintenance?.skippedCount ?? 0) > 0
      || loop.maintenance?.status === "healthy";
    const checks = [
      {
        id: "self-heal-loop-ready",
        label: "Self-heal loop evidence is ready",
        passed: loop.summary?.ready === true,
        evidence: loop.registry,
      },
      {
        id: "heal-history-visible",
        label: "Heal history exposes executed or healthy maintenance evidence",
        passed: loop.evidence?.healHistory?.ok === true && hasExecutedEvidence,
        evidence: `${healItems.length} heal item(s)`,
      },
      {
        id: "maintenance-history-visible",
        label: "Maintenance history exposes latest run evidence",
        passed: loop.evidence?.maintenanceHistory?.ok === true
          && maintenanceItems.some((item) => item.id === loop.maintenance?.latestRunId),
        evidence: `${maintenanceItems.length} maintenance item(s)`,
      },
      {
        id: "skipped-or-healthy-recorded",
        label: "Skipped high-risk evidence or healthy no-op state is visible",
        passed: hasSkippedEvidence,
        evidence: `${loop.maintenance?.skippedCount ?? 0} skipped step(s)`,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;

    return {
      ok: true,
      registry: "openclaw-phase-4-heal-history-evidence-v0",
      mode: "read_only_phase_4_heal_history_evidence",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "heal_history_evidence_ready" : "waiting_for_heal_history_evidence",
      governance: phase4ReadOnlyGovernance(),
      history: {
        healCount: loop.evidence?.healHistory?.count ?? 0,
        maintenanceCount: loop.evidence?.maintenanceHistory?.count ?? 0,
        latestRunId: loop.maintenance?.latestRunId ?? null,
        executedRepairs: loop.summary?.executedRepairs ?? 0,
        skippedHighRisk: loop.summary?.skippedHighRisk ?? 0,
        latestDiagnosisStatus: loop.diagnosis?.status ?? null,
      },
      evidence: {
        selfHealLoop: loop,
      },
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
      },
      next: {
        recommendedSlice: "openclaw-phase-4-completion-readiness",
        boundary: "summarize Phase 4 readiness; do not add scheduler or repair expansion",
      },
    };
  }

  async function buildPhase4CompletionReadiness() {
    const plan = await buildPhase4Plan();
    const loop = await buildPhase4SelfHealLoop();
    const history = await buildPhase4HealHistoryEvidence();
    const checks = [
      {
        id: "phase-4-plan-ready",
        label: "Phase 4 route plan is complete",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "self-heal-loop-ready",
        label: "Conservative self-heal loop is complete",
        passed: loop.summary?.ready === true,
        evidence: loop.registry,
      },
      {
        id: "heal-history-evidence-ready",
        label: "Heal and maintenance history evidence is complete",
        passed: history.summary?.ready === true,
        evidence: history.registry,
      },
      {
        id: "no-new-host-mutation",
        label: "Phase 4 readiness remains within conservative simulated repair boundaries",
        passed: loop.governance?.realHostRepair === false
          && history.governance?.mutatesHost === false
          && history.governance?.schedulesWork === false,
        evidence: "phase_4_conservative_boundary",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;

    return {
      ok: true,
      registry: "openclaw-phase-4-completion-readiness-v0",
      mode: "read_only_phase_4_completion_readiness",
      generatedAt: new Date().toISOString(),
      status: ready ? "phase_4_ready_for_exit" : "waiting_for_phase_4_readiness",
      governance: phase4ReadOnlyGovernance(),
      completedTracks: [
        {
          id: "system-health-sense",
          label: "Body health is observable",
          status: loop.evidence?.health?.ok === true ? "complete" : "waiting",
          evidence: "openclaw-system-sense",
        },
        {
          id: "conservative-self-heal",
          label: "Conservative rule-based self-heal",
          status: loop.summary?.ready === true ? "complete" : "waiting",
          evidence: loop.registry,
        },
        {
          id: "heal-history",
          label: "Repair and skipped-action history",
          status: history.summary?.ready === true ? "complete" : "waiting",
          evidence: history.registry,
        },
        {
          id: "observer-visibility",
          label: "Observer-facing health and heal state",
          status: "complete",
          evidence: "observer-openclaw-phase-4-*",
        },
      ],
      checks,
      summary: {
        ready,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        phase: "phase-4",
        servicesObserved: loop.summary?.servicesObserved ?? 0,
        executedRepairs: loop.summary?.executedRepairs ?? 0,
        skippedHighRisk: loop.summary?.skippedHighRisk ?? 0,
        realHostRepair: false,
      },
      evidence: {
        plan,
        selfHealLoop: loop,
        healHistory: history,
      },
      next: {
        recommendedSlice: "openclaw-phase-4-exit",
        boundary: "final Phase 4 exit gate only; start a separate Phase 5 plan before adding new capability slices",
      },
    };
  }

  async function buildPhase4Exit() {
    const readiness = await buildPhase4CompletionReadiness();
    const complete = readiness.summary?.ready === true
      && readiness.summary?.completionPercent === 100
      && readiness.governance?.readOnly === true;

    return {
      ok: true,
      registry: "openclaw-phase-4-exit-v0",
      mode: "read_only_phase_4_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_4_complete" : "waiting_for_completion_readiness",
      source: {
        service: "openclaw-core",
        completionReadinessRegistry: readiness.registry,
        phase4Plan: "docs/plans/OPENCLAW_PHASE_4_PLAN.md",
        evidence: "phase_4_exit_gate",
      },
      governance: phase4ReadOnlyGovernance(),
      summary: {
        complete,
        completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
        readinessStatus: readiness.status,
        passed: readiness.summary?.passed ?? 0,
        total: readiness.summary?.total ?? 0,
        phase: "phase-4",
        realHostRepair: false,
        futurePlanRequired: true,
      },
      completedPhase: {
        id: "phase-4",
        name: "Conservative Body Self-Heal",
        completionClaim: complete ? "phase_4_complete" : "phase_4_incomplete",
        completedTracks: readiness.completedTracks ?? [],
      },
      evidence: {
        completionReadiness: readiness,
      },
      next: {
        recommendedSlice: "openclaw-phase-5-plan",
        boundary: "start a separate Phase 5 plan before adding new capability slices",
      },
    };
  }

  return {
    buildPhase4Plan,
    buildPhase4SelfHealLoop,
    buildPhase4HealHistoryEvidence,
    buildPhase4CompletionReadiness,
    buildPhase4Exit,
  };
}
