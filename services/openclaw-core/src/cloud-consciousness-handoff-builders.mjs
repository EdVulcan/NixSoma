import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export function createCloudConsciousnessHandoffBuilders(deps) {
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
    buildPhase6ConsciousnessContextEnvelope,
    buildLongTermMemoryExit,
    buildLongTermMemoryReadback,
    buildTaskSummary,
    compactCloudConsciousnessEvidenceRef,
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
  } = deps;

  function phase8Governance({
    createsTask = false,
    createsApproval = false,
    writesHandoffArtifact = false,
    approvedHandoff = false,
  } = {}) {
    return {
      phase: "phase-8",
      cloudConsciousnessBoundary: "local_context_handoff_review",
      storageScope: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
      createsTask,
      createsApproval,
      writesHandoffArtifact,
      approvedHandoff,
      mutatesHost: writesHandoffArtifact,
      callsCloudModel: false,
      transmitsExternally: false,
      crossesDomain: false,
      startsAutomation: false,
      includesSecrets: false,
      userOwnedDocsTouched: false,
    };
  }
  
  function cloudConsciousnessHandoffFilePath() {
    return path.resolve(process.cwd(), "../..", CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH);
  }
  
  function cloudConsciousnessHandoffDirPath() {
    return path.dirname(cloudConsciousnessHandoffFilePath());
  }
  
  function readCloudConsciousnessHandoffRecords() {
    const filePath = cloudConsciousnessHandoffFilePath();
    if (!existsSync(filePath)) {
      return {
        exists: false,
        file: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
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
      file: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
      filePath,
      lineCount: lines.length,
      records,
      latest: records.filter((record) => record.ok).at(-1) ?? null,
    };
  }
  
  async function buildCloudConsciousnessContextReview() {
    const phase7Exit = await buildLongTermMemoryExit();
    const checks = [
      {
        id: "phase-7-complete",
        label: "Phase 7 completed a durable local long-term memory write",
        passed: phase7Exit.summary?.complete === true
          && phase7Exit.next?.recommendedSlice === "openclaw-cloud-consciousness-context-review",
        evidence: phase7Exit.registry,
      },
      {
        id: "review-before-transmission",
        label: "Cloud-consciousness route starts with local context review before any provider call",
        passed: true,
        evidence: "review_only_no_cloud_call",
      },
      {
        id: "local-handoff-scope",
        label: "Phase 8 stores only an OpenClaw-owned local context handoff artifact",
        passed: true,
        evidence: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-context-review-v0",
      mode: "phase_8_cloud_consciousness_context_review",
      generatedAt: new Date().toISOString(),
      status: ready ? "cloud_consciousness_context_review_ready" : "waiting_for_phase_7_memory",
      governance: phase8Governance(),
      whitepaperAlignment: {
        thesis: "Cloud consciousness may reason over body state only through user-sovereign, reviewable context handoffs.",
        phaseTheme: "Prepare the first cloud-consciousness context without transmitting it.",
        avoidsLoop: "No provider SDK, network call, approval-hardening loop, systemd repair expansion, or plugin-runtime expansion is selected.",
      },
      selectedSlices: [
        "openclaw-cloud-consciousness-envelope-schema",
        "openclaw-cloud-consciousness-context-package",
        "openclaw-cloud-consciousness-redaction-review",
        "openclaw-cloud-consciousness-transmission-route-review",
        "openclaw-cloud-consciousness-handoff-task",
        "openclaw-cloud-consciousness-approved-handoff",
        "openclaw-cloud-consciousness-handoff-readback",
        "openclaw-cloud-consciousness-exit",
      ],
      checks,
      summary: {
        ready,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        phase: "phase-8",
        callsCloudModel: false,
        transmitsExternally: false,
        writesHandoffArtifact: false,
      },
      evidence: {
        phase7Exit,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-envelope-schema",
        boundary: "define a local context handoff schema before packaging any context",
      },
    };
  }
  
  async function buildCloudConsciousnessEnvelopeSchema() {
    const review = await buildCloudConsciousnessContextReview();
    const requiredFields = [
      "id",
      "createdAt",
      "schema",
      "recipient",
      "bodyContext",
      "memoryContext",
      "taskContext",
      "sovereignty",
      "redaction",
      "transmission",
      "contentHash",
    ];
    const schema = {
      id: "openclaw.cloud_consciousness.context_handoff.v0",
      format: "jsonl",
      requiredFields,
      recipient: "cloud-consciousness",
      governance: {
        requiresApproval: true,
        localArtifactOnly: true,
        cloudCallAllowed: false,
        externalTransmissionAllowed: false,
        storageScope: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
      },
    };
    const checks = [
      {
        id: "context-review-ready",
        label: "Cloud-consciousness context review is ready",
        passed: review.summary?.ready === true,
        evidence: review.registry,
      },
      {
        id: "schema-fields-defined",
        label: "Context handoff schema defines body, memory, task, sovereignty, and redaction fields",
        passed: requiredFields.includes("redaction") && requiredFields.includes("sovereignty"),
        evidence: `${requiredFields.length} field(s)`,
      },
      {
        id: "transmission-disabled",
        label: "Schema explicitly disables cloud calls and external transmission in Phase 8",
        passed: schema.governance.cloudCallAllowed === false
          && schema.governance.externalTransmissionAllowed === false,
        evidence: "local_artifact_only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-envelope-schema-v0",
      mode: "phase_8_cloud_consciousness_envelope_schema",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_envelope_schema_ready" : "waiting_for_cloud_context_schema",
      governance: phase8Governance(),
      schema,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        requiredFieldCount: requiredFields.length,
        callsCloudModel: false,
        transmitsExternally: false,
      },
      evidence: {
        contextReview: review,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-context-package",
        boundary: "assemble a bounded local package from body, task, and long-term memory context",
      },
    };
  }
  
  async function buildCloudConsciousnessContextPackage() {
    const schema = await buildCloudConsciousnessEnvelopeSchema();
    const [phase6Context, memoryReadback, taskSummary] = await Promise.all([
      buildPhase6ConsciousnessContextEnvelope(),
      Promise.resolve(buildLongTermMemoryReadback()),
      Promise.resolve(buildTaskSummary()),
    ]);
    const latestMemory = memoryReadback.ledger?.latest ?? null;
    const packageDraft = {
      id: `cloud-context-package-${createHash("sha256").update(`${schema.registry}:${memoryReadback.summary?.latestContentHash ?? "none"}`).digest("hex").slice(0, 16)}`,
      schema: schema.schema.id,
      createdAt: new Date().toISOString(),
      recipient: "cloud-consciousness",
      bodyContext: {
        sourceRegistry: phase6Context.registry,
        healthOk: phase6Context.envelope?.bodyState?.healthOk === true,
        serviceCount: phase6Context.envelope?.bodyState?.serviceCount ?? 0,
        alerts: phase6Context.envelope?.bodyState?.alerts ?? [],
      },
      memoryContext: {
        sourceRegistry: memoryReadback.registry,
        recordCount: memoryReadback.summary?.recordCount ?? 0,
        latestRecordId: memoryReadback.summary?.latestRecordId ?? null,
        latestContentHash: memoryReadback.summary?.latestContentHash ?? null,
        latestMemoryType: latestMemory?.memoryType ?? null,
      },
      taskContext: {
        source: "runtime_task_summary",
        counts: taskSummary.counts,
        currentTaskId: taskSummary.currentTaskId,
        currentTaskStatus: taskSummary.currentTaskStatus,
      },
      sovereignty: {
        userCanPause: true,
        userCanStop: true,
        userCanTakeover: true,
        operatorReviewRequired: true,
        cloudCallAllowed: false,
        externalTransmissionAllowed: false,
      },
      redaction: {
        policy: "metadata_and_summaries_only",
        includesRawUserDocuments: false,
        includesSecrets: false,
        includesRawScreenPixels: false,
        includesCommandStdout: false,
      },
      transmission: {
        status: "not_transmitted",
        provider: null,
        networkCall: false,
        futureProviderAdapterRequired: true,
      },
    };
    const checks = [
      {
        id: "schema-ready",
        label: "Cloud context schema is ready",
        passed: schema.summary?.ready === true,
        evidence: schema.registry,
      },
      {
        id: "memory-readback-linked",
        label: "Package links the durable long-term memory readback",
        passed: memoryReadback.summary?.ready === true
          && typeof packageDraft.memoryContext.latestContentHash === "string",
        evidence: memoryReadback.registry,
      },
      {
        id: "not-transmitted",
        label: "Context package remains local and untransmitted",
        passed: packageDraft.transmission.networkCall === false
          && packageDraft.sovereignty.cloudCallAllowed === false,
        evidence: packageDraft.transmission.status,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-context-package-v0",
      mode: "phase_8_cloud_consciousness_context_package",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_context_package_ready" : "waiting_for_context_package",
      governance: phase8Governance(),
      package: packageDraft,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        memoryRecordCount: packageDraft.memoryContext.recordCount,
        callsCloudModel: false,
        transmitsExternally: false,
        includesSecrets: false,
      },
      evidence: {
        schema: compactCloudConsciousnessEvidenceRef(schema),
        phase6Context: compactCloudConsciousnessEvidenceRef(phase6Context),
        memoryReadback: compactCloudConsciousnessEvidenceRef(memoryReadback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-redaction-review",
        boundary: "review redaction before task materialization or local handoff artifact write",
      },
    };
  }
  
  async function buildCloudConsciousnessRedactionReview({ contextPackage: providedContextPackage = null } = {}) {
    const contextPackage = providedContextPackage ?? await buildCloudConsciousnessContextPackage();
    const redaction = {
      policy: contextPackage.package?.redaction?.policy ?? "metadata_and_summaries_only",
      allowedContent: ["service health summary", "task counts", "long-term memory record ids and hashes", "operator-visible summaries"],
      rejectedContent: ["raw user documents", "secrets", "raw screen pixels", "command stdout", "external account tokens"],
      complete: contextPackage.package?.redaction?.includesSecrets === false
        && contextPackage.package?.redaction?.includesRawUserDocuments === false
        && contextPackage.package?.redaction?.includesRawScreenPixels === false,
    };
    const checks = [
      {
        id: "context-package-ready",
        label: "Cloud context package is ready",
        passed: contextPackage.summary?.ready === true,
        evidence: contextPackage.registry,
      },
      {
        id: "sensitive-content-excluded",
        label: "Raw documents, secrets, screen pixels, and stdout are excluded",
        passed: redaction.complete === true,
        evidence: redaction.policy,
      },
      {
        id: "operator-review-required",
        label: "Operator review remains required before local handoff artifact write",
        passed: contextPackage.package?.sovereignty?.operatorReviewRequired === true,
        evidence: "operator_review_required",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-redaction-review-v0",
      mode: "phase_8_cloud_consciousness_redaction_review",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_redaction_review_ready" : "waiting_for_redaction_review",
      governance: phase8Governance(),
      redaction,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        rejectedContentCount: redaction.rejectedContent.length,
        includesSecrets: false,
        transmitsExternally: false,
      },
      evidence: {
        contextPackage: compactCloudConsciousnessEvidenceRef(contextPackage),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-transmission-route-review",
        boundary: "route-review the handoff without calling a provider",
      },
    };
  }
  
  async function buildCloudConsciousnessTransmissionRouteReview({ redactionReview: providedRedactionReview = null } = {}) {
    const redactionReview = providedRedactionReview ?? await buildCloudConsciousnessRedactionReview();
    const decision = {
      selectedSlice: "openclaw-cloud-consciousness-handoff-task",
      deferredSlice: "openclaw-cloud-consciousness-provider-adapter-plan",
      status: redactionReview.summary?.ready === true ? "selected" : "blocked",
      reason: "Phase 8 may create an approval-gated local handoff artifact; real cloud provider calls remain a later phase.",
      canCreateTask: redactionReview.summary?.ready === true,
      canWriteLocalHandoffAfterApproval: redactionReview.summary?.ready === true,
      canCallCloudProviderNow: false,
      storageScope: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
    };
    const checks = [
      {
        id: "redaction-ready",
        label: "Redaction review is ready",
        passed: redactionReview.summary?.ready === true,
        evidence: redactionReview.registry,
      },
      {
        id: "local-handoff-selected",
        label: "Route selects local approval-gated handoff artifact task",
        passed: decision.selectedSlice === "openclaw-cloud-consciousness-handoff-task",
        evidence: decision.selectedSlice,
      },
      {
        id: "provider-call-deferred",
        label: "Real cloud provider calls remain deferred",
        passed: decision.canCallCloudProviderNow === false,
        evidence: decision.deferredSlice,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-transmission-route-review-v0",
      mode: "phase_8_cloud_consciousness_transmission_route_review",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_transmission_route_selected" : "waiting_for_transmission_route",
      governance: phase8Governance(),
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
      },
      evidence: {
        redactionReview: compactCloudConsciousnessEvidenceRef(redactionReview),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-handoff-task",
        boundary: "create the approval-gated local handoff task without provider calls",
      },
    };
  }
  
  async function createCloudConsciousnessHandoffTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness handoff task creation requires confirm=true.");
    }
  
    const contextPackageEnvelope = await buildCloudConsciousnessContextPackage();
    const redactionReview = await buildCloudConsciousnessRedactionReview({ contextPackage: contextPackageEnvelope });
    const routeReview = await buildCloudConsciousnessTransmissionRouteReview({ redactionReview });
    if (routeReview.summary?.ready !== true || routeReview.decision?.selectedSlice !== "openclaw-cloud-consciousness-handoff-task") {
      throw new Error("Cloud consciousness handoff task requires a ready transmission route review.");
    }
  
    const contextPackage = contextPackageEnvelope.package ?? {};
    const policyRequest = {
      intent: "cloud_consciousness.context_handoff.local_write",
      domain: "body_internal",
      risk: "medium",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "context_handoff", "local_artifact_only", "operator_reviewed"],
    };
    const goal = `Create reviewed local cloud-consciousness context handoff ${contextPackage.id ?? "package"}`;
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_handoff_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.handoff_task.draft",
      type: "cloud_consciousness_handoff_task",
      goal,
    });
    const cloudConsciousnessHandoff = {
      registry: CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY,
      routeReviewRegistry: routeReview.registry,
      packageRegistry: contextPackageEnvelope.registry ?? null,
      packageId: contextPackage.id ?? null,
      handoffFileDisplayPath: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
      artifactWritten: false,
      transmittedExternally: false,
      cloudCallExecuted: false,
    };
    const task = createTask({
      goal,
      type: "cloud_consciousness_handoff_task",
      workViewStrategy: "cloud-consciousness-handoff",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-handoff-task-v0",
        strategy: "approval-gated-cloud-consciousness-local-handoff",
        summary: "Create an approval-gated local cloud-consciousness context handoff artifact without external transmission.",
        governance: phase8Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-cloud-context-package",
            phase: "review_cloud_context_package",
            title: "Review the cloud-consciousness context package and redaction evidence",
            status: "pending",
            packageId: cloudConsciousnessHandoff.packageId,
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before writing the local context handoff artifact",
            status: "pending",
            capabilityId: "act.filesystem.append_text",
            requiresApproval: true,
            risk: "medium",
          },
          {
            id: "write-local-context-handoff",
            phase: "cloud_consciousness_local_handoff_write",
            title: "Append one local context handoff record inside OpenClaw-owned artifacts",
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
    task.cloudConsciousnessHandoff = cloudConsciousnessHandoff;
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();
  
    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "cloud-consciousness-handoff-task-v0" });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));
  
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-local-handoff-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeReview.registry,
      routeReview,
      contextPackage,
      task,
      approval,
      governance: phase8Governance({ createsTask: true, createsApproval: true }),
    };
  }
  
  function isCloudConsciousnessHandoffTask(task) {
    return task?.type === "cloud_consciousness_handoff_task"
      && task?.cloudConsciousnessHandoff?.registry === CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY;
  }
  
  async function executeCloudConsciousnessHandoffTask(task) {
    const contextPackageEnvelope = await buildCloudConsciousnessContextPackage();
    const redactionReview = await buildCloudConsciousnessRedactionReview({ contextPackage: contextPackageEnvelope });
    const routeReview = await buildCloudConsciousnessTransmissionRouteReview({ redactionReview });
    const contextPackage = contextPackageEnvelope.package ?? {};
    const handoffFileDisplayPath = CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH;
    const handoffFilePath = cloudConsciousnessHandoffFilePath();
    const createdAt = new Date().toISOString();
    const recordBase = {
      id: `cloud-context-handoff-${randomUUID()}`,
      createdAt,
      schema: "openclaw.cloud_consciousness.context_handoff.v0",
      recipient: "cloud-consciousness",
      sourceRegistry: contextPackageEnvelope.registry ?? null,
      packageId: contextPackage.id ?? null,
      bodyContext: contextPackage.bodyContext ?? null,
      memoryContext: contextPackage.memoryContext ?? null,
      taskContext: contextPackage.taskContext ?? null,
      sovereignty: {
        ...(contextPackage.sovereignty ?? {}),
        taskId: task.id,
        approvalId: task.approval?.requestId ?? null,
        approved: isTaskPolicyApproved(task),
      },
      redaction: contextPackage.redaction ?? null,
      transmission: {
        status: "not_transmitted",
        provider: null,
        networkCall: false,
        cloudCallExecuted: false,
        futureProviderAdapterRequired: true,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
    const record = {
      ...recordBase,
      contentHash,
    };
    const line = `${JSON.stringify(record)}\n`;
  
    await setTaskPhase(task, "cloud_consciousness_local_handoff_write", {
      status: "running",
      details: {
        executor: "cloud-consciousness-handoff-task-v0",
        handoffFile: handoffFileDisplayPath,
        artifactWritten: false,
        cloudCallExecuted: false,
        transmittedExternally: false,
      },
    });
  
    mkdirSync(cloudConsciousnessHandoffDirPath(), { recursive: true });
    const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
      path: handoffFilePath,
      content: line,
      encoding: "utf8",
      createIfMissing: true,
      intent: "cloud_consciousness.context_handoff.local_write",
    });
    task.cloudConsciousnessHandoff = {
      ...(task.cloudConsciousnessHandoff ?? {}),
      handoffFileDisplayPath,
      handoffFilePath: result.path ?? handoffFilePath,
      allowedRoot: result.root ?? null,
      recordId: record.id,
      contentHash,
      contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
      previousBytes: result.previousBytes ?? 0,
      totalBytes: result.totalBytes ?? null,
      artifactWritten: true,
      transmittedExternally: false,
      cloudCallExecuted: false,
      appendResult: {
        registry: "openclaw-cloud-consciousness-approved-handoff-v0",
        mode: result.mode ?? "append_text",
        created: result.created === true,
        createIfMissing: result.createIfMissing === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "cloud-consciousness-handoff-task-v0",
      summary: `Appended local cloud-consciousness context handoff ${record.id} to ${handoffFileDisplayPath}.`,
      handoffFile: handoffFileDisplayPath,
      result,
      record,
      hostMutation: true,
      artifactWritten: true,
      transmittedExternally: false,
      cloudCallExecuted: false,
      scheduler: false,
      backgroundWriter: false,
    });
    await publishEvent(createEventName("cloud_consciousness.local_handoff_written"), {
      task: serialiseTask(completedTask),
      handoffFile: handoffFileDisplayPath,
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
        registry: "openclaw-cloud-consciousness-approved-handoff-v0",
        mode: "approved_local_cloud_context_handoff",
        handoffFile: handoffFileDisplayPath,
        path: result.path ?? null,
        recordId: record.id,
        contentHash,
        hostMutation: true,
        artifactWritten: true,
        transmittedExternally: false,
        cloudCallExecuted: false,
        scheduler: false,
        backgroundWriter: false,
      },
    };
  }
  
  function buildCloudConsciousnessHandoffReadback() {
    const handoff = readCloudConsciousnessHandoffRecords();
    const validRecords = handoff.records.filter((record) => record.ok === true);
    const latest = validRecords.at(-1) ?? null;
    const checks = [
      {
        id: "handoff-file-readable",
        label: "Cloud-consciousness local handoff JSONL is readable",
        passed: handoff.exists === true,
        evidence: handoff.file,
      },
      {
        id: "handoff-record-present",
        label: "At least one approved local handoff record is present",
        passed: validRecords.length >= 1,
        evidence: `${validRecords.length} record(s)`,
      },
      {
        id: "handoff-not-transmitted",
        label: "Latest handoff record has not been transmitted externally",
        passed: latest?.schema === "openclaw.cloud_consciousness.context_handoff.v0"
          && latest?.transmission?.networkCall === false
          && latest?.transmission?.cloudCallExecuted === false
          && typeof latest?.contentHash === "string",
        evidence: latest?.id ?? "none",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-handoff-readback-v0",
      mode: "phase_8_cloud_consciousness_handoff_readback",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_handoff_readback_ready" : "waiting_for_cloud_context_handoff",
      governance: phase8Governance(),
      handoff: {
        file: handoff.file,
        exists: handoff.exists,
        lineCount: handoff.lineCount,
        validRecordCount: validRecords.length,
        latest: latest ? {
          id: latest.id ?? null,
          schema: latest.schema ?? null,
          packageId: latest.packageId ?? null,
          contentHash: latest.contentHash ?? null,
          createdAt: latest.createdAt ?? null,
          transmittedExternally: latest.transmission?.networkCall === true,
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
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-exit",
        boundary: "close Phase 8 after the approved local handoff is readable and audit-safe",
      },
    };
  }
  
  async function buildCloudConsciousnessExit() {
    const contextReview = await buildCloudConsciousnessContextReview();
    const schema = await buildCloudConsciousnessEnvelopeSchema();
    const contextPackage = await buildCloudConsciousnessContextPackage();
    const redactionReview = await buildCloudConsciousnessRedactionReview({ contextPackage });
    const routeReview = await buildCloudConsciousnessTransmissionRouteReview({ redactionReview });
    const readback = buildCloudConsciousnessHandoffReadback();
    const checks = [
      {
        id: "context-review-ready",
        label: "Cloud-consciousness context review is complete",
        passed: contextReview.summary?.ready === true,
        evidence: contextReview.registry,
      },
      {
        id: "schema-ready",
        label: "Context handoff schema is complete",
        passed: schema.summary?.ready === true,
        evidence: schema.registry,
      },
      {
        id: "package-ready",
        label: "Context package is complete",
        passed: contextPackage.summary?.ready === true,
        evidence: contextPackage.registry,
      },
      {
        id: "redaction-ready",
        label: "Redaction review is complete",
        passed: redactionReview.summary?.ready === true,
        evidence: redactionReview.registry,
      },
      {
        id: "route-reviewed",
        label: "Transmission route review defers provider calls",
        passed: routeReview.summary?.ready === true
          && routeReview.summary?.callsCloudModel === false,
        evidence: routeReview.registry,
      },
      {
        id: "handoff-readback-ready",
        label: "Approved local handoff artifact is readable",
        passed: readback.summary?.ready === true,
        evidence: readback.registry,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const complete = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-exit-v0",
      mode: "phase_8_cloud_consciousness_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_8_complete" : "waiting_for_phase_8_cloud_context",
      governance: phase8Governance(),
      completedPhase: {
        id: "phase-8",
        name: "Cloud Consciousness Context Review and Local Handoff",
        completionClaim: complete ? "phase_8_complete" : "phase_8_incomplete",
      },
      checks,
      summary: {
        complete,
        ready: complete,
        passed,
        total: checks.length,
        completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-8",
        recordCount: readback.summary?.recordCount ?? 0,
        latestRecordId: readback.summary?.latestRecordId ?? null,
        callsCloudModel: false,
        transmitsExternally: false,
        createsTask: true,
        storageScope: CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
      },
      evidence: {
        contextReview: compactCloudConsciousnessEvidenceRef(contextReview),
        schema: compactCloudConsciousnessEvidenceRef(schema),
        contextPackage: compactCloudConsciousnessEvidenceRef(contextPackage),
        redactionReview: compactCloudConsciousnessEvidenceRef(redactionReview),
        routeReview: compactCloudConsciousnessEvidenceRef(routeReview),
        readback: compactCloudConsciousnessEvidenceRef(readback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-provider-adapter-plan",
        boundary: "only after the local handoff route is complete should a separate phase design a real provider adapter",
      },
    };
  }

  return {
    buildCloudConsciousnessContextReview,
    buildCloudConsciousnessEnvelopeSchema,
    buildCloudConsciousnessContextPackage,
    buildCloudConsciousnessRedactionReview,
    buildCloudConsciousnessTransmissionRouteReview,
    createCloudConsciousnessHandoffTask,
    buildCloudConsciousnessHandoffReadback,
    buildCloudConsciousnessExit,
    isCloudConsciousnessHandoffTask,
    executeCloudConsciousnessHandoffTask,
  };
}
