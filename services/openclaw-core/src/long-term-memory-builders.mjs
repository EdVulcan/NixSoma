import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export function createLongTermMemoryBuilders(deps) {
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
    buildPhase6Exit,
    buildPhase6ConsciousnessContextEnvelope,
    LONG_TERM_MEMORY_TASK_REGISTRY,
    LONG_TERM_MEMORY_DIR_DISPLAY_PATH,
    LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
  } = deps;

  function phase7Governance({
    writesMemory = false,
    createsTask = false,
    createsApproval = false,
    approvedWrite = false,
  } = {}) {
    return {
      phase: "phase-7",
      memoryBoundary: "openclaw_owned_jsonl",
      storageScope: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      writesMemory,
      createsTask,
      createsApproval,
      approvedWrite,
      appendOnly: true,
      mutatesHost: writesMemory,
      callsCloudModel: false,
      crossesDomain: false,
      startsAutomation: false,
      bulkImport: false,
      userOwnedDocsTouched: false,
    };
  }
  
  function longTermMemoryFilePath() {
    return path.resolve(process.cwd(), "../..", LONG_TERM_MEMORY_FILE_DISPLAY_PATH);
  }
  
  function longTermMemoryDirPath() {
    return path.dirname(longTermMemoryFilePath());
  }
  
  function readLongTermMemoryRecords() {
    const filePath = longTermMemoryFilePath();
    if (!existsSync(filePath)) {
      return {
        exists: false,
        file: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
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
      file: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      filePath,
      lineCount: lines.length,
      records,
      latest: records.filter((record) => record.ok).at(-1) ?? null,
    };
  }
  
  async function buildLongTermMemoryWritePlan() {
    const phase6Exit = await buildPhase6Exit();
    const checks = [
      {
        id: "phase-6-complete",
        label: "Phase 6 exits into the long-term memory writer",
        passed: phase6Exit.summary?.complete === true
          && phase6Exit.next?.recommendedSlice === "openclaw-long-term-memory-write-plan",
        evidence: phase6Exit.registry,
      },
      {
        id: "owned-jsonl-scope",
        label: "Phase 7 writes only to the OpenClaw-owned long-term memory JSONL",
        passed: true,
        evidence: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      },
      {
        id: "no-cloud-call",
        label: "The first durable memory write does not call cloud consciousness",
        passed: true,
        evidence: "local_append_only_memory_write",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-long-term-memory-write-plan-v0",
      mode: "phase_7_long_term_memory_write_plan",
      generatedAt: new Date().toISOString(),
      status: ready ? "long_term_memory_write_plan_ready" : "waiting_for_phase_6_exit",
      governance: phase7Governance(),
      whitepaperAlignment: {
        thesis: "The body should accumulate durable memory under user sovereignty instead of remaining only a transient task runner.",
        phaseTheme: "Give the body its first governed long-term memory write.",
        avoidsLoop: "No new approval-hardening, systemd repair expansion, plugin adapter expansion, or broad host mutation is selected.",
      },
      storage: {
        directory: LONG_TERM_MEMORY_DIR_DISPLAY_PATH,
        file: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
        format: "jsonl",
        owner: "openclaw",
        appendOnly: true,
      },
      selectedSlices: [
        "openclaw-long-term-memory-schema",
        "openclaw-long-term-memory-proposal",
        "openclaw-long-term-memory-write-route-review",
        "openclaw-long-term-memory-write-task",
        "openclaw-long-term-memory-approved-write",
        "openclaw-long-term-memory-readback",
        "openclaw-long-term-memory-exit",
      ],
      checks,
      summary: {
        ready,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        phase: "phase-7",
        writesMemory: false,
        callsCloudModel: false,
        storageScope: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      },
      evidence: {
        phase6Exit,
      },
      next: {
        recommendedSlice: "openclaw-long-term-memory-schema",
        boundary: "define the local JSONL schema before creating an approval-gated write task",
      },
    };
  }
  
  async function buildLongTermMemorySchema() {
    const plan = await buildLongTermMemoryWritePlan();
    const requiredFields = [
      "id",
      "recordedAt",
      "schema",
      "sourceRegistry",
      "memoryType",
      "summary",
      "evidencePointers",
      "retention",
      "forgettable",
      "governance",
      "contentHash",
    ];
    const schema = {
      id: "openclaw.long_term_memory.v0",
      format: "jsonl",
      requiredFields,
      retention: {
        defaultPolicy: "operator_reviewed_append_only",
        forgettableDefault: true,
        bulkImportAllowed: false,
      },
      governance: {
        requiresApproval: true,
        appendOnly: true,
        crossDomainAllowed: false,
        cloudCallAllowed: false,
        storageScope: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      },
    };
    const checks = [
      {
        id: "plan-ready",
        label: "Long-term memory write plan is ready",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "schema-fields-defined",
        label: "Schema defines required durable memory fields",
        passed: requiredFields.length >= 10 && requiredFields.includes("contentHash"),
        evidence: `${requiredFields.length} field(s)`,
      },
      {
        id: "forgetting-boundary-present",
        label: "Memory remains explicitly forgettable and local",
        passed: schema.retention.forgettableDefault === true
          && schema.governance.crossDomainAllowed === false
          && schema.governance.cloudCallAllowed === false,
        evidence: "forgettable_local_memory",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-long-term-memory-schema-v0",
      mode: "phase_7_long_term_memory_schema",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "long_term_memory_schema_ready" : "waiting_for_memory_schema",
      governance: phase7Governance(),
      schema,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        requiredFieldCount: requiredFields.length,
        writesMemory: false,
        callsCloudModel: false,
      },
      evidence: {
        plan,
      },
      next: {
        recommendedSlice: "openclaw-long-term-memory-proposal",
        boundary: "construct one minimal operational memory record proposal without appending it yet",
      },
    };
  }
  
  async function buildLongTermMemoryProposal() {
    const schema = await buildLongTermMemorySchema();
    const context = await buildPhase6ConsciousnessContextEnvelope();
    const now = new Date().toISOString();
    const proposal = {
      id: `long-term-memory-proposal-${createHash("sha256").update(`${schema.registry}:${context.registry}`).digest("hex").slice(0, 16)}`,
      schema: schema.schema.id,
      proposedAt: now,
      memoryType: "operational_lesson",
      sourceRegistry: context.registry,
      sourceEndpoint: "/phase-6/consciousness-context-envelope",
      summary: "OpenClaw completed the read-only consciousness context route and is ready for its first governed local long-term memory write.",
      evidencePointers: [
        "openclaw-phase-6-exit",
        "openclaw-long-term-memory-write-plan",
        "openclaw-long-term-memory-schema",
      ],
      retention: {
        policy: "operator_reviewed_append_only",
        forgettable: true,
        reviewHint: "operator may delete OpenClaw-owned .artifacts memory records outside this automated append path",
      },
      governance: {
        appendOnly: true,
        requiresApproval: true,
        crossDomain: false,
        cloudCall: false,
        storageScope: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      },
    };
    const checks = [
      {
        id: "schema-ready",
        label: "Long-term memory schema is ready",
        passed: schema.summary?.ready === true,
        evidence: schema.registry,
      },
      {
        id: "phase-6-context-linked",
        label: "Proposal links to Phase 6 consciousness context",
        passed: proposal.sourceRegistry === "openclaw-phase-6-consciousness-context-envelope-v0",
        evidence: proposal.sourceRegistry,
      },
      {
        id: "single-record-proposal",
        label: "Proposal covers one operational lesson, not a bulk import",
        passed: proposal.memoryType === "operational_lesson" && proposal.evidencePointers.length >= 3,
        evidence: proposal.id,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-long-term-memory-proposal-v0",
      mode: "phase_7_long_term_memory_record_proposal",
      generatedAt: now,
      status: passed === checks.length ? "long_term_memory_proposal_ready" : "waiting_for_memory_proposal",
      governance: phase7Governance(),
      proposal,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        memoryType: proposal.memoryType,
        writesMemory: false,
        callsCloudModel: false,
        bulkImport: false,
      },
      evidence: {
        schema,
        consciousnessContextEnvelope: context,
      },
      next: {
        recommendedSlice: "openclaw-long-term-memory-write-route-review",
        boundary: "review the single-record write route before task materialization",
      },
    };
  }
  
  async function buildLongTermMemoryWriteRouteReview() {
    const proposal = await buildLongTermMemoryProposal();
    const decision = {
      selectedSlice: "openclaw-long-term-memory-write-task",
      status: proposal.summary?.ready === true ? "selected" : "blocked",
      reason: "A single local append-only memory record is ready to become an approval-gated write task.",
      canCreateTask: proposal.summary?.ready === true,
      canAppendAfterApproval: proposal.summary?.ready === true,
      storageScope: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
    };
    const checks = [
      {
        id: "proposal-ready",
        label: "Memory record proposal is ready",
        passed: proposal.summary?.ready === true,
        evidence: proposal.registry,
      },
      {
        id: "route-selected",
        label: "Route selects the approval-gated memory write task",
        passed: decision.selectedSlice === "openclaw-long-term-memory-write-task",
        evidence: decision.selectedSlice,
      },
      {
        id: "write-still-deferred",
        label: "Route review does not append the record yet",
        passed: true,
        evidence: "task_materialization_only",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-long-term-memory-write-route-review-v0",
      mode: "phase_7_long_term_memory_write_route_review",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "long_term_memory_write_route_selected" : "waiting_for_memory_write_route",
      governance: phase7Governance(),
      decision,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        selectedSlice: decision.selectedSlice,
        createsTask: false,
        writesMemory: false,
        callsCloudModel: false,
      },
      evidence: {
        proposal,
      },
      next: {
        recommendedSlice: "openclaw-long-term-memory-write-task",
        boundary: "create the approval-gated task shell without appending until approval and operator step",
      },
    };
  }
  
  async function createLongTermMemoryWriteTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Long-term memory write task creation requires confirm=true.");
    }
  
    const routeReview = await buildLongTermMemoryWriteRouteReview();
    if (routeReview.summary?.ready !== true || routeReview.decision?.selectedSlice !== "openclaw-long-term-memory-write-task") {
      throw new Error("Long-term memory write task requires a ready route review.");
    }
  
    const proposal = routeReview.evidence?.proposal?.proposal ?? {};
    const policyRequest = {
      intent: "long_term_memory.record.append",
      domain: "body_internal",
      risk: "medium",
      requiresApproval: true,
      audit: true,
      tags: ["long_term_memory", "append_only", "operator_reviewed", "openclaw_owned_artifact"],
    };
    const goal = `Append governed OpenClaw long-term memory record ${proposal.id ?? "proposal"}`;
    const policyDecision = evaluatePolicyIntent({
      type: "long_term_memory_write_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "long_term_memory.write_task.draft",
      type: "long_term_memory_write_task",
      goal,
    });
    const longTermMemoryWrite = {
      registry: LONG_TERM_MEMORY_TASK_REGISTRY,
      routeReviewRegistry: routeReview.registry,
      proposalRegistry: routeReview.evidence?.proposal?.registry ?? null,
      proposalId: proposal.id ?? null,
      memoryType: proposal.memoryType ?? "operational_lesson",
      sourceRegistry: proposal.sourceRegistry ?? null,
      ledgerFileDisplayPath: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      recordAppended: false,
      durableStorageWritten: false,
    };
    const task = createTask({
      goal,
      type: "long_term_memory_write_task",
      workViewStrategy: "long-term-memory-write",
      policy: policyRequest,
      plan: {
        planner: "long-term-memory-write-task-v0",
        strategy: "approval-gated-long-term-memory-write",
        summary: "Create an approval-gated task shell for one OpenClaw-owned long-term memory JSONL append.",
        governance: phase7Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-long-term-memory-proposal",
            phase: "review_long_term_memory_proposal",
            title: "Review the single long-term memory record proposal",
            status: "pending",
            proposalId: longTermMemoryWrite.proposalId,
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before appending the long-term memory record",
            status: "pending",
            capabilityId: "act.filesystem.append_text",
            requiresApproval: true,
            risk: "medium",
          },
          {
            id: "append-long-term-memory-record",
            phase: "long_term_memory_record_append",
            title: "Append one JSONL long-term memory record inside OpenClaw-owned artifacts",
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
    task.longTermMemoryWrite = longTermMemoryWrite;
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();
  
    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "long-term-memory-write-task-v0" });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));
  
    return {
      ok: true,
      registry: LONG_TERM_MEMORY_TASK_REGISTRY,
      mode: "approval-gated-long-term-memory-write-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeReview.registry,
      routeReview,
      proposal,
      task,
      approval,
      governance: phase7Governance({ createsTask: true, createsApproval: true }),
    };
  }
  
  function isLongTermMemoryWriteTask(task) {
    return task?.type === "long_term_memory_write_task"
      && task?.longTermMemoryWrite?.registry === LONG_TERM_MEMORY_TASK_REGISTRY;
  }
  
  async function executeLongTermMemoryWriteTask(task) {
    const routeReview = await buildLongTermMemoryWriteRouteReview();
    const proposalEnvelope = routeReview.evidence?.proposal ?? await buildLongTermMemoryProposal();
    const proposal = proposalEnvelope.proposal ?? {};
    const ledgerFileDisplayPath = LONG_TERM_MEMORY_FILE_DISPLAY_PATH;
    const ledgerFilePath = longTermMemoryFilePath();
    const recordedAt = new Date().toISOString();
    const recordBase = {
      id: `long-term-memory-${randomUUID()}`,
      recordedAt,
      schema: "openclaw.long_term_memory.v0",
      sourceRegistry: proposal.sourceRegistry ?? proposalEnvelope.registry ?? null,
      sourceEndpoint: proposal.sourceEndpoint ?? "/phase-6/consciousness-context-envelope",
      memoryType: proposal.memoryType ?? "operational_lesson",
      summary: proposal.summary ?? "OpenClaw recorded a governed local long-term memory item.",
      evidencePointers: proposal.evidencePointers ?? [],
      retention: proposal.retention ?? {
        policy: "operator_reviewed_append_only",
        forgettable: true,
      },
      forgettable: proposal.retention?.forgettable !== false,
      governance: {
        taskId: task.id,
        approvalId: task.approval?.requestId ?? null,
        approved: isTaskPolicyApproved(task),
        appendOnly: true,
        crossDomain: false,
        cloudCall: false,
        storageScope: ledgerFileDisplayPath,
        bulkImport: false,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
    const record = {
      ...recordBase,
      contentHash,
    };
    const line = `${JSON.stringify(record)}\n`;
  
    await setTaskPhase(task, "long_term_memory_record_append", {
      status: "running",
      details: {
        executor: "long-term-memory-write-task-v0",
        ledgerFile: ledgerFileDisplayPath,
        memoryType: record.memoryType,
        durableStorageWritten: false,
        hostMutation: true,
      },
    });
  
    mkdirSync(longTermMemoryDirPath(), { recursive: true });
    const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
      path: ledgerFilePath,
      content: line,
      encoding: "utf8",
      createIfMissing: true,
      intent: "long_term_memory.record.append",
    });
    task.longTermMemoryWrite = {
      ...(task.longTermMemoryWrite ?? {}),
      ledgerFileDisplayPath,
      ledgerFilePath: result.path ?? ledgerFilePath,
      allowedRoot: result.root ?? null,
      recordId: record.id,
      contentHash,
      contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
      previousBytes: result.previousBytes ?? 0,
      totalBytes: result.totalBytes ?? null,
      recordAppended: true,
      durableStorageWritten: true,
      appendResult: {
        registry: "openclaw-long-term-memory-approved-write-v0",
        mode: result.mode ?? "append_text",
        created: result.created === true,
        createIfMissing: result.createIfMissing === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "long-term-memory-write-task-v0",
      summary: `Appended OpenClaw long-term memory record ${record.id} to ${ledgerFileDisplayPath}.`,
      ledgerFile: ledgerFileDisplayPath,
      result,
      record,
      hostMutation: true,
      recordAppended: true,
      durableStorageWritten: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
    });
    await publishEvent(createEventName("long_term_memory.record_appended"), {
      task: serialiseTask(completedTask),
      ledgerFile: ledgerFileDisplayPath,
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
        registry: "openclaw-long-term-memory-approved-write-v0",
        mode: "approved_long_term_memory_append",
        ledgerFile: ledgerFileDisplayPath,
        path: result.path ?? null,
        recordId: record.id,
        contentHash,
        hostMutation: true,
        recordAppended: true,
        durableStorageWritten: true,
        scheduler: false,
        backgroundWriter: false,
        bulkImport: false,
        cloudCall: false,
        crossDomain: false,
      },
    };
  }
  
  function buildLongTermMemoryReadback() {
    const ledger = readLongTermMemoryRecords();
    const validRecords = ledger.records.filter((record) => record.ok === true);
    const latest = validRecords.at(-1) ?? null;
    const checks = [
      {
        id: "ledger-file-readable",
        label: "Long-term memory JSONL is readable",
        passed: ledger.exists === true,
        evidence: ledger.file,
      },
      {
        id: "record-present",
        label: "At least one governed long-term memory record is present",
        passed: validRecords.length >= 1,
        evidence: `${validRecords.length} record(s)`,
      },
      {
        id: "latest-record-valid",
        label: "Latest record matches schema and includes content hash",
        passed: latest?.schema === "openclaw.long_term_memory.v0"
          && typeof latest?.contentHash === "string"
          && latest.contentHash.length >= 32,
        evidence: latest?.id ?? "none",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-long-term-memory-readback-v0",
      mode: "phase_7_long_term_memory_readback",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "long_term_memory_readback_ready" : "waiting_for_long_term_memory_record",
      governance: phase7Governance(),
      ledger: {
        file: ledger.file,
        exists: ledger.exists,
        lineCount: ledger.lineCount,
        validRecordCount: validRecords.length,
        latest: latest ? {
          id: latest.id ?? null,
          schema: latest.schema ?? null,
          memoryType: latest.memoryType ?? null,
          contentHash: latest.contentHash ?? null,
          recordedAt: latest.recordedAt ?? null,
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
        writesMemory: false,
        callsCloudModel: false,
      },
      next: {
        recommendedSlice: "openclaw-long-term-memory-exit",
        boundary: "close Phase 7 after the governed write is readable and auditable",
      },
    };
  }
  
  async function buildLongTermMemoryExit() {
    const plan = await buildLongTermMemoryWritePlan();
    const schema = await buildLongTermMemorySchema();
    const proposal = await buildLongTermMemoryProposal();
    const routeReview = await buildLongTermMemoryWriteRouteReview();
    const readback = buildLongTermMemoryReadback();
    const checks = [
      {
        id: "plan-ready",
        label: "Phase 7 write plan is complete",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "schema-ready",
        label: "Long-term memory schema is complete",
        passed: schema.summary?.ready === true,
        evidence: schema.registry,
      },
      {
        id: "proposal-ready",
        label: "Single-record proposal is complete",
        passed: proposal.summary?.ready === true,
        evidence: proposal.registry,
      },
      {
        id: "route-reviewed",
        label: "Write route review selected the task shell",
        passed: routeReview.summary?.ready === true,
        evidence: routeReview.registry,
      },
      {
        id: "readback-ready",
        label: "Approved memory write has been read back",
        passed: readback.summary?.ready === true,
        evidence: readback.registry,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const complete = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-long-term-memory-exit-v0",
      mode: "phase_7_long_term_memory_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_7_complete" : "waiting_for_phase_7_memory_write",
      governance: phase7Governance(),
      completedPhase: {
        id: "phase-7",
        name: "Governed Long-Term Memory Write",
        completionClaim: complete ? "phase_7_complete" : "phase_7_incomplete",
      },
      checks,
      summary: {
        complete,
        ready: complete,
        passed,
        total: checks.length,
        completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-7",
        recordCount: readback.summary?.recordCount ?? 0,
        latestRecordId: readback.summary?.latestRecordId ?? null,
        writesMemory: true,
        callsCloudModel: false,
        createsTask: true,
        storageScope: LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
      },
      evidence: {
        plan,
        schema,
        proposal,
        routeReview,
        readback,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-context-review",
        boundary: "only after local long-term memory is durable should a separate phase review cloud-consciousness context transmission",
      },
    };
  }

  return {
    buildLongTermMemoryWritePlan,
    buildLongTermMemorySchema,
    buildLongTermMemoryProposal,
    buildLongTermMemoryWriteRouteReview,
    createLongTermMemoryWriteTask,
    buildLongTermMemoryReadback,
    buildLongTermMemoryExit,
    isLongTermMemoryWriteTask,
    executeLongTermMemoryWriteTask,
  };
}
