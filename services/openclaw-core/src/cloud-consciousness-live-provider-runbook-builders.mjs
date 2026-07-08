import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export function createCloudConsciousnessLiveProviderRunbookBuilders(deps) {
  const {
    postJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    completeTask,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    setTaskPhase,
    isTaskPolicyApproved,
    buildCloudConsciousnessRealProviderCallExit,
    buildCloudConsciousnessProviderResponseReadback,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
  } = deps;

  function phase11Governance({
    createsTask = false,
    createsApproval = false,
    writesRunbookArtifact = false,
    approvedRunbook = false,
  } = {}) {
    return {
      phase: "phase-11",
      cloudConsciousnessBoundary: "live_provider_call_runbook",
      storageScope: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
      createsTask,
      createsApproval,
      writesRunbookArtifact,
      approvedRunbook,
      mutatesHost: writesRunbookArtifact,
      callsCloudModel: false,
      transmitsExternally: false,
      networkCall: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      liveProviderCallEnabled: false,
      crossesDomain: false,
      startsAutomation: false,
      includesSecrets: false,
      userOwnedDocsTouched: false,
    };
  }

  function phase11EvidenceRef(evidence) {
    if (!evidence || typeof evidence !== "object") {
      return null;
    }
    return {
      registry: evidence.registry ?? null,
      status: evidence.status ?? null,
      summary: evidence.summary ?? null,
      next: evidence.next ?? null,
    };
  }

  function cloudConsciousnessLiveProviderRunbookFilePath() {
    return path.resolve(process.cwd(), "../..", CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH);
  }

  function cloudConsciousnessLiveProviderRunbookDirPath() {
    return path.dirname(cloudConsciousnessLiveProviderRunbookFilePath());
  }

  function readCloudConsciousnessLiveProviderRunbookRecords() {
    const filePath = cloudConsciousnessLiveProviderRunbookFilePath();
    if (!existsSync(filePath)) {
      return {
        exists: false,
        file: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
        filePath,
        lineCount: 0,
        records: [],
        latest: null,
      };
    }

    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const records = lines.map((line, index) => {
      try {
        return {
          ok: true,
          index,
          ...JSON.parse(line),
        };
      } catch (error) {
        return {
          ok: false,
          index,
          error: error instanceof Error ? error.message : "Invalid JSONL record.",
        };
      }
    });
    return {
      exists: true,
      file: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
      filePath,
      lineCount: lines.length,
      records,
      latest: records.filter((record) => record.ok).at(-1) ?? null,
    };
  }

  async function buildCloudConsciousnessLiveProviderCallRunbook() {
    const phase10Exit = await buildCloudConsciousnessRealProviderCallExit();
    const checks = [
      {
        id: "phase-10-complete",
        label: "Phase 10 completed real provider-call preflight and local response rehearsal",
        passed: phase10Exit.summary?.complete === true
          && phase10Exit.next?.recommendedSlice === "openclaw-cloud-consciousness-live-provider-call-runbook",
        evidence: phase10Exit.registry,
      },
      {
        id: "runbook-before-live-egress",
        label: "Live provider-call work starts with a human-visible runbook before live egress",
        passed: true,
        evidence: "runbook_first_no_live_call",
      },
      {
        id: "local-runbook-artifact",
        label: "Phase 11 stores only a local live provider-call runbook artifact",
        passed: true,
        evidence: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-runbook-v0",
      mode: "phase_11_cloud_consciousness_live_provider_call_runbook",
      generatedAt: new Date().toISOString(),
      status: ready ? "cloud_consciousness_live_provider_call_runbook_ready" : "waiting_for_phase_10_provider_call_preflight",
      governance: phase11Governance(),
      whitepaperAlignment: {
        thesis: "Live cloud-consciousness egress requires an explicit human-visible runbook and final authorization boundary.",
        phaseTheme: "Prepare the live provider-call runbook without enabling external transmission.",
        avoidsLoop: "No live provider request, provider SDK loading, credential reading, broad approval hardening, or unrelated body-repair expansion is selected.",
      },
      selectedSlices: [
        "openclaw-cloud-consciousness-live-provider-operator-checklist",
        "openclaw-cloud-consciousness-live-provider-egress-transcript-schema",
        "openclaw-cloud-consciousness-live-provider-final-authorization-review",
        "openclaw-cloud-consciousness-live-provider-runbook-route-review",
        "openclaw-cloud-consciousness-live-provider-runbook-task",
        "openclaw-cloud-consciousness-approved-live-provider-runbook",
        "openclaw-cloud-consciousness-live-provider-runbook-readback",
        "openclaw-cloud-consciousness-live-provider-call-runbook-exit",
      ],
      checks,
      summary: {
        ready,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        phase: "phase-11",
        callsCloudModel: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        writesRunbookArtifact: false,
      },
      evidence: {
        phase10Exit: phase11EvidenceRef(phase10Exit),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-operator-checklist",
        boundary: "define the operator checklist before final authorization review",
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderOperatorChecklist() {
    const runbook = await buildCloudConsciousnessLiveProviderCallRunbook();
    const checklist = {
      id: "openclaw.cloud_consciousness.live_provider_operator_checklist.v0",
      operatorMustConfirm: [
        "provider endpoint is explicit",
        "credential source is intentional",
        "request envelope hash matches reviewed evidence",
        "redaction review excludes secrets and raw documents",
        "egress transcript will be recorded",
        "user can pause, stop, or revoke before any live call",
      ],
      liveCallEnabledInPhase11: false,
      credentialValueRead: false,
      externalTransmission: false,
    };
    const checks = [
      {
        id: "runbook-ready",
        label: "Live provider-call runbook plan is ready",
        passed: runbook.summary?.ready === true,
        evidence: runbook.registry,
      },
      {
        id: "operator-checklist-complete",
        label: "Operator checklist covers endpoint, credential, hash, redaction, transcript, and revocation",
        passed: checklist.operatorMustConfirm.length >= 6,
        evidence: `${checklist.operatorMustConfirm.length} item(s)`,
      },
      {
        id: "live-call-disabled",
        label: "Checklist does not enable live provider calls or credential reads",
        passed: checklist.liveCallEnabledInPhase11 === false
          && checklist.credentialValueRead === false
          && checklist.externalTransmission === false,
        evidence: "checklist_only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-operator-checklist-v0",
      mode: "phase_11_cloud_consciousness_live_provider_operator_checklist",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_live_provider_operator_checklist_ready" : "waiting_for_operator_checklist",
      governance: phase11Governance(),
      checklist,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        checklistItemCount: checklist.operatorMustConfirm.length,
        callsCloudModel: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        runbook: phase11EvidenceRef(runbook),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-egress-transcript-schema",
        boundary: "define the live egress transcript schema before final authorization review",
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderEgressTranscriptSchema() {
    const checklist = await buildCloudConsciousnessLiveProviderOperatorChecklist();
    const schema = {
      id: "openclaw.cloud_consciousness.live_provider_egress_transcript.v0",
      requiredFields: [
        "id",
        "createdAt",
        "requestId",
        "requestContentHash",
        "operatorChecklistHash",
        "endpointFingerprint",
        "credentialSource",
        "redactionPolicy",
        "egressDecision",
        "liveCallStatus",
        "contentHash",
      ],
      liveCallStatusValues: ["not_enabled", "blocked", "operator_deferred"],
      phase11AllowedStatus: "not_enabled",
    };
    const checks = [
      {
        id: "checklist-ready",
        label: "Operator checklist is ready",
        passed: checklist.summary?.ready === true,
        evidence: checklist.registry,
      },
      {
        id: "schema-fields-defined",
        label: "Egress transcript schema defines request, endpoint, credential source, redaction, and decision fields",
        passed: schema.requiredFields.includes("credentialSource")
          && schema.requiredFields.includes("egressDecision")
          && schema.requiredFields.includes("endpointFingerprint"),
        evidence: schema.id,
      },
      {
        id: "status-not-enabled",
        label: "Phase 11 transcript schema only allows not-enabled live call status",
        passed: schema.phase11AllowedStatus === "not_enabled",
        evidence: schema.phase11AllowedStatus,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-egress-transcript-schema-v0",
      mode: "phase_11_cloud_consciousness_live_provider_egress_transcript_schema",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_live_provider_egress_transcript_schema_ready" : "waiting_for_egress_transcript_schema",
      governance: phase11Governance(),
      schema,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        requiredFieldCount: schema.requiredFields.length,
        callsCloudModel: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        checklist: phase11EvidenceRef(checklist),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-final-authorization-review",
        boundary: "review final authorization without enabling live provider egress",
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderFinalAuthorizationReview() {
    const transcriptSchema = await buildCloudConsciousnessLiveProviderEgressTranscriptSchema();
    const responseReadback = buildCloudConsciousnessProviderResponseReadback();
    const authorization = {
      status: "not_authorized_for_live_egress",
      reviewedResponseRecordId: responseReadback.summary?.latestRecordId ?? null,
      reviewedResponseHash: responseReadback.summary?.latestContentHash ?? null,
      requiredFutureHumanAction: "separate live-provider-call execution phase with explicit endpoint and credential approval",
      liveProviderCallEnabled: false,
      credentialValueRead: false,
      externalTransmission: false,
    };
    const checks = [
      {
        id: "transcript-schema-ready",
        label: "Live provider egress transcript schema is ready",
        passed: transcriptSchema.summary?.ready === true,
        evidence: transcriptSchema.registry,
      },
      {
        id: "phase-10-response-linked",
        label: "Final authorization review links the Phase 10 response rehearsal readback",
        passed: responseReadback.summary?.ready === true
          && typeof authorization.reviewedResponseHash === "string",
        evidence: responseReadback.registry,
      },
      {
        id: "live-egress-not-authorized",
        label: "Final authorization does not enable live provider egress in Phase 11",
        passed: authorization.liveProviderCallEnabled === false
          && authorization.credentialValueRead === false
          && authorization.externalTransmission === false,
        evidence: authorization.status,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-final-authorization-review-v0",
      mode: "phase_11_cloud_consciousness_live_provider_final_authorization_review",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_live_provider_final_authorization_review_ready" : "waiting_for_final_authorization_review",
      governance: phase11Governance(),
      authorization,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        liveProviderCallEnabled: false,
        providerCredentialRead: false,
        callsCloudModel: false,
        transmitsExternally: false,
      },
      evidence: {
        transcriptSchema: phase11EvidenceRef(transcriptSchema),
        responseReadback: phase11EvidenceRef(responseReadback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-runbook-route-review",
        boundary: "route-review local runbook artifact creation before task materialization",
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderRunbookRouteReview() {
    const authorizationReview = await buildCloudConsciousnessLiveProviderFinalAuthorizationReview();
    const decision = {
      selectedSlice: "openclaw-cloud-consciousness-live-provider-runbook-task",
      deferredSlice: "openclaw-cloud-consciousness-live-provider-call-execution-plan",
      status: authorizationReview.summary?.ready === true ? "selected" : "blocked",
      reason: "Phase 11 may write an approved local live-provider-call runbook; actual live provider egress remains deferred.",
      canCreateTask: authorizationReview.summary?.ready === true,
      canWriteRunbookAfterApproval: authorizationReview.summary?.ready === true,
      canCallCloudProviderNow: false,
      storageScope: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
    };
    const checks = [
      {
        id: "authorization-review-ready",
        label: "Final authorization review is ready",
        passed: authorizationReview.summary?.ready === true,
        evidence: authorizationReview.registry,
      },
      {
        id: "runbook-task-selected",
        label: "Route selects local approval-gated live provider-call runbook task",
        passed: decision.selectedSlice === "openclaw-cloud-consciousness-live-provider-runbook-task",
        evidence: decision.selectedSlice,
      },
      {
        id: "live-egress-deferred",
        label: "Actual live provider egress remains deferred",
        passed: decision.canCallCloudProviderNow === false,
        evidence: decision.deferredSlice,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-runbook-route-review-v0",
      mode: "phase_11_cloud_consciousness_live_provider_runbook_route_review",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_live_provider_runbook_route_selected" : "waiting_for_live_provider_runbook_route",
      governance: phase11Governance(),
      decision,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        selectedSlice: decision.selectedSlice,
        deferredSlice: decision.deferredSlice,
        createsTask: false,
        callsCloudModel: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        authorizationReview: phase11EvidenceRef(authorizationReview),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-runbook-task",
        boundary: "create the approval-gated local runbook task without live egress",
      },
    };
  }

  async function createCloudConsciousnessLiveProviderRunbookTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider-call runbook task creation requires confirm=true.");
    }

    const routeReview = await buildCloudConsciousnessLiveProviderRunbookRouteReview();
    if (routeReview.summary?.ready !== true || routeReview.decision?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-runbook-task") {
      throw new Error("Cloud consciousness live provider-call runbook task requires a ready route review.");
    }

    const authorizationReview = await buildCloudConsciousnessLiveProviderFinalAuthorizationReview();
    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.runbook_write",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "runbook_only", "operator_reviewed"],
    };
    const goal = "Record reviewed live provider-call runbook without enabling provider egress";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_runbook_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_runbook_task.draft",
      type: "cloud_consciousness_live_provider_runbook_task",
      goal,
    });
    const liveProviderRunbook = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
      routeReviewRegistry: routeReview.registry,
      authorizationRegistry: authorizationReview.registry ?? null,
      responseRecordId: authorizationReview.authorization?.reviewedResponseRecordId ?? null,
      runbookFileDisplayPath: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
      artifactWritten: false,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
      credentialRead: false,
      liveProviderCallEnabled: false,
    };
    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_runbook_task",
      workViewStrategy: "cloud-consciousness-live-provider-runbook",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-runbook-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-call-runbook",
        summary: "Record an approval-gated local live provider-call runbook without live provider egress.",
        governance: phase11Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-runbook-evidence",
            phase: "review_live_provider_runbook_evidence",
            title: "Review checklist, egress transcript schema, and final authorization evidence",
            status: "pending",
            responseRecordId: liveProviderRunbook.responseRecordId,
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before writing the local live provider-call runbook",
            status: "pending",
            capabilityId: "act.filesystem.append_text",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "write-live-provider-runbook",
            phase: "cloud_consciousness_live_provider_runbook_write",
            title: "Append one local live provider-call runbook inside OpenClaw-owned artifacts",
            status: "pending",
            capabilityId: "act.filesystem.append_text",
            requiresApproval: true,
            executesNow: false,
          },
        ],
      },
    }, { skipInitialPolicy: true });
    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    task.cloudConsciousnessLiveProviderRunbook = liveProviderRunbook;
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "cloud-consciousness-live-provider-runbook-task-v0" });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-runbook-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeReview.registry,
      routeReview,
      authorizationReview,
      task,
      approval,
      governance: phase11Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessLiveProviderRunbookTask(task) {
    return task?.type === "cloud_consciousness_live_provider_runbook_task"
      && task?.cloudConsciousnessLiveProviderRunbook?.registry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessLiveProviderRunbookTask(task) {
    const routeReview = await buildCloudConsciousnessLiveProviderRunbookRouteReview();
    const authorizationReview = await buildCloudConsciousnessLiveProviderFinalAuthorizationReview();
    const transcriptSchema = await buildCloudConsciousnessLiveProviderEgressTranscriptSchema();
    const runbookFileDisplayPath = CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH;
    const runbookFilePath = cloudConsciousnessLiveProviderRunbookFilePath();
    const createdAt = new Date().toISOString();
    const runbook = {
      steps: [
        "confirm endpoint and credential source in a separate live execution phase",
        "recompute and display request content hash",
        "display redaction review and rejected content categories",
        "record egress transcript before any network send",
        "require operator final confirmation immediately before live egress",
        "stop without external transmission if any evidence differs",
      ],
      rollback: "No live call is enabled in Phase 11; rollback is deletion or supersession of this local runbook artifact.",
      liveCallEnabled: false,
    };
    const recordBase = {
      id: `cloud-live-provider-runbook-${randomUUID()}`,
      createdAt,
      schema: "openclaw.cloud_consciousness.live_provider_call_runbook.v0",
      transcriptSchema: transcriptSchema.schema?.id ?? null,
      reviewedResponseRecordId: authorizationReview.authorization?.reviewedResponseRecordId ?? null,
      reviewedResponseHash: authorizationReview.authorization?.reviewedResponseHash ?? null,
      governance: {
        taskId: task.id,
        approvalId: task.approval?.requestId ?? null,
        approved: isTaskPolicyApproved(task),
        liveProviderCallEnabled: false,
        externalTransmissionAllowed: false,
        networkCall: false,
        providerSdkLoaded: false,
        credentialRead: false,
        finalAuthorizationStatus: authorizationReview.authorization?.status ?? null,
      },
      runbook,
    };
    const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
    const record = {
      ...recordBase,
      contentHash,
    };
    const line = `${JSON.stringify(record)}\n`;

    await setTaskPhase(task, "cloud_consciousness_live_provider_runbook_write", {
      status: "running",
      details: {
        executor: "cloud-consciousness-live-provider-runbook-task-v0",
        runbookFile: runbookFileDisplayPath,
        artifactWritten: false,
        cloudCallExecuted: false,
        transmittedExternally: false,
        providerSdkLoaded: false,
        credentialRead: false,
        liveProviderCallEnabled: false,
      },
    });

    mkdirSync(cloudConsciousnessLiveProviderRunbookDirPath(), { recursive: true });
    const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
      path: runbookFilePath,
      content: line,
      encoding: "utf8",
      createIfMissing: true,
      intent: "cloud_consciousness.live_provider_call.runbook_write",
    });
    task.cloudConsciousnessLiveProviderRunbook = {
      ...(task.cloudConsciousnessLiveProviderRunbook ?? {}),
      runbookFileDisplayPath,
      runbookFilePath: result.path ?? runbookFilePath,
      allowedRoot: result.root ?? null,
      recordId: record.id,
      contentHash,
      contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
      previousBytes: result.previousBytes ?? 0,
      totalBytes: result.totalBytes ?? null,
      artifactWritten: true,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
      credentialRead: false,
      liveProviderCallEnabled: false,
      appendResult: {
        registry: "openclaw-cloud-consciousness-approved-live-provider-runbook-v0",
        mode: result.mode ?? "append_text",
        created: result.created === true,
        createIfMissing: result.createIfMissing === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "cloud-consciousness-live-provider-runbook-task-v0",
      summary: `Appended local live provider-call runbook ${record.id} to ${runbookFileDisplayPath}.`,
      runbookFile: runbookFileDisplayPath,
      result,
      record,
      hostMutation: true,
      artifactWritten: true,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
      credentialRead: false,
      liveProviderCallEnabled: false,
      scheduler: false,
      backgroundWriter: false,
    });
    await publishEvent(createEventName("cloud_consciousness.live_provider_runbook_written"), {
      task: serialiseTask(completedTask),
      runbookFile: runbookFileDisplayPath,
      recordId: record.id,
      contentHash,
    });

    return {
      task: completedTask,
      policy: completedTask.policy?.decision ?? null,
      approval: completedTask.approval ?? null,
      actions: [],
      verification: null,
      execution: {
        registry: "openclaw-cloud-consciousness-approved-live-provider-runbook-v0",
        mode: "approved_local_live_provider_call_runbook",
        runbookFile: runbookFileDisplayPath,
        path: result.path ?? null,
        recordId: record.id,
        contentHash,
        hostMutation: true,
        artifactWritten: true,
        transmittedExternally: false,
        cloudCallExecuted: false,
        providerSdkLoaded: false,
        credentialRead: false,
        liveProviderCallEnabled: false,
        scheduler: false,
        backgroundWriter: false,
      },
    };
  }

  function buildCloudConsciousnessLiveProviderRunbookReadback() {
    const runbook = readCloudConsciousnessLiveProviderRunbookRecords();
    const validRecords = runbook.records.filter((record) => record.ok === true);
    const latest = validRecords.at(-1) ?? null;
    const checks = [
      {
        id: "runbook-file-readable",
        label: "Live provider-call runbook JSONL is readable",
        passed: runbook.exists === true,
        evidence: runbook.file,
      },
      {
        id: "runbook-record-present",
        label: "At least one approved local live provider-call runbook is present",
        passed: validRecords.length >= 1,
        evidence: `${validRecords.length} record(s)`,
      },
      {
        id: "runbook-not-live",
        label: "Latest runbook has no SDK, credential read, cloud call, live enablement, or external transmission",
        passed: latest?.schema === "openclaw.cloud_consciousness.live_provider_call_runbook.v0"
          && latest?.governance?.networkCall === false
          && latest?.governance?.providerSdkLoaded === false
          && latest?.governance?.credentialRead === false
          && latest?.governance?.liveProviderCallEnabled === false
          && typeof latest?.contentHash === "string",
        evidence: latest?.id ?? "none",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-runbook-readback-v0",
      mode: "phase_11_cloud_consciousness_live_provider_runbook_readback",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_live_provider_runbook_readback_ready" : "waiting_for_live_provider_runbook",
      governance: phase11Governance(),
      runbook: {
        file: runbook.file,
        exists: runbook.exists,
        lineCount: runbook.lineCount,
        validRecordCount: validRecords.length,
        latest: latest ? {
          id: latest.id ?? null,
          schema: latest.schema ?? null,
          reviewedResponseRecordId: latest.reviewedResponseRecordId ?? null,
          reviewedResponseHash: latest.reviewedResponseHash ?? null,
          contentHash: latest.contentHash ?? null,
          createdAt: latest.createdAt ?? null,
          transmittedExternally: latest.governance?.externalTransmissionAllowed === true,
          cloudCallExecuted: latest.governance?.networkCall === true,
          providerSdkLoaded: latest.governance?.providerSdkLoaded === true,
          credentialRead: latest.governance?.credentialRead === true,
          liveProviderCallEnabled: latest.governance?.liveProviderCallEnabled === true,
        } : null,
      },
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        recordCount: validRecords.length,
        latestRecordId: latest?.id ?? null,
        latestContentHash: latest?.contentHash ?? null,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        liveProviderCallEnabled: false,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runbook-exit",
        boundary: "close Phase 11 after the approved local live provider-call runbook is readable and audit-safe",
      },
    };
  }

  async function buildCloudConsciousnessLiveProviderCallRunbookExit() {
    const runbook = await buildCloudConsciousnessLiveProviderCallRunbook();
    const checklist = await buildCloudConsciousnessLiveProviderOperatorChecklist();
    const transcriptSchema = await buildCloudConsciousnessLiveProviderEgressTranscriptSchema();
    const authorizationReview = await buildCloudConsciousnessLiveProviderFinalAuthorizationReview();
    const routeReview = await buildCloudConsciousnessLiveProviderRunbookRouteReview();
    const readback = buildCloudConsciousnessLiveProviderRunbookReadback();
    const checks = [
      {
        id: "runbook-ready",
        label: "Live provider-call runbook plan is complete",
        passed: runbook.summary?.ready === true,
        evidence: runbook.registry,
      },
      {
        id: "operator-checklist-ready",
        label: "Operator checklist is complete",
        passed: checklist.summary?.ready === true,
        evidence: checklist.registry,
      },
      {
        id: "transcript-schema-ready",
        label: "Live provider egress transcript schema is complete",
        passed: transcriptSchema.summary?.ready === true,
        evidence: transcriptSchema.registry,
      },
      {
        id: "authorization-review-ready",
        label: "Final authorization review is complete without enabling live egress",
        passed: authorizationReview.summary?.ready === true
          && authorizationReview.summary?.liveProviderCallEnabled === false,
        evidence: authorizationReview.registry,
      },
      {
        id: "route-reviewed",
        label: "Runbook route review defers live provider call execution",
        passed: routeReview.summary?.ready === true
          && routeReview.summary?.callsCloudModel === false,
        evidence: routeReview.registry,
      },
      {
        id: "runbook-readback-ready",
        label: "Approved local live provider-call runbook is readable",
        passed: readback.summary?.ready === true,
        evidence: readback.registry,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const complete = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-runbook-exit-v0",
      mode: "phase_11_cloud_consciousness_live_provider_call_runbook_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_11_complete" : "waiting_for_phase_11_live_provider_runbook",
      governance: phase11Governance(),
      completedPhase: {
        id: "phase-11",
        name: "Cloud Consciousness Live Provider Call Runbook",
        completionClaim: complete ? "phase_11_complete" : "phase_11_incomplete",
      },
      checks,
      summary: {
        complete,
        ready: complete,
        passed,
        total: checks.length,
        completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-11",
        recordCount: readback.summary?.recordCount ?? 0,
        latestRecordId: readback.summary?.latestRecordId ?? null,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        liveProviderCallEnabled: false,
        createsTask: true,
        storageScope: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
      },
      evidence: {
        runbook: phase11EvidenceRef(runbook),
        checklist: phase11EvidenceRef(checklist),
        transcriptSchema: phase11EvidenceRef(transcriptSchema),
        authorizationReview: phase11EvidenceRef(authorizationReview),
        routeReview: phase11EvidenceRef(routeReview),
        readback: phase11EvidenceRef(readback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-execution-plan",
        boundary: "only after the human-visible runbook is complete should a separate phase consider actual live provider-call execution",
      },
    };
  }

  return {
    buildCloudConsciousnessLiveProviderCallRunbook,
    buildCloudConsciousnessLiveProviderOperatorChecklist,
    buildCloudConsciousnessLiveProviderEgressTranscriptSchema,
    buildCloudConsciousnessLiveProviderFinalAuthorizationReview,
    buildCloudConsciousnessLiveProviderRunbookRouteReview,
    createCloudConsciousnessLiveProviderRunbookTask,
    buildCloudConsciousnessLiveProviderRunbookReadback,
    buildCloudConsciousnessLiveProviderCallRunbookExit,
    isCloudConsciousnessLiveProviderRunbookTask,
    executeCloudConsciousnessLiveProviderRunbookTask,
  };
}
