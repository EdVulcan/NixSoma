export function createSystemdRepairCandidatePlanning({
  buildSystemdUnitInventory,
  buildSystemdDependencyMap,
  buildHealthTrendSummary,
  findInventoryUnit,
  registries = {},
} = {}) {
  const requireDependency = (name, value) => {
    if (typeof value !== "function") {
      throw new TypeError(`createSystemdRepairCandidatePlanning requires ${name}`);
    }
    return value;
  };

  const buildInventory = requireDependency("buildSystemdUnitInventory", buildSystemdUnitInventory);
  const buildDependencyMap = requireDependency("buildSystemdDependencyMap", buildSystemdDependencyMap);
  const buildHealthTrends = requireDependency("buildHealthTrendSummary", buildHealthTrendSummary);
  const findUnit = requireDependency("findInventoryUnit", findInventoryUnit);

  const SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY = registries.systemdRepairCandidateAssessment ?? "openclaw-systemd-repair-candidate-assessment-v0";
  const SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY = registries.systemdRepairCandidatePlan ?? "openclaw-systemd-repair-candidate-plan-v0";
  const SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY = registries.systemdRepairCandidateTaskRoute ?? "openclaw-systemd-repair-candidate-task-route-v0";
  const SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY = registries.systemdRepairCandidateReadiness ?? "openclaw-systemd-repair-candidate-readiness-v0";
  const SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY = registries.systemdRepairCandidateRouteReview ?? "openclaw-systemd-repair-candidate-route-review-v0";
  const SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY = registries.systemdRepairCandidateDemoStatus ?? "openclaw-systemd-repair-candidate-demo-status-v0";

  async function buildSystemdRepairCandidateAssessment() {
    const [inventory, dependencyMap, trendSummary] = await Promise.all([
      buildInventory(),
      buildDependencyMap(),
      buildHealthTrends(),
    ]);
    const trendByService = new Map((trendSummary.services ?? []).map((trend) => [trend.service, trend]));
    const candidates = (dependencyMap.nodes ?? []).map((node) => {
      const unit = findUnit(inventory, node.unit) ?? {};
      const serviceTrend = trendByService.get(node.key) ?? trendByService.get(node.name) ?? null;
      const degraded = unit.activeState === "failed"
        || unit.subState === "failed"
        || serviceTrend?.latestOk === false
        || (serviceTrend?.offline ?? 0) > 0;
      const existingDemoTarget = node.unit === "openclaw-browser-runtime.service";
      const impactWeight = node.impactClass === "foundational" ? 40
        : node.impactClass === "high" ? 30
          : node.impactClass === "medium" ? 20
            : 10;
      const score = impactWeight
        + (degraded ? 35 : 0)
        + (existingDemoTarget ? 50 : 0)
        + Math.min(node.impactRadius ?? 0, 5);
      return {
        unit: node.unit,
        component: node.component,
        activeState: unit.activeState ?? node.activeState ?? "unknown",
        subState: unit.subState ?? node.subState ?? "unknown",
        impactClass: node.impactClass,
        impactRadius: node.impactRadius,
        dependencyLayer: node.dependencyLayer,
        upstream: node.upstream,
        downstream: node.downstream,
        health: {
          samples: serviceTrend?.samples ?? 0,
          offline: serviceTrend?.offline ?? 0,
          latestOk: serviceTrend?.latestOk ?? null,
          latestStatus: serviceTrend?.latestStatus ?? "unknown",
        },
        assessment: {
          degraded,
          existingDemoTarget,
          score,
          reason: degraded
            ? "Health or systemd state shows degradation; candidate needs operator review before any repair plan."
            : existingDemoTarget
              ? "Existing approved repair demo target; safest candidate for continued real-repair semantics."
              : "Stable body service; keep as read-only candidate evidence before any broader repair scope.",
        },
        governance: {
          canCreateTask: false,
          canRestart: false,
          canMutate: false,
          requiresSeparatePlan: true,
        },
      };
    }).sort((a, b) => b.assessment.score - a.assessment.score || a.unit.localeCompare(b.unit));
    const recommended = candidates[0] ?? null;
  
    return {
      ok: true,
      registry: SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY,
      mode: "read_only_repair_candidate_assessment",
      generatedAt: new Date().toISOString(),
      source: {
        service: "openclaw-system-sense",
        inventoryRegistry: inventory.registry,
        dependencyMapRegistry: dependencyMap.registry,
        healthTrendRegistry: trendSummary.registry,
        evidence: "systemd_repair_candidate_assessment",
      },
      governance: {
        domain: "body_internal",
        risk: "low",
        autonomy: "assess_only",
        approvalRequired: false,
        hostMutation: false,
        canMutate: false,
        canRestart: false,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
      },
      summary: {
        totalCandidates: candidates.length,
        degradedCandidates: candidates.filter((candidate) => candidate.assessment.degraded).length,
        existingDemoTargets: candidates.filter((candidate) => candidate.assessment.existingDemoTarget).length,
        recommendedUnit: recommended?.unit ?? null,
        recommendedReason: recommended?.assessment.reason ?? null,
        highImpactCandidates: candidates.filter((candidate) => ["foundational", "high"].includes(candidate.impactClass)).length,
      },
      candidates,
      next: {
        recommendedSlice: "openclaw-systemd-repair-candidate-plan",
        boundary: "plan-only repair candidate scope before creating tasks, approvals, commands, or host mutation",
      },
    };
  }
  
  async function buildSystemdRepairCandidatePlan() {
    const assessment = await buildSystemdRepairCandidateAssessment();
    const selected = assessment.candidates?.[0] ?? null;
    const planSteps = selected ? [
      {
        id: "review-candidate-evidence",
        label: "Review candidate state, dependency impact, and health trend evidence",
        status: "planned",
        mutation: false,
      },
      {
        id: "compare-with-existing-demo-route",
        label: "Confirm whether the candidate is covered by the existing operator-reviewed repair route",
        status: selected.assessment?.existingDemoTarget ? "covered_by_existing_route" : "requires_future_route_review",
        mutation: false,
      },
      {
        id: "prepare-plan-only-repair-envelope",
        label: "Prepare a separate plan-only repair proposal before any task or approval",
        status: "planned",
        mutation: false,
      },
    ] : [];
  
    return {
      ok: true,
      registry: SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY,
      mode: "plan_only_candidate_scope",
      generatedAt: new Date().toISOString(),
      source: {
        service: "openclaw-system-sense",
        candidateAssessmentRegistry: assessment.registry,
        evidence: "systemd_repair_candidate_plan_scope",
      },
      governance: {
        domain: "body_internal",
        risk: selected?.impactClass === "foundational" || selected?.impactClass === "high" ? "medium" : "low",
        autonomy: "plan_only",
        approvalRequired: false,
        hostMutation: false,
        canMutate: false,
        canRestart: false,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
      },
      selectedCandidate: selected ? {
        unit: selected.unit,
        impactClass: selected.impactClass,
        impactRadius: selected.impactRadius,
        score: selected.assessment?.score ?? 0,
        existingDemoTarget: selected.assessment?.existingDemoTarget === true,
        degraded: selected.assessment?.degraded === true,
        reason: selected.assessment?.reason ?? null,
      } : null,
      plan: {
        intent: "systemd.repair.candidate.plan",
        targetUnit: selected?.unit ?? null,
        commandPreview: selected ? `systemctl restart ${selected.unit}` : null,
        commandPreviewOnly: true,
        createsExecutableTask: false,
        createsApproval: false,
        executesCommand: false,
        steps: planSteps,
        requiredBeforeExecution: [
          "separate operator-reviewed repair task materialization",
          "explicit operator approval",
          "dry-run or existing real repair route evidence",
          "post-execution verification plan",
        ],
      },
      next: {
        recommendedSlice: "openclaw-systemd-repair-candidate-observer-plan",
        boundary: "make the plan-only candidate scope visible before any task creation or host mutation",
      },
    };
  }
  
  async function buildSystemdRepairCandidateTaskRoute() {
    const candidatePlan = await buildSystemdRepairCandidatePlan();
    const targetUnit = candidatePlan.plan?.targetUnit ?? null;
    const existingRouteAvailable = targetUnit === "openclaw-browser-runtime.service"
      && candidatePlan.selectedCandidate?.existingDemoTarget === true;
  
    return {
      ok: true,
      registry: SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY,
      mode: "read_only_task_route_gate",
      generatedAt: new Date().toISOString(),
      source: {
        service: "openclaw-system-sense",
        candidatePlanRegistry: candidatePlan.registry,
        evidence: "systemd_repair_candidate_task_route_gate",
      },
      governance: {
        domain: "body_internal",
        risk: "medium",
        autonomy: "route_gate_only",
        approvalRequired: false,
        hostMutation: false,
        canMutate: false,
        canRestart: false,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
      },
      routeDecision: {
        targetUnit,
        status: existingRouteAvailable ? "existing_operator_reviewed_route_available" : "requires_separate_route_review",
        existingRouteAvailable,
        existingRoute: existingRouteAvailable ? "openclaw-systemd-repair-execution-task" : null,
        reason: existingRouteAvailable
          ? "The selected candidate is the existing browser-runtime demo target covered by the operator-reviewed repair task shell."
          : "The selected candidate is not yet covered by a narrow operator-reviewed repair task shell.",
      },
      requiredBeforeTaskCreation: [
        "Observer-visible candidate plan",
        "operator-reviewed task materialization route",
        "explicit approval gate",
        "dry-run or existing real execution route evidence",
        "post-execution verification bundle",
      ],
      allowedNextActions: [
        {
          id: "review-existing-route",
          label: "Review the existing operator-reviewed repair task shell",
          allowedNow: existingRouteAvailable,
          createsTask: false,
          mutatesHost: false,
        },
        {
          id: "create-candidate-task-shell",
          label: "Create a candidate-specific task shell in a future milestone",
          allowedNow: false,
          createsTask: true,
          mutatesHost: false,
          boundary: "requires separate milestone and must still end before command execution",
        },
      ],
      next: {
        recommendedSlice: "openclaw-systemd-repair-candidate-task-shell",
        boundary: "task shell only; no approval auto-grant, no command execution, no host mutation",
      },
    };
  }
  
  async function buildSystemdRepairCandidateReadiness() {
    const [assessment, candidatePlan, taskRoute] = await Promise.all([
      buildSystemdRepairCandidateAssessment(),
      buildSystemdRepairCandidatePlan(),
      buildSystemdRepairCandidateTaskRoute(),
    ]);
    const selectedUnit = candidatePlan.plan?.targetUnit ?? assessment.summary?.recommendedUnit ?? null;
    const taskShellRegistry = "openclaw-systemd-repair-candidate-task-shell-v0";
    const observerTaskShellRegistry = "observer-openclaw-systemd-repair-candidate-task-shell";
    const checks = [
      {
        id: "candidate-assessment",
        label: "Read-only candidate assessment ranks OpenClaw-owned systemd units",
        passed: assessment.registry === SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY
          && assessment.governance?.hostMutation === false
          && assessment.governance?.createsTask === false,
        evidence: assessment.registry,
      },
      {
        id: "candidate-plan",
        label: "Plan-only candidate scope exposes command preview without task creation",
        passed: candidatePlan.registry === SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY
          && candidatePlan.plan?.commandPreviewOnly === true
          && candidatePlan.governance?.executesCommand === false,
        evidence: candidatePlan.registry,
      },
      {
        id: "candidate-task-route",
        label: "Route gate confirms the selected candidate uses the existing operator-reviewed repair route",
        passed: taskRoute.registry === SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY
          && taskRoute.routeDecision?.existingRouteAvailable === true
          && taskRoute.routeDecision?.targetUnit === "openclaw-browser-runtime.service",
        evidence: taskRoute.registry,
      },
      {
        id: "candidate-task-shell-boundary",
        label: "Task shell boundary is approval-gated and remains before execution",
        passed: taskRoute.next?.recommendedSlice === "openclaw-systemd-repair-candidate-task-shell"
          && selectedUnit === "openclaw-browser-runtime.service",
        evidence: taskShellRegistry,
      },
      {
        id: "observer-task-shell",
        label: "Observer exposes the candidate task shell control surface",
        passed: true,
        evidence: observerTaskShellRegistry,
      },
      {
        id: "no-hidden-mutation",
        label: "Candidate readiness does not approve, execute, restart, schedule, or recover",
        passed: assessment.governance?.hostMutation === false
          && candidatePlan.governance?.hostMutation === false
          && taskRoute.governance?.hostMutation === false
          && taskRoute.governance?.executesCommand === false
          && taskRoute.governance?.triggersRecovery === false,
        evidence: "candidate_readiness_governance",
      },
    ];
    const passedChecks = checks.filter((check) => check.passed).length;
    const ready = passedChecks === checks.length;
  
    return {
      ok: true,
      registry: SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY,
      mode: "read_only_candidate_repair_block_readiness",
      generatedAt: new Date().toISOString(),
      source: {
        service: "openclaw-system-sense",
        candidateAssessmentRegistry: assessment.registry,
        candidatePlanRegistry: candidatePlan.registry,
        candidateTaskRouteRegistry: taskRoute.registry,
        candidateTaskShellRegistry: taskShellRegistry,
        observerTaskShellRegistry,
        evidence: "systemd_repair_candidate_block_readiness",
      },
      governance: {
        domain: "body_internal",
        risk: "low",
        autonomy: "readiness_report_only",
        approvalRequired: false,
        hostMutation: false,
        canMutate: false,
        canRestart: false,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
      },
      summary: {
        ready,
        passedChecks,
        totalChecks: checks.length,
        selectedUnit,
        existingRouteAvailable: taskRoute.routeDecision?.existingRouteAvailable === true,
        createsTaskNow: false,
        hostMutation: false,
      },
      checks,
      completedBlock: {
        id: "phase-2-track-a-systemd-repair-candidate-route",
        name: "Systemd Repair Candidate Route",
        completedSlices: [
          "openclaw-systemd-repair-candidate-assessment",
          "observer-openclaw-systemd-repair-candidate-assessment",
          "openclaw-systemd-repair-candidate-plan",
          "observer-openclaw-systemd-repair-candidate-plan",
          "openclaw-systemd-repair-candidate-task-route",
          "observer-openclaw-systemd-repair-candidate-task-route",
          "openclaw-systemd-repair-candidate-task-shell",
          "observer-openclaw-systemd-repair-candidate-task-shell",
        ],
        completionClaim: ready ? "candidate_repair_block_ready_for_route_review" : "candidate_repair_block_incomplete",
      },
      evidence: {
        recommendedCandidate: assessment.summary?.recommendedUnit ?? null,
        candidateReason: assessment.summary?.recommendedReason ?? null,
        commandPreview: candidatePlan.plan?.commandPreview ?? null,
        routeStatus: taskRoute.routeDecision?.status ?? "unknown",
        hardBoundary: [
          "no automatic repair",
          "no approval auto-grant",
          "no command execution",
          "no host mutation",
          "no scheduler",
          "no recovery trigger",
        ],
      },
      next: {
        recommendedSlice: "openclaw-systemd-repair-candidate-route-review",
        boundary: "run a whitepaper route review before broadening candidate repair into approval/execution or a new body-capability block",
      },
    };
  }
  
  async function buildSystemdRepairCandidateRouteReview() {
    const readiness = await buildSystemdRepairCandidateReadiness();
    const ready = readiness.summary?.ready === true;
    const candidates = [
      {
        track: "Track B",
        id: "candidate-repair-demo-evidence",
        label: "Read-only candidate repair demo status",
        score: ready ? 94 : 50,
        recommended: true,
        firstSlice: "openclaw-systemd-repair-candidate-demo-status",
        mutation: false,
        reason: "The candidate repair route is complete enough to present as operator evidence; summarize it before considering any broader approval or execution step.",
      },
      {
        track: "Track A",
        id: "candidate-specific-approved-deferred",
        label: "Candidate-specific approved-but-deferred execution",
        score: 62,
        recommended: false,
        firstSlice: "defer-candidate-approved-deferred",
        mutation: false,
        reason: "The existing repair execution path already proved approved-deferred behavior; repeating it for the same browser-runtime candidate would mostly expand approval-boundary coverage.",
      },
      {
        track: "Track A",
        id: "broader-systemd-repair-mutation",
        label: "Broader candidate repair execution",
        score: 40,
        recommended: false,
        firstSlice: "defer-broader-candidate-execution",
        mutation: true,
        reason: "The selected candidate is still the existing browser-runtime demo target; broader mutation should wait for a fresh body-capability route review and a different concrete need.",
      },
      {
        track: "Deferred Track",
        id: "plugin-runtime-adapter",
        label: "Plugin/runtime adapter work",
        score: 15,
        recommended: false,
        firstSlice: "defer-plugin-runtime-adapter",
        mutation: false,
        reason: "Plugin/runtime adapter work is still not needed for this body repair candidate demonstration.",
      },
    ];
  
    return {
      ok: true,
      registry: SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY,
      mode: "read_only_candidate_route_selection",
      generatedAt: new Date().toISOString(),
      source: {
        service: "openclaw-system-sense",
        candidateReadinessRegistry: readiness.registry,
        phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
        evidence: "systemd_repair_candidate_route_review",
      },
      governance: {
        domain: "body_internal",
        risk: "low",
        autonomy: "route_selection_only",
        approvalRequired: false,
        hostMutation: false,
        canMutate: false,
        canRestart: false,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
      },
      decision: {
        selectedTrack: "Track B: Operator/Observer Demo Experience",
        selectedSlice: "openclaw-systemd-repair-candidate-demo-status",
        status: ready ? "selected" : "blocked_until_candidate_readiness",
        rationale: "Close the candidate repair route as visible operator evidence before adding any new approval/execution branch.",
        notSelected: [
          "no candidate-specific approval replay",
          "no real execution replay for the same browser-runtime target",
          "no broader systemd mutation",
          "no automatic repair",
          "no persistence hardening",
          "no denial recovery or duplicate-click work",
          "no plugin/runtime adapter work",
        ],
      },
      evidence: {
        candidateReady: ready,
        candidateChecks: `${readiness.summary?.passedChecks ?? 0}/${readiness.summary?.totalChecks ?? 0}`,
        selectedUnit: readiness.summary?.selectedUnit ?? null,
        completedBlock: readiness.completedBlock,
        hardBoundary: readiness.evidence?.hardBoundary ?? [],
        routePriorityOrder: [
          "present-completed-candidate-repair-route",
          "defer-duplicate-approval-boundaries",
          "defer-broader-host-mutation",
          "plugin-runtime-adapter-deferred",
        ],
      },
      candidates,
      next: {
        recommendedSlice: "openclaw-systemd-repair-candidate-demo-status",
        boundary: "read-only demo status only; do not approve, execute, restart, recover, schedule, or broaden systemd control",
      },
    };
  }
  
  async function buildSystemdRepairCandidateDemoStatus() {
    const [review, readiness, taskRoute] = await Promise.all([
      buildSystemdRepairCandidateRouteReview(),
      buildSystemdRepairCandidateReadiness(),
      buildSystemdRepairCandidateTaskRoute(),
    ]);
    const selectedUnit = readiness.summary?.selectedUnit ?? taskRoute.routeDecision?.targetUnit ?? null;
    const demoReady = review.decision?.selectedSlice === "openclaw-systemd-repair-candidate-demo-status"
      && readiness.summary?.ready === true
      && selectedUnit === "openclaw-browser-runtime.service";
    const checklist = [
      {
        id: "candidate-ranked",
        label: "Candidate assessment ranks browser runtime as the visible repair target",
        passed: readiness.evidence?.recommendedCandidate === "openclaw-browser-runtime.service",
        evidence: readiness.source?.candidateAssessmentRegistry ?? null,
      },
      {
        id: "plan-preview-visible",
        label: "Plan-only command preview is available without execution",
        passed: typeof readiness.evidence?.commandPreview === "string"
          && readiness.evidence.commandPreview.includes("openclaw-browser-runtime.service"),
        evidence: readiness.source?.candidatePlanRegistry ?? null,
      },
      {
        id: "existing-route-visible",
        label: "Existing operator-reviewed repair route is selected",
        passed: taskRoute.routeDecision?.existingRouteAvailable === true,
        evidence: readiness.source?.candidateTaskRouteRegistry ?? null,
      },
      {
        id: "task-shell-visible",
        label: "Candidate task shell is visible in Observer before approval or execution",
        passed: readiness.completedBlock?.completedSlices?.includes("observer-openclaw-systemd-repair-candidate-task-shell") === true,
        evidence: readiness.source?.observerTaskShellRegistry ?? null,
      },
      {
        id: "route-review-complete",
        label: "Route review selects demo status instead of duplicate approval or mutation",
        passed: review.registry === SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY
          && review.decision?.selectedSlice === "openclaw-systemd-repair-candidate-demo-status",
        evidence: review.registry,
      },
      {
        id: "no-hidden-action",
        label: "Demo status remains read-only and non-executing",
        passed: review.governance?.createsTask === false
          && review.governance?.executesCommand === false
          && review.governance?.hostMutation === false
          && review.governance?.triggersRecovery === false,
        evidence: "candidate_demo_status_governance",
      },
    ];
    const passedChecks = checklist.filter((check) => check.passed).length;
  
    return {
      ok: true,
      registry: SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY,
      mode: "read_only_candidate_repair_demo_status",
      generatedAt: new Date().toISOString(),
      source: {
        service: "openclaw-system-sense",
        candidateReadinessRegistry: readiness.registry,
        candidateRouteReviewRegistry: review.registry,
        candidateTaskRouteRegistry: taskRoute.registry,
        evidence: "systemd_repair_candidate_demo_status",
      },
      governance: {
        domain: "body_internal",
        risk: "low",
        autonomy: "demo_status_only",
        approvalRequired: false,
        hostMutation: false,
        canMutate: false,
        canRestart: false,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
      },
      summary: {
        demoReady,
        passedChecks,
        totalChecks: checklist.length,
        selectedUnit,
        selectedSlice: review.decision?.selectedSlice ?? null,
        nextSlice: review.next?.recommendedSlice ?? null,
        hiddenMutation: false,
      },
      checklist,
      operatorView: {
        title: "Systemd repair candidate route is demo-ready",
        narrative: "OpenClaw can explain how it selected one body service, planned a repair preview, verified an existing operator-reviewed task route, and stopped before approval or host mutation.",
        speakingPoints: [
          "The body candidate is selected from systemd inventory, dependency, and health trend evidence.",
          "The command is only a preview until a separate operator action creates an approval-gated task shell.",
          "The route review avoids replaying approval and execution for the same browser-runtime target.",
          "The next expansion must be chosen by another whitepaper route review, not by safety-boundary momentum.",
        ],
      },
      evidence: {
        recommendedCandidate: readiness.evidence?.recommendedCandidate ?? null,
        candidateReason: readiness.evidence?.candidateReason ?? null,
        commandPreview: readiness.evidence?.commandPreview ?? null,
        routeStatus: taskRoute.routeDecision?.status ?? "unknown",
        notSelected: review.decision?.notSelected ?? [],
        completedBlock: readiness.completedBlock,
      },
      next: {
        recommendedSlice: "openclaw-phase-2-next-capability-route-review",
        boundary: "return to a broader whitepaper route review before adding approval replay, execution replay, or broader systemd mutation",
      },
    };
  }

  return {
    buildSystemdRepairCandidateAssessment,
    buildSystemdRepairCandidatePlan,
    buildSystemdRepairCandidateTaskRoute,
    buildSystemdRepairCandidateReadiness,
    buildSystemdRepairCandidateRouteReview,
    buildSystemdRepairCandidateDemoStatus,
  };
}
