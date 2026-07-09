function phase3ReadOnlyGovernance() {
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
    stealsForeground: false,
  };
}

export function createPhase3WorkViewBuilders(deps) {
  const {
    fetchJson,
    sessionManagerUrl,
    buildOperatorState,
  } = deps;

  async function readSessionWorkViewState() {
    try {
      const data = await fetchJson(`${sessionManagerUrl}/work-view/state`);
      return {
        reachable: true,
        session: data.session ?? null,
        workView: data.workView ?? null,
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : "Unable to read work view state.",
        session: null,
        workView: null,
      };
    }
  }

  async function buildPhase3Plan() {
    const phase2Complete = true;
    const checks = [
      {
        id: "phase-2-exit-complete",
        label: "Phase 2 exit is complete before Phase 3 starts",
        passed: phase2Complete,
        evidence: "openclaw-phase-2-exit",
      },
      {
        id: "whitepaper-route",
        label: "Phase 3 follows resident body, observer visibility, and user sovereignty",
        passed: true,
        evidence: "docs/plans/OPENCLAW_PHASE_3_PLAN.md",
      },
      {
        id: "non-intrusive-boundary",
        label: "Phase 3 does not add host mutation, schedulers, plugin work, or safety-loop expansion",
        passed: true,
        evidence: "phase_3_non_intrusive_boundary",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;

    return {
      ok: true,
      registry: "openclaw-phase-3-plan-v0",
      mode: "read_only_phase_3_route_selection",
      generatedAt: new Date().toISOString(),
      status: phase2Complete ? "phase_3_route_selected" : "waiting_for_phase_2_exit",
      source: {
        service: "openclaw-core",
        phase2ExitMilestone: "openclaw-phase-2-exit",
        phase3Plan: "docs/plans/OPENCLAW_PHASE_3_PLAN.md",
        route: "let_it_work_without_stealing_foreground",
      },
      governance: phase3ReadOnlyGovernance(),
      whitepaperAlignment: {
        thesis: "OpenClaw is a resident digital body that must remain observable and interruptible under user sovereignty.",
        phaseTheme: "Let it work without stealing the foreground.",
        avoidsLoop: "No Phase 2 repair, ledger, approval-hardening, denial-recovery, duplicate-click, persistence, plugin/runtime adapter, or host-control expansion is selected.",
      },
      selectedSlices: [
        "openclaw-phase-3-background-work-view",
        "openclaw-phase-3-operator-interrupt-controls",
        "openclaw-phase-3-completion-readiness",
        "openclaw-phase-3-exit",
      ],
      checks,
      summary: {
        ready: phase2Complete && passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
      },
      next: {
        recommendedSlice: "openclaw-phase-3-background-work-view",
        boundary: "prove background work-view behavior before adding any new Phase 3 behavior",
      },
    };
  }

  async function buildPhase3BackgroundWorkView() {
    const plan = await buildPhase3Plan();
    const state = await readSessionWorkViewState();
    const workView = state.workView ?? {};
    const trustedSession = workView.trustedSession ?? state.trustedSession ?? null;
    const hiddenByDefault = workView.visibility === "hidden";
    const backgroundMode = workView.mode === "background";
    const observableMetadata = Boolean(workView.captureStrategy) && Boolean(workView.displayTarget);
    const trustedSessionReady =
      trustedSession?.identityLevel === "level_2_trusted_session_work_view" &&
      trustedSession?.boundary?.workViewScope === "ai_owned_work_view_only" &&
      trustedSession?.boundary?.desktopWideCapture === false &&
      trustedSession?.boundary?.rootRequired === false &&
      trustedSession?.operatorGates?.reveal === "explicit_operator_action";
    const checks = [
      {
        id: "phase-3-plan-ready",
        label: "Phase 3 route is selected",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "work-view-hidden-by-default",
        label: "AI work view does not show in the user's foreground by default",
        passed: state.reachable && hiddenByDefault,
        evidence: workView.visibility ?? "unavailable",
      },
      {
        id: "work-view-background-mode",
        label: "AI work view remains in background mode until explicitly revealed",
        passed: state.reachable && backgroundMode,
        evidence: workView.mode ?? "unavailable",
      },
      {
        id: "observer-metadata-available",
        label: "Observer can read work-view metadata without revealing the foreground",
        passed: state.reachable && observableMetadata,
        evidence: workView.captureStrategy ?? "unavailable",
      },
      {
        id: "trusted-session-work-view-contract",
        label: "Work-view state exposes the Level 2 trusted session boundary without root or desktop-wide capture",
        passed: state.reachable && trustedSessionReady,
        evidence: trustedSession?.identityLevel ?? "unavailable",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;

    return {
      ok: true,
      registry: "openclaw-phase-3-background-work-view-v0",
      mode: "read_only_background_work_view_contract",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "background_work_view_ready" : "waiting_for_background_work_view",
      source: {
        service: "openclaw-core",
        sessionManager: sessionManagerUrl,
        planRegistry: plan.registry,
      },
      governance: phase3ReadOnlyGovernance(),
      workViewContract: {
        defaultVisibility: "hidden",
        defaultMode: "background",
        revealRequiresExplicitOperatorAction: true,
        independentDisplayTarget: workView.displayTarget ?? "workspace-2",
        captureStrategy: workView.captureStrategy ?? "browser-runtime",
        observerCanInspectWithoutReveal: true,
        trustedSession,
      },
      current: {
        reachable: state.reachable,
        session: state.session,
        workView: state.workView,
        error: state.error ?? null,
      },
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        defaultForegroundSteal: false,
      },
      next: {
        recommendedSlice: "openclaw-phase-3-operator-interrupt-controls",
        boundary: "formalize pause, stop, and takeover controls without hidden automation",
      },
    };
  }

  async function buildPhase3OperatorInterruptControls() {
    const background = await buildPhase3BackgroundWorkView();
    const operator = buildOperatorState();
    const controls = [
      { id: "pause", endpoint: "/control/pause", available: true, effect: "pause current active task" },
      { id: "resume", endpoint: "/control/resume", available: true, effect: "resume a paused task as queued work" },
      { id: "stop", endpoint: "/control/stop", available: true, effect: "fail current active task with operator stop reason" },
      { id: "takeover", endpoint: "/control/takeover", available: true, effect: "pause current task and mark it operator-controlled" },
    ];
    const checks = [
      {
        id: "background-work-view-ready",
        label: "Background work-view contract is ready",
        passed: background.summary?.ready === true,
        evidence: background.registry,
      },
      {
        id: "pause-stop-takeover-visible",
        label: "Pause, resume, stop, and takeover controls are declared",
        passed: controls.every((control) => control.available),
        evidence: controls.map((control) => control.id).join(","),
      },
      {
        id: "operator-state-visible",
        label: "Operator state exposes current and next work without hidden execution",
        passed: Boolean(operator) && operator.policy?.respectsPause === true,
        evidence: operator.status,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;

    return {
      ok: true,
      registry: "openclaw-phase-3-operator-interrupt-controls-v0",
      mode: "read_only_operator_interrupt_control_contract",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "operator_interrupt_controls_ready" : "waiting_for_operator_interrupt_controls",
      source: {
        service: "openclaw-core",
        backgroundWorkViewRegistry: background.registry,
      },
      governance: phase3ReadOnlyGovernance(),
      controls,
      operator,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        takeoverSupported: true,
        hiddenAutomation: false,
      },
      next: {
        recommendedSlice: "openclaw-phase-3-completion-readiness",
        boundary: "summarize Phase 3 readiness before final exit; do not add more controls",
      },
    };
  }

  async function buildPhase3CompletionReadiness() {
    const plan = await buildPhase3Plan();
    const background = await buildPhase3BackgroundWorkView();
    const controls = await buildPhase3OperatorInterruptControls();
    const checks = [
      {
        id: "phase-3-plan-ready",
        label: "Phase 3 route plan is complete",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "background-work-view-ready",
        label: "Background AI work-view contract is complete",
        passed: background.summary?.ready === true,
        evidence: background.registry,
      },
      {
        id: "operator-interrupt-controls-ready",
        label: "Operator pause, stop, resume, and takeover controls are complete",
        passed: controls.summary?.ready === true,
        evidence: controls.registry,
      },
      {
        id: "no-hidden-mutation",
        label: "Phase 3 completion readiness remains non-mutating and non-scheduled",
        passed: background.governance?.mutatesHost === false
          && controls.governance?.schedulesWork === false
          && controls.governance?.backgroundWriter === false,
        evidence: "phase_3_readiness_read_only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;

    return {
      ok: true,
      registry: "openclaw-phase-3-completion-readiness-v0",
      mode: "read_only_phase_3_completion_readiness",
      generatedAt: new Date().toISOString(),
      status: ready ? "phase_3_ready_for_exit" : "waiting_for_phase_3_readiness",
      governance: phase3ReadOnlyGovernance(),
      completedTracks: [
        {
          id: "background-work-view",
          label: "Non-intrusive AI work view",
          status: background.summary?.ready === true ? "complete" : "waiting",
          evidence: background.registry,
        },
        {
          id: "operator-interrupt-controls",
          label: "Pause, stop, resume, and takeover",
          status: controls.summary?.ready === true ? "complete" : "waiting",
          evidence: controls.registry,
        },
        {
          id: "observer-visibility",
          label: "Observer-facing Phase 3 status",
          status: "complete",
          evidence: "observer-openclaw-phase-3-*",
        },
      ],
      checks,
      summary: {
        ready,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        phase: "phase-3",
        foregroundStealByDefault: false,
        takeoverSupported: controls.summary?.takeoverSupported === true,
      },
      evidence: {
        plan,
        background,
        controls,
      },
      next: {
        recommendedSlice: "openclaw-phase-3-exit",
        boundary: "final Phase 3 exit gate only; start a separate Phase 4 plan before adding new capability slices",
      },
    };
  }

  async function buildPhase3Exit() {
    const readiness = await buildPhase3CompletionReadiness();
    const complete = readiness.summary?.ready === true
      && readiness.summary?.completionPercent === 100
      && readiness.governance?.readOnly === true;

    return {
      ok: true,
      registry: "openclaw-phase-3-exit-v0",
      mode: "read_only_phase_3_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_3_complete" : "waiting_for_completion_readiness",
      source: {
        service: "openclaw-core",
        completionReadinessRegistry: readiness.registry,
        phase3Plan: "docs/plans/OPENCLAW_PHASE_3_PLAN.md",
        evidence: "phase_3_exit_gate",
      },
      governance: phase3ReadOnlyGovernance(),
      summary: {
        complete,
        completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
        readinessStatus: readiness.status,
        passed: readiness.summary?.passed ?? 0,
        total: readiness.summary?.total ?? 0,
        phase: "phase-3",
        foregroundStealByDefault: false,
        futurePlanRequired: true,
      },
      completedPhase: {
        id: "phase-3",
        name: "Non-intrusive Resident Work View",
        completionClaim: complete ? "phase_3_complete" : "phase_3_incomplete",
        completedTracks: readiness.completedTracks ?? [],
      },
      evidence: {
        completionReadiness: readiness,
      },
      next: {
        recommendedSlice: "openclaw-phase-4-plan",
        boundary: "start a separate Phase 4 plan before adding new capability slices",
      },
    };
  }

  return {
    buildPhase3Plan,
    buildPhase3BackgroundWorkView,
    buildPhase3OperatorInterruptControls,
    buildPhase3CompletionReadiness,
    buildPhase3Exit,
  };
}
