import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export function createSystemBodyEvidence({
  buildSystemdDependencyMap,
  buildHealthTrendSummary,
  buildRouteAwareNextActionRecommendation,
  buildConservativeRecoveryPolicyExplanation,
  buildBodyGovernanceReadiness,
  buildPhase2RouteReview,
  buildSystemdRepairCandidateDemoStatus,
  fetchNextRepairDemoStatus,
  registries = {},
} = {}) {
  const requireBuilder = (name, value) => {
    if (typeof value !== "function") {
      throw new TypeError(`createSystemBodyEvidence requires ${name}`);
    }
    return value;
  };
  const buildDependencyMap = requireBuilder("buildSystemdDependencyMap", buildSystemdDependencyMap);
  const buildHealthTrends = requireBuilder("buildHealthTrendSummary", buildHealthTrendSummary);
  const buildRouteAware = requireBuilder("buildRouteAwareNextActionRecommendation", buildRouteAwareNextActionRecommendation);
  const buildRecoveryPolicy = requireBuilder("buildConservativeRecoveryPolicyExplanation", buildConservativeRecoveryPolicyExplanation);
  const buildGovernanceReadiness = requireBuilder("buildBodyGovernanceReadiness", buildBodyGovernanceReadiness);
  const buildRouteReview = requireBuilder("buildPhase2RouteReview", buildPhase2RouteReview);
  const buildCandidateDemoStatus = requireBuilder("buildSystemdRepairCandidateDemoStatus", buildSystemdRepairCandidateDemoStatus);
  const fetchNextRepairStatus = requireBuilder("fetchNextRepairDemoStatus", fetchNextRepairDemoStatus);
  const BODY_EVIDENCE_TIMELINE_REGISTRY = registries.bodyEvidenceTimeline ?? "openclaw-body-evidence-timeline-v0";
  const BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY = registries.bodyEvidenceTimelineReadiness ?? "openclaw-body-evidence-timeline-readiness-v0";
  const BODY_EVIDENCE_LEDGER_PLAN_REGISTRY = registries.bodyEvidenceLedgerPlan ?? "openclaw-body-evidence-ledger-plan-v0";
  const BODY_EVIDENCE_LEDGER_ROUTE_REVIEW_REGISTRY = registries.bodyEvidenceLedgerRouteReview ?? "openclaw-body-evidence-ledger-route-review-v0";
  const BODY_EVIDENCE_LEDGER_STORAGE_ROOT_PLAN_REGISTRY = registries.bodyEvidenceLedgerStorageRootPlan ?? "openclaw-body-evidence-ledger-storage-root-plan-v0";
  const BODY_EVIDENCE_LEDGER_STORAGE_ROOT_ROUTE_REVIEW_REGISTRY = registries.bodyEvidenceLedgerStorageRootRouteReview ?? "openclaw-body-evidence-ledger-storage-root-route-review-v0";
  const BODY_EVIDENCE_LEDGER_FIRST_RECORD_PLAN_REGISTRY = registries.bodyEvidenceLedgerFirstRecordPlan ?? "openclaw-body-evidence-ledger-first-record-plan-v0";
  const BODY_EVIDENCE_LEDGER_FIRST_RECORD_ROUTE_REVIEW_REGISTRY = registries.bodyEvidenceLedgerFirstRecordRouteReview ?? "openclaw-body-evidence-ledger-first-record-route-review-v0";
  const BODY_EVIDENCE_LEDGER_READINESS_REGISTRY = registries.bodyEvidenceLedgerReadiness ?? "openclaw-body-evidence-ledger-readiness-v0";
  const BODY_EVIDENCE_LEDGER_DEMO_STATUS_REGISTRY = registries.bodyEvidenceLedgerDemoStatus ?? "openclaw-body-evidence-ledger-demo-status-v0";
  const BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_PLAN_REGISTRY = registries.bodyEvidenceLedgerFollowupRecordPlan ?? "openclaw-body-evidence-ledger-followup-record-plan-v0";
  const BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_ROUTE_REVIEW_REGISTRY = registries.bodyEvidenceLedgerFollowupRecordRouteReview ?? "openclaw-body-evidence-ledger-followup-record-route-review-v0";

async function buildBodyEvidenceTimeline() {
  const [
    dependencyMap,
    healthTrends,
    routeAware,
    recoveryPolicy,
    governanceReadiness,
    phase2RouteReview,
    candidateDemoStatus,
    nextRepairDemoStatus,
  ] = await Promise.all([
    buildDependencyMap(),
    buildHealthTrends(),
    buildRouteAware(),
    buildRecoveryPolicy(),
    buildGovernanceReadiness(),
    buildRouteReview(),
    buildCandidateDemoStatus(),
    fetchNextRepairStatus().catch(() => null),
  ]);
  const entries = [
    {
      id: "body-dependency-map",
      at: dependencyMap.generatedAt,
      phase: "body_governance",
      registry: dependencyMap.registry,
      label: "OpenClaw-owned body service dependency map captured",
      evidenceType: "structure",
      summary: `${dependencyMap.summary?.nodes ?? dependencyMap.nodes?.length ?? 0} body services mapped with ${dependencyMap.summary?.edges ?? dependencyMap.edges?.length ?? 0} dependencies.`,
      source: "/system/systemd/dependency-map",
      mutation: false,
    },
    {
      id: "health-trend-summary",
      at: healthTrends.generatedAt,
      phase: "body_governance",
      registry: healthTrends.registry,
      label: "Recent body health trend summarized",
      evidenceType: "health_memory",
      summary: `${healthTrends.summary?.samples ?? 0} health samples with ${healthTrends.summary?.degradedServices ?? 0} degraded services.`,
      source: "/system/health/trends",
      mutation: false,
    },
    {
      id: "route-aware-next-action",
      at: routeAware.generatedAt,
      phase: "body_governance",
      registry: routeAware.registry,
      label: "Route-aware next action recommendation recorded",
      evidenceType: "governance_judgment",
      summary: `${routeAware.recommendation?.action ?? "observe"} priority=${routeAware.recommendation?.priority ?? "unknown"}.`,
      source: "/system/route/next-action",
      mutation: false,
    },
    {
      id: "conservative-recovery-policy",
      at: recoveryPolicy.generatedAt,
      phase: "body_governance",
      registry: recoveryPolicy.registry,
      label: "Conservative recovery policy explained",
      evidenceType: "policy",
      summary: `${recoveryPolicy.policy?.currentPosture ?? "observe_first"} with ${recoveryPolicy.rules?.length ?? 0} rules.`,
      source: "/system/route/recovery-policy",
      mutation: false,
    },
    {
      id: "body-governance-readiness",
      at: governanceReadiness.generatedAt,
      phase: "body_governance",
      registry: governanceReadiness.registry,
      label: "Body governance readiness bundle closed",
      evidenceType: "readiness",
      summary: `${governanceReadiness.summary?.passedChecks ?? 0}/${governanceReadiness.summary?.totalChecks ?? 0} checks passed.`,
      source: "/system/route/body-governance-readiness",
      mutation: false,
    },
    {
      id: "phase-2-route-review",
      at: phase2RouteReview.generatedAt,
      phase: "route_review",
      registry: phase2RouteReview.registry,
      label: "Whitepaper-aligned Phase 2 route review selected demo surface",
      evidenceType: "route_decision",
      summary: `${phase2RouteReview.decision?.selectedSlice ?? "unknown"} selected; ${phase2RouteReview.decision?.notSelected?.length ?? 0} non-routes rejected.`,
      source: "/system/route/phase-2-review",
      mutation: false,
    },
    {
      id: "systemd-repair-candidate-demo-status",
      at: candidateDemoStatus.generatedAt,
      phase: "repair_candidate_demo",
      registry: candidateDemoStatus.registry,
      label: "Systemd repair candidate route became demo-ready",
      evidenceType: "demo_status",
      summary: `${candidateDemoStatus.summary?.selectedUnit ?? "unknown"} demoReady=${Boolean(candidateDemoStatus.summary?.demoReady)} checks=${candidateDemoStatus.summary?.passedChecks ?? 0}/${candidateDemoStatus.summary?.totalChecks ?? 0}.`,
      source: "/system/systemd/repair-candidate-demo-status",
      mutation: false,
    },
    {
      id: "systemd-next-repair-demo-status",
      at: nextRepairDemoStatus?.generatedAt ?? new Date().toISOString(),
      phase: "next_repair_demo",
      registry: nextRepairDemoStatus?.registry ?? "openclaw-systemd-next-repair-demo-status-unavailable",
      label: "Next systemd repair execution evidence became demo-ready",
      evidenceType: "demo_status",
      summary: `${nextRepairDemoStatus?.summary?.targetUnit ?? "openclaw-system-sense.service"} demoReady=${Boolean(nextRepairDemoStatus?.summary?.ready)} outcome=${nextRepairDemoStatus?.summary?.outcome ?? "none"}.`,
      source: "/phase-2/next-repair-demo-status",
      mutation: false,
    },
  ].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const timelineReady = entries.length >= 8
    && governanceReadiness.summary?.ready === true
    && candidateDemoStatus.summary?.demoReady === true
    && nextRepairDemoStatus?.summary?.ready === true;

  return {
    ok: true,
    registry: BODY_EVIDENCE_TIMELINE_REGISTRY,
    mode: "read_only_body_evidence_timeline",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      dependencyMapRegistry: dependencyMap.registry,
      healthTrendRegistry: healthTrends.registry,
      routeAwareRegistry: routeAware.registry,
      recoveryPolicyRegistry: recoveryPolicy.registry,
      bodyGovernanceReadinessRegistry: governanceReadiness.registry,
      phase2RouteReviewRegistry: phase2RouteReview.registry,
      candidateDemoStatusRegistry: candidateDemoStatus.registry,
      nextRepairDemoStatusRegistry: nextRepairDemoStatus?.registry ?? null,
      evidence: "body_evidence_timeline_memory",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "evidence_memory_only",
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
      timelineReady,
      entries: entries.length,
      phases: [...new Set(entries.map((entry) => entry.phase))],
      latestEntryId: entries.at(-1)?.id ?? null,
      latestRegistry: entries.at(-1)?.registry ?? null,
      bodyGovernanceReady: governanceReadiness.summary?.ready === true,
      candidateDemoReady: candidateDemoStatus.summary?.demoReady === true,
      nextRepairDemoReady: nextRepairDemoStatus?.summary?.ready === true,
      hiddenMutation: false,
    },
    entries,
    memoryModel: {
      label: "body_evidence_memory_v0",
      purpose: "Keep a read-only chronological spine of body structure, health, policy, route, and repair-candidate evidence.",
      retention: "in-process derived view; durable event storage remains a future route-reviewed capability",
      operatorUse: [
        "explain how OpenClaw knows its body state",
        "show why the current route is not another safety-boundary loop",
        "anchor future repair decisions in prior evidence instead of ad hoc action",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-timeline-readiness",
      boundary: "close the evidence timeline with a read-only readiness check before adding durable storage, schedulers, or new mutation",
    },
  };
}

async function buildBodyEvidenceTimelineReadiness() {
  const timeline = await buildBodyEvidenceTimeline();
  const entryIds = new Set((timeline.entries ?? []).map((entry) => entry.id));
  const requiredEntries = [
    "body-dependency-map",
    "health-trend-summary",
    "route-aware-next-action",
    "conservative-recovery-policy",
    "body-governance-readiness",
    "phase-2-route-review",
    "systemd-repair-candidate-demo-status",
    "systemd-next-repair-demo-status",
  ];
  const checks = [
    {
      id: "timeline-registry",
      label: "Body evidence timeline registry is available",
      passed: timeline.registry === BODY_EVIDENCE_TIMELINE_REGISTRY,
      evidence: timeline.registry,
    },
    {
      id: "required-entries",
      label: "Timeline includes all required body evidence entries",
      passed: requiredEntries.every((id) => entryIds.has(id)),
      evidence: requiredEntries.join(","),
    },
    {
      id: "phase-coverage",
      label: "Timeline covers governance, route review, and repair candidate demo phases",
      passed: ["body_governance", "route_review", "repair_candidate_demo"]
        .every((phase) => timeline.summary?.phases?.includes(phase)),
      evidence: (timeline.summary?.phases ?? []).join(","),
    },
    {
      id: "non-mutating",
      label: "Timeline and entries remain non-mutating",
      passed: timeline.governance?.hostMutation === false
        && timeline.governance?.executesCommand === false
        && timeline.entries?.every((entry) => entry.mutation === false),
      evidence: "timeline_governance",
    },
    {
      id: "memory-purpose-visible",
      label: "Timeline exposes operator memory purpose and use",
      passed: typeof timeline.memoryModel?.purpose === "string"
        && (timeline.memoryModel?.operatorUse ?? []).length >= 3,
      evidence: timeline.memoryModel?.label ?? null,
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length && timeline.summary?.timelineReady === true;

  return {
    ok: true,
    registry: BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY,
    mode: "read_only_body_evidence_timeline_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      bodyEvidenceTimelineRegistry: timeline.registry,
      evidence: "body_evidence_timeline_readiness",
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
      timelineEntries: timeline.summary?.entries ?? 0,
      latestEntryId: timeline.summary?.latestEntryId ?? null,
      hiddenMutation: false,
    },
    checks,
    completedBlock: {
      id: "phase-2-track-c-body-evidence-memory",
      name: "Body Evidence Memory",
      completedSlices: [
        "openclaw-body-evidence-timeline",
        "observer-openclaw-body-evidence-timeline",
        "openclaw-systemd-next-repair-demo-status",
        "observer-openclaw-systemd-next-repair-demo-status",
      ],
      completionClaim: ready ? "body_evidence_timeline_ready_for_route_review" : "body_evidence_timeline_incomplete",
    },
    evidence: {
      timelineRegistry: timeline.registry,
      entries: timeline.entries?.map((entry) => ({
        id: entry.id,
        registry: entry.registry,
        phase: entry.phase,
        mutation: entry.mutation,
      })) ?? [],
      memoryModel: timeline.memoryModel,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before adding durable evidence storage, schedulers, or mutation",
    },
  };
}

async function buildBodyEvidenceLedgerPlan() {
  const readiness = await buildBodyEvidenceTimelineReadiness();
  const timelineReady = readiness.summary?.ready === true;
  const plannedRecordSchema = {
    version: "body-evidence-ledger-record-v0",
    requiredFields: [
      "id",
      "recordedAt",
      "sourceRegistry",
      "sourceEndpoint",
      "phase",
      "evidenceType",
      "summary",
      "contentHash",
      "governance",
    ],
    governanceFields: [
      "hostMutation",
      "executesCommand",
      "createsTask",
      "createsApproval",
      "triggersRecovery",
    ],
    contentPolicy: "store summaries, registries, hashes, and source pointers first; raw payload archival requires separate route review",
  };
  const writeGates = [
    {
      id: "route-review-required",
      label: "Durable ledger implementation requires a separate whitepaper route review",
      passed: false,
      requiredBeforeWrite: true,
    },
    {
      id: "workspace-root-selection",
      label: "Ledger storage root must be explicitly selected and shown in Observer",
      passed: false,
      requiredBeforeWrite: true,
    },
    {
      id: "append-only-format",
      label: "Ledger must be append-only with content hashes and no background scheduler",
      passed: false,
      requiredBeforeWrite: true,
    },
    {
      id: "operator-visible-export",
      label: "Observer must show ledger path, latest record, and export boundary before writes",
      passed: false,
      requiredBeforeWrite: true,
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      timelineReadinessRegistry: readiness.registry,
      evidence: "body_evidence_ledger_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "medium",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canWriteLedger: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      durableStorageWritten: false,
    },
    summary: {
      planReady: timelineReady,
      timelineReady,
      plannedSchema: plannedRecordSchema.version,
      writeGateCount: writeGates.length,
      requiredBeforeWrite: writeGates.filter((gate) => gate.requiredBeforeWrite).length,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.plan",
      storageMode: "append_only_jsonl_candidate",
      implementationStatus: "not_implemented_plan_only",
      plannedRecordSchema,
      retentionPlan: {
        defaultWindow: "operator-selected; no default pruning policy yet",
        compaction: "future route-reviewed summary snapshots only",
        rawPayloadArchival: "deferred",
      },
      writeGates,
      verificationPlan: [
        "prove ledger path is inside an approved OpenClaw body evidence root",
        "append one synthetic ledger record in a future implementation milestone",
        "verify record hash, schema version, source registry, and Observer visibility",
        "prove no scheduler, no task creation, no command execution, and no host mutation beyond the approved ledger append",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-route-review",
      boundary: "review the ledger implementation route before writing durable records or adding scheduling",
    },
  };
}

async function buildBodyEvidenceLedgerRouteReview() {
  const ledgerPlan = await buildBodyEvidenceLedgerPlan();
  const planReady = ledgerPlan.summary?.planReady === true;
  const writeGates = Array.isArray(ledgerPlan.plan?.writeGates) ? ledgerPlan.plan.writeGates : [];
  const requiredWriteGates = writeGates.filter((gate) => gate.requiredBeforeWrite === true);
  const unmetWriteGates = requiredWriteGates.filter((gate) => gate.passed !== true);
  const candidates = [
    {
      track: "Track C",
      id: "operator-visible-ledger-storage-root",
      label: "Plan-only body evidence ledger storage root selection",
      score: planReady ? 97 : 50,
      recommended: planReady,
      firstSlice: "openclaw-body-evidence-ledger-storage-root-plan",
      mutation: false,
      durableWrite: false,
      reason: planReady
        ? "The ledger schema is planned; the next whitepaper-aligned step is selecting an operator-visible storage root before any append."
        : "The ledger plan is not ready, so storage root selection should stay blocked.",
    },
    {
      track: "Track C",
      id: "direct-ledger-append",
      label: "Direct durable ledger append",
      score: 25,
      recommended: false,
      firstSlice: "defer-direct-ledger-append",
      mutation: true,
      durableWrite: true,
      reason: "Direct append would skip storage-root selection, Observer export, and explicit write-gate closure.",
    },
    {
      track: "Deferred Track",
      id: "background-ledger-scheduler",
      label: "Background evidence ledger scheduler",
      score: 15,
      recommended: false,
      firstSlice: "defer-ledger-scheduler",
      mutation: false,
      durableWrite: false,
      reason: "Schedulers would reintroduce autonomous background behavior before the ledger has a human-visible root and append proof.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerPlanRegistry: ledgerPlan.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-storage-root-plan",
      status: planReady ? "selected" : "blocked_until_ledger_plan_ready",
      rationale: "Move from schema planning to operator-visible storage-root planning before any durable ledger append.",
      notSelected: [
        "no direct durable ledger append",
        "no background ledger scheduler",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      ledgerPlanReady: planReady,
      plannedSchema: ledgerPlan.summary?.plannedSchema ?? null,
      writeGateCount: ledgerPlan.summary?.writeGateCount ?? writeGates.length,
      unmetWriteGateIds: unmetWriteGates.map((gate) => gate.id),
      durableStorageWritten: ledgerPlan.summary?.durableStorageWritten === true,
      routeBoundary: ledgerPlan.next?.boundary ?? null,
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-storage-root-plan",
      boundary: "plan the operator-visible ledger storage root before any append-only durable write",
    },
  };
}

async function buildBodyEvidenceLedgerStorageRootPlan() {
  const routeReview = await buildBodyEvidenceLedgerRouteReview();
  const routeReady = routeReview.decision?.selectedSlice === "openclaw-body-evidence-ledger-storage-root-plan"
    && routeReview.decision?.status === "selected";
  const candidateRoots = [
    {
      id: "repo-artifacts-body-evidence-ledger",
      label: "Repository artifact ledger root",
      displayPath: ".artifacts/openclaw-body-evidence-ledger",
      rootPolicy: "inside_openclaw_workspace",
      recommended: true,
      createsDirectoryNow: false,
      writesRecordsNow: false,
      operatorVisible: true,
      reason: "Keeps early ledger evidence local to the OpenClaw workspace and visible to milestone artifacts.",
    },
    {
      id: "user-configured-body-ledger-root",
      label: "Operator configured body ledger root",
      displayPath: "\${OPENCLAW_BODY_EVIDENCE_LEDGER_DIR}",
      rootPolicy: "explicit_operator_configuration_required",
      recommended: false,
      createsDirectoryNow: false,
      writesRecordsNow: false,
      operatorVisible: true,
      reason: "Useful later, but an implicit environment root would be less demoable than the repo artifact path.",
    },
  ];
  const selectedRoot = candidateRoots.find((candidate) => candidate.recommended === true) ?? candidateRoots[0];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_STORAGE_ROOT_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger_storage_root",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerRouteReviewRegistry: routeReview.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_storage_root_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canCreateDirectory: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      planReady: routeReady,
      routeReviewReady: routeReady,
      selectedRootId: selectedRoot?.id ?? null,
      selectedDisplayPath: selectedRoot?.displayPath ?? null,
      candidateRootCount: candidateRoots.length,
      directoryCreated: false,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.storage_root.plan",
      selectedRoot,
      candidateRoots,
      pathPolicy: {
        mustStayInsideWorkspace: true,
        mustBeObserverVisible: true,
        mustNotUseHomeDirectoryByDefault: true,
        mustNotCreateDirectoryInThisSlice: true,
      },
      preWriteChecks: [
        "show resolved ledger root in Observer before any directory creation",
        "prove the root is inside the OpenClaw workspace or an explicit operator-configured path",
        "keep directory creation and first append in separate route-reviewed milestones",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-storage-root-route-review",
      boundary: "review storage-root materialization before creating directories or writing ledger records",
    },
  };
}

async function buildBodyEvidenceLedgerStorageRootRouteReview() {
  const storageRootPlan = await buildBodyEvidenceLedgerStorageRootPlan();
  const planReady = storageRootPlan.summary?.planReady === true;
  const selectedRoot = storageRootPlan.plan?.selectedRoot ?? null;
  const rootInsideWorkspace = selectedRoot?.rootPolicy === "inside_openclaw_workspace";
  const candidates = [
    {
      track: "Track C",
      id: "ledger-directory-creation-task",
      label: "Approval-visible ledger directory creation task shell",
      score: planReady && rootInsideWorkspace ? 96 : 48,
      recommended: planReady && rootInsideWorkspace,
      firstSlice: "openclaw-body-evidence-ledger-directory-task",
      mutation: true,
      durableWrite: false,
      reason: planReady && rootInsideWorkspace
        ? "The selected root is inside the OpenClaw workspace; the next useful step is a minimal operator-visible directory creation task shell."
        : "Directory creation should stay blocked until the selected root is explicit and workspace-bounded.",
    },
    {
      track: "Track C",
      id: "direct-ledger-record-write",
      label: "Direct ledger record write",
      score: 20,
      recommended: false,
      firstSlice: "defer-direct-ledger-record-write",
      mutation: true,
      durableWrite: true,
      reason: "Writing records before directory materialization and Observer verification would skip the visible body-memory setup path.",
    },
    {
      track: "Deferred Track",
      id: "ledger-scheduler",
      label: "Background ledger scheduler",
      score: 10,
      recommended: false,
      firstSlice: "defer-ledger-scheduler",
      mutation: false,
      durableWrite: false,
      reason: "Schedulers are intentionally deferred until one manual ledger append is visible and verified.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_STORAGE_ROOT_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_storage_root_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      storageRootPlanRegistry: storageRootPlan.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_storage_root_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canCreateDirectory: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-directory-task",
      status: planReady && rootInsideWorkspace ? "selected" : "blocked_until_workspace_bounded_root",
      rationale: "Move from storage-root planning to a minimal, visible directory creation task shell before any ledger record write.",
      notSelected: [
        "no direct ledger record write",
        "no background ledger scheduler",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      storageRootPlanReady: planReady,
      selectedRootId: storageRootPlan.summary?.selectedRootId ?? null,
      selectedDisplayPath: storageRootPlan.summary?.selectedDisplayPath ?? null,
      rootInsideWorkspace,
      directoryCreated: storageRootPlan.summary?.directoryCreated === true,
      durableStorageWritten: storageRootPlan.summary?.durableStorageWritten === true,
      pathPolicy: storageRootPlan.plan?.pathPolicy ?? null,
      preWriteChecks: storageRootPlan.plan?.preWriteChecks ?? [],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-directory-task",
      boundary: "create only the selected ledger directory through an explicit task shell; do not write ledger records yet",
    },
  };
}

async function buildBodyEvidenceLedgerFirstRecordPlan() {
  const ledgerPlan = await buildBodyEvidenceLedgerPlan();
  const timelineReadiness = await buildBodyEvidenceTimelineReadiness();
  const directoryPath = path.resolve(process.cwd(), "../..", ".artifacts/openclaw-body-evidence-ledger");
  const directoryExists = existsSync(directoryPath) && statSync(directoryPath).isDirectory();
  const requiredFields = ledgerPlan.plan?.plannedRecordSchema?.requiredFields ?? [];
  const plannedRecord = {
    version: ledgerPlan.summary?.plannedSchema ?? "body-evidence-ledger-record-v0",
    evidenceType: "body_evidence_ledger_bootstrap",
    phase: "phase_2_body_evidence_memory",
    sourceRegistry: timelineReadiness.registry,
    sourceEndpoint: "/system/route/body-evidence-timeline-readiness",
    summary: "Bootstrap durable body evidence memory with timeline readiness and ledger directory materialization evidence.",
    contentHashStrategy: "sha256(JSON.stringify(canonicalRecordWithoutHash))",
    governance: {
      hostMutation: false,
      executesCommand: false,
      createsTask: false,
      createsApproval: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
  };

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_FIRST_RECORD_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger_first_record",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerPlanRegistry: ledgerPlan.registry,
      timelineReadinessRegistry: timelineReadiness.registry,
      evidence: "body_evidence_ledger_first_record_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      planReady: ledgerPlan.summary?.planReady === true && timelineReadiness.summary?.ready === true && directoryExists,
      ledgerPlanReady: ledgerPlan.summary?.planReady === true,
      timelineReady: timelineReadiness.summary?.ready === true,
      directoryExists,
      selectedDisplayPath: ".artifacts/openclaw-body-evidence-ledger",
      plannedRecordType: plannedRecord.evidenceType,
      requiredFieldCount: requiredFields.length,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.first_record.plan",
      ledgerRoot: {
        displayPath: ".artifacts/openclaw-body-evidence-ledger",
        resolvedPath: directoryPath,
        exists: directoryExists,
      },
      plannedRecord,
      requiredFields,
      preAppendChecks: [
        "ledger directory exists inside the OpenClaw workspace",
        "record includes schema version, source registry, source endpoint, phase, evidence type, summary, content hash, and governance",
        "first append is a separate approval-gated milestone",
        "no scheduler, no automatic repair, no plugin/runtime adapter work, and no background persistence",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-first-record-route-review",
      boundary: "review the first ledger record append route before writing any JSONL record",
    },
  };
}

async function buildBodyEvidenceLedgerFirstRecordRouteReview() {
  const firstRecordPlan = await buildBodyEvidenceLedgerFirstRecordPlan();
  const planReady = firstRecordPlan.summary?.planReady === true;
  const candidates = [
    {
      track: "Track C",
      id: "first-record-append-task",
      label: "Approval-gated first ledger record append task shell",
      score: planReady ? 96 : 45,
      recommended: planReady,
      firstSlice: "openclaw-body-evidence-ledger-first-record-task",
      mutation: true,
      durableWrite: true,
      scheduler: false,
      reason: planReady
        ? "The bootstrap record is planned and the ledger root exists; the next step is an explicit append task shell, not a background writer."
        : "First record append must stay blocked until the plan, timeline evidence, and ledger root are ready.",
    },
    {
      track: "Deferred Track",
      id: "background-ledger-writer",
      label: "Background body evidence ledger writer",
      score: 15,
      recommended: false,
      firstSlice: "defer-background-ledger-writer",
      mutation: true,
      durableWrite: true,
      scheduler: true,
      reason: "Background writers are deferred until at least one operator-visible append is proven and reviewed.",
    },
    {
      track: "Deferred Track",
      id: "bulk-evidence-import",
      label: "Bulk evidence import",
      score: 10,
      recommended: false,
      firstSlice: "defer-bulk-evidence-import",
      mutation: true,
      durableWrite: true,
      scheduler: false,
      reason: "Bulk import would skip the single-record bootstrap proof and make evidence provenance harder to audit.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_FIRST_RECORD_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_first_record_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      firstRecordPlanRegistry: firstRecordPlan.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_first_record_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-first-record-task",
      status: planReady ? "selected" : "blocked_until_first_record_plan_ready",
      rationale: "Move from first-record planning to an approval-gated single append task shell; defer schedulers and bulk import.",
      notSelected: [
        "no background ledger writer",
        "no bulk evidence import",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      firstRecordPlanReady: planReady,
      plannedRecordType: firstRecordPlan.summary?.plannedRecordType ?? null,
      directoryExists: firstRecordPlan.summary?.directoryExists === true,
      sourceRegistry: firstRecordPlan.plan?.plannedRecord?.sourceRegistry ?? null,
      requiredFieldCount: firstRecordPlan.summary?.requiredFieldCount ?? 0,
      durableStorageWritten: firstRecordPlan.summary?.durableStorageWritten === true,
      preAppendChecks: firstRecordPlan.plan?.preAppendChecks ?? [],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-first-record-task",
      boundary: "create an approval-gated first-record append task shell; do not add background writers or bulk import",
    },
  };
}

function readBodyEvidenceLedgerRecords() {
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  const fileExists = existsSync(ledgerFilePath) && statSync(ledgerFilePath).isFile();
  if (!fileExists) {
    return {
      ledgerFileDisplayPath,
      ledgerFilePath,
      fileExists: false,
      records: [],
      parseErrors: [],
      lineCount: 0,
      bytes: 0,
    };
  }

  const content = readFileSync(ledgerFilePath, "utf8");
  const lines = content.trim().length > 0 ? content.trim().split("\n").filter(Boolean) : [];
  const records = [];
  const parseErrors = [];
  lines.forEach((line, index) => {
    try {
      const record = JSON.parse(line);
      const { contentHash, ...hashBase } = record;
      const expectedHash = createHash("sha256").update(JSON.stringify(hashBase)).digest("hex");
      records.push({
        ...record,
        hashValid: typeof contentHash === "string" && contentHash === expectedHash,
        expectedHash,
      });
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        message: error instanceof Error ? error.message : "Invalid JSONL record.",
      });
    }
  });

  return {
    ledgerFileDisplayPath,
    ledgerFilePath,
    fileExists,
    records,
    parseErrors,
    lineCount: lines.length,
    bytes: Buffer.byteLength(content, "utf8"),
  };
}

async function buildBodyEvidenceLedgerReadiness() {
  const ledgerPlan = await buildBodyEvidenceLedgerPlan();
  const firstRecordPlan = await buildBodyEvidenceLedgerFirstRecordPlan();
  const ledger = readBodyEvidenceLedgerRecords();
  const bootstrapRecords = ledger.records.filter((record) => record.evidenceType === "body_evidence_ledger_bootstrap");
  const firstRecord = bootstrapRecords[0] ?? null;
  const checks = [
    {
      id: "ledger-plan-ready",
      label: "Body evidence ledger schema plan is ready",
      passed: ledgerPlan.summary?.planReady === true,
      evidence: ledgerPlan.registry,
    },
    {
      id: "ledger-file-exists",
      label: "Workspace-bounded body evidence ledger JSONL file exists",
      passed: ledger.fileExists === true,
      evidence: ledger.ledgerFileDisplayPath,
    },
    {
      id: "single-bootstrap-record",
      label: "Ledger contains exactly one bootstrap record for this readiness checkpoint",
      passed: ledger.lineCount === 1 && bootstrapRecords.length === 1,
      evidence: `lines=${ledger.lineCount};bootstrap=${bootstrapRecords.length}`,
    },
    {
      id: "record-source-ready",
      label: "Bootstrap record cites body evidence timeline readiness",
      passed: firstRecord?.sourceRegistry === BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY
        && firstRecord?.sourceEndpoint === "/system/route/body-evidence-timeline-readiness",
      evidence: firstRecord?.sourceRegistry ?? null,
    },
    {
      id: "content-hash-valid",
      label: "Bootstrap record content hash validates against canonical payload",
      passed: firstRecord?.hashValid === true,
      evidence: firstRecord?.contentHash ?? null,
    },
    {
      id: "governance-boundary",
      label: "Bootstrap record preserves no scheduler, no background writer, and no bulk import boundary",
      passed: firstRecord?.governance?.appendOnly === true
        && firstRecord?.governance?.scheduler === false
        && firstRecord?.governance?.backgroundWriter === false
        && firstRecord?.governance?.bulkImport === false,
      evidence: firstRecord?.governance ?? null,
    },
    {
      id: "parse-clean",
      label: "Ledger JSONL parses cleanly",
      passed: ledger.parseErrors.length === 0,
      evidence: `parseErrors=${ledger.parseErrors.length}`,
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length;

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_READINESS_REGISTRY,
    mode: "read_only_body_evidence_ledger_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerPlanRegistry: ledgerPlan.registry,
      firstRecordPlanRegistry: firstRecordPlan.registry,
      evidence: "body_evidence_ledger_readiness",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "readiness_report_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    summary: {
      ready,
      passedChecks,
      totalChecks: checks.length,
      ledgerFile: ledger.ledgerFileDisplayPath,
      ledgerFileExists: ledger.fileExists,
      recordCount: ledger.records.length,
      bootstrapRecordCount: bootstrapRecords.length,
      latestRecordId: ledger.records.at(-1)?.id ?? null,
      latestRecordHash: ledger.records.at(-1)?.contentHash ?? null,
      hiddenMutation: false,
    },
    checks,
    completedBlock: {
      id: "phase-2-track-c-body-evidence-ledger",
      name: "Body Evidence Ledger",
      completedSlices: [
        "openclaw-body-evidence-ledger-plan",
        "openclaw-body-evidence-ledger-route-review",
        "openclaw-body-evidence-ledger-storage-root-plan",
        "openclaw-body-evidence-ledger-storage-root-route-review",
        "openclaw-body-evidence-ledger-directory-task",
        "openclaw-body-evidence-ledger-directory-execution",
        "openclaw-body-evidence-ledger-first-record-plan",
        "openclaw-body-evidence-ledger-first-record-route-review",
        "openclaw-body-evidence-ledger-first-record-task",
        "openclaw-body-evidence-ledger-first-record-append",
      ],
      completionClaim: ready ? "body_evidence_ledger_first_record_ready_for_route_review" : "body_evidence_ledger_incomplete",
    },
    evidence: {
      ledger,
      records: ledger.records.map((record) => ({
        id: record.id,
        recordedAt: record.recordedAt,
        sourceRegistry: record.sourceRegistry,
        evidenceType: record.evidenceType,
        phase: record.phase,
        contentHash: record.contentHash,
        hashValid: record.hashValid,
        governance: record.governance,
      })),
      parseErrors: ledger.parseErrors,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before adding additional ledger records, background writers, schedulers, or new mutation",
    },
  };
}

async function buildBodyEvidenceLedgerDemoStatus() {
  const readiness = await buildBodyEvidenceLedgerReadiness();
  const record = readiness.evidence?.records?.[0] ?? null;
  const checklist = [
    {
      id: "ledger-readiness-ready",
      label: "Body evidence ledger readiness passed",
      passed: readiness.summary?.ready === true,
      evidence: readiness.registry,
    },
    {
      id: "bootstrap-record-visible",
      label: "Bootstrap ledger record is visible to Observer and operator demo",
      passed: readiness.summary?.recordCount === 1
        && record?.evidenceType === "body_evidence_ledger_bootstrap",
      evidence: record?.id ?? null,
    },
    {
      id: "record-hash-valid",
      label: "Bootstrap record hash validates",
      passed: record?.hashValid === true,
      evidence: record?.contentHash ?? null,
    },
    {
      id: "operator-provenance",
      label: "Bootstrap record carries task and approval provenance",
      passed: typeof record?.governance?.taskId === "string"
        && typeof record?.governance?.approvalId === "string",
      evidence: {
        taskId: record?.governance?.taskId ?? null,
        approvalId: record?.governance?.approvalId ?? null,
      },
    },
    {
      id: "no-background-writers",
      label: "Demo status confirms no background writer, scheduler, or bulk import",
      passed: readiness.governance?.backgroundWriter === false
        && readiness.governance?.schedulesFollowUp === false
        && readiness.governance?.bulkImport === false
        && record?.governance?.backgroundWriter === false
        && record?.governance?.scheduler === false
        && record?.governance?.bulkImport === false,
      evidence: "no_background_ledger_writer",
    },
  ];
  const passed = checklist.filter((item) => item.passed).length;
  const demoReady = passed === checklist.length;

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_DEMO_STATUS_REGISTRY,
    mode: "read_only_body_evidence_ledger_demo_status",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerReadinessRegistry: readiness.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_demo_status",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "demo_status_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    summary: {
      demoReady,
      passed,
      total: checklist.length,
      ledgerReady: readiness.summary?.ready === true,
      ledgerFile: readiness.summary?.ledgerFile ?? null,
      recordCount: readiness.summary?.recordCount ?? 0,
      bootstrapRecordId: record?.id ?? null,
      bootstrapRecordHash: record?.contentHash ?? null,
      hiddenMutation: false,
    },
    checklist,
    demoNarrative: [
      "OpenClaw now has a durable body evidence ledger root inside the workspace.",
      "The first bootstrap JSONL record was created through an explicit task and approval.",
      "The record points back to body evidence timeline readiness and validates with a content hash.",
      "No background ledger writer, scheduler, bulk import, automatic repair, or plugin/runtime adapter was introduced.",
      "The next move must return to route review before any additional durable writes.",
    ],
    evidence: {
      readinessSummary: readiness.summary,
      record,
      completedBlock: readiness.completedBlock,
      next: readiness.next,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "route-review the next body capability; do not add more ledger records or background writers from demo status",
    },
  };
}

async function buildBodyEvidenceLedgerFollowupRecordPlan() {
  const timelineReadiness = await buildBodyEvidenceTimelineReadiness();
  const ledgerReadiness = await buildBodyEvidenceLedgerReadiness();
  const ledger = readBodyEvidenceLedgerRecords();
  const existingRecords = ledger.records.map((record, index) => ({
    index: index + 1,
    id: record.id,
    recordedAt: record.recordedAt,
    evidenceType: record.evidenceType,
    sourceRegistry: record.sourceRegistry,
    hashValid: record.hashValid === true,
  }));
  const latestRecord = existingRecords.at(-1) ?? null;
  const planReady = timelineReadiness.summary?.ready === true
    && ledgerReadiness.summary?.ready === true
    && ledger.records.length >= 1
    && ledger.parseErrors.length === 0;
  const plannedRecord = {
    version: "body-evidence-ledger-record-v0",
    evidenceType: "body_evidence_timeline_followup",
    phase: "phase_2_body_evidence_memory",
    sequence: ledger.records.length + 1,
    sourceRegistry: timelineReadiness.registry,
    sourceEndpoint: "/system/route/body-evidence-timeline-readiness",
    summary: "Plan a future follow-up ledger record from the latest body evidence timeline readiness after completed repair and candidate evidence.",
    contentHashStrategy: "sha256(JSON.stringify(canonicalRecordWithoutHash))",
    governance: {
      hostMutation: false,
      executesCommand: false,
      createsTask: false,
      createsApproval: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger_followup_record",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      timelineReadinessRegistry: timelineReadiness.registry,
      ledgerReadinessRegistry: ledgerReadiness.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_followup_record_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    summary: {
      planReady,
      timelineReady: timelineReadiness.summary?.ready === true,
      ledgerReady: ledgerReadiness.summary?.ready === true,
      existingRecordCount: ledger.records.length,
      latestRecordId: latestRecord?.id ?? null,
      latestRecordHashValid: ledger.records.at(-1)?.hashValid === true,
      plannedRecordType: plannedRecord.evidenceType,
      plannedSequence: plannedRecord.sequence,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.followup_record.plan",
      ledgerFile: {
        displayPath: ledger.ledgerFileDisplayPath,
        resolvedPath: ledger.ledgerFilePath,
        exists: ledger.fileExists,
        lineCount: ledger.lineCount,
      },
      existingRecords,
      plannedRecord,
      prerequisiteEvidence: {
        timelineReadiness: {
          registry: timelineReadiness.registry,
          ready: timelineReadiness.summary?.ready === true,
          latestEntryId: timelineReadiness.summary?.latestEntryId ?? null,
        },
        ledgerReadiness: {
          registry: ledgerReadiness.registry,
          ready: ledgerReadiness.summary?.ready === true,
          recordCount: ledgerReadiness.summary?.recordCount ?? 0,
        },
      },
      preAppendChecks: [
        "future follow-up append requires its own route review before any JSONL write",
        "operator-visible plan must cite the latest timeline readiness registry and existing ledger count",
        "no background writer, scheduler, automatic repair, bulk import, or plugin/runtime adapter work in this checkpoint",
      ],
      deferredActions: [
        "do not create a follow-up append task",
        "do not request approval",
        "do not append a second ledger record",
        "do not schedule recurring ledger writes",
      ],
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before turning this follow-up plan into any task, approval, scheduler, or ledger append",
    },
  };
}

async function buildBodyEvidenceLedgerFollowupRecordRouteReview() {
  const followupPlan = await buildBodyEvidenceLedgerFollowupRecordPlan();
  const planReady = followupPlan.summary?.planReady === true;
  const existingRecordCount = followupPlan.summary?.existingRecordCount ?? 0;
  const plannedSequence = followupPlan.summary?.plannedSequence ?? null;
  const candidates = [
    {
      track: "Track C",
      id: "followup-record-append-task-shell",
      label: "Approval-gated follow-up ledger record append task shell",
      score: planReady ? 94 : 42,
      recommended: planReady,
      firstSlice: "openclaw-body-evidence-ledger-followup-record-task",
      mutation: true,
      durableWrite: true,
      scheduler: false,
      reason: planReady
        ? "The follow-up record is planned against the current timeline readiness and existing ledger count; the next step, if accepted later, should be one explicit task shell rather than a background writer."
        : "Follow-up append task routing stays blocked until the plan, timeline readiness, and first ledger record are ready.",
    },
    {
      track: "Deferred Track",
      id: "direct-followup-ledger-append",
      label: "Direct second ledger record append",
      score: 18,
      recommended: false,
      firstSlice: "defer-direct-followup-ledger-append",
      mutation: true,
      durableWrite: true,
      scheduler: false,
      reason: "Direct append would skip task-shell visibility and approval planning for the second durable record.",
    },
    {
      track: "Deferred Track",
      id: "recurring-ledger-writer",
      label: "Recurring body evidence ledger writer",
      score: 12,
      recommended: false,
      firstSlice: "defer-recurring-ledger-writer",
      mutation: true,
      durableWrite: true,
      scheduler: true,
      reason: "Recurring writers remain deferred until manually planned single-record follow-ups are proven and useful.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_FOLLOWUP_RECORD_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_followup_record_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      followupRecordPlanRegistry: followupPlan.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_followup_record_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-followup-record-task",
      status: planReady ? "selected" : "blocked_until_followup_record_plan_ready",
      rationale: "Move from follow-up record planning to a future approval-gated single append task shell; continue deferring direct append, schedulers, and background writers.",
      notSelected: [
        "no direct follow-up ledger append",
        "no recurring ledger writer",
        "no background persistence",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      followupRecordPlanReady: planReady,
      plannedRecordType: followupPlan.summary?.plannedRecordType ?? null,
      plannedSequence,
      existingRecordCount,
      latestRecordId: followupPlan.summary?.latestRecordId ?? null,
      sourceRegistry: followupPlan.plan?.plannedRecord?.sourceRegistry ?? null,
      sourceEndpoint: followupPlan.plan?.plannedRecord?.sourceEndpoint ?? null,
      durableStorageWritten: followupPlan.summary?.durableStorageWritten === true,
      preAppendChecks: followupPlan.plan?.preAppendChecks ?? [],
      deferredActions: followupPlan.plan?.deferredActions ?? [],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-followup-record-task",
      boundary: "future task shell only; do not append a second ledger record, request approval, or schedule recurring writes in this route review",
    },
  };
}


  return {
    buildBodyEvidenceTimeline,
    buildBodyEvidenceTimelineReadiness,
    buildBodyEvidenceLedgerPlan,
    buildBodyEvidenceLedgerRouteReview,
    buildBodyEvidenceLedgerStorageRootPlan,
    buildBodyEvidenceLedgerStorageRootRouteReview,
    buildBodyEvidenceLedgerFirstRecordPlan,
    buildBodyEvidenceLedgerFirstRecordRouteReview,
    buildBodyEvidenceLedgerReadiness,
    buildBodyEvidenceLedgerDemoStatus,
    buildBodyEvidenceLedgerFollowupRecordPlan,
    buildBodyEvidenceLedgerFollowupRecordRouteReview,
  };
}
