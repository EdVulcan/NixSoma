import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export function createCloudConsciousnessProviderDryRunBuilders(deps) {
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
    buildCloudConsciousnessExit,
    buildCloudConsciousnessHandoffReadback,
    compactCloudConsciousnessEvidenceRef,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
  } = deps;

  function phase9Governance({
    createsTask = false,
    createsApproval = false,
    writesDryRunArtifact = false,
    approvedDryRun = false,
  } = {}) {
    return {
      phase: "phase-9",
      cloudConsciousnessBoundary: "provider_adapter_contract_dry_run",
      storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
      createsTask,
      createsApproval,
      writesDryRunArtifact,
      approvedDryRun,
      mutatesHost: writesDryRunArtifact,
      callsCloudModel: false,
      transmitsExternally: false,
      networkCall: false,
      providerSdkLoaded: false,
      crossesDomain: false,
      startsAutomation: false,
      includesSecrets: false,
      userOwnedDocsTouched: false,
    };
  }

  function cloudConsciousnessProviderDryRunFilePath() {
    return path.resolve(process.cwd(), "../..", CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH);
  }

  function cloudConsciousnessProviderDryRunDirPath() {
    return path.dirname(cloudConsciousnessProviderDryRunFilePath());
  }

  function readCloudConsciousnessProviderDryRunRecords() {
    const filePath = cloudConsciousnessProviderDryRunFilePath();
    if (!existsSync(filePath)) {
      return {
        exists: false,
        file: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
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
      file: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
      filePath,
      lineCount: lines.length,
      records,
      latest: records.filter((record) => record.ok).at(-1) ?? null,
    };
  }

  async function buildCloudConsciousnessProviderAdapterPlan() {
    const phase8Exit = await buildCloudConsciousnessExit();
    const checks = [
      {
        id: "phase-8-complete",
        label: "Phase 8 completed the local cloud-consciousness context handoff",
        passed: phase8Exit.summary?.complete === true
          && phase8Exit.next?.recommendedSlice === "openclaw-cloud-consciousness-provider-adapter-plan",
        evidence: phase8Exit.registry,
      },
      {
        id: "adapter-contract-before-sdk",
        label: "Phase 9 starts with a provider adapter contract before any SDK or network call",
        passed: true,
        evidence: "contract_first_dry_run_only",
      },
      {
        id: "local-dry-run-artifact",
        label: "Provider adapter evidence is stored as a local dry-run transcript",
        passed: true,
        evidence: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-adapter-plan-v0",
      mode: "phase_9_cloud_consciousness_provider_adapter_plan",
      generatedAt: new Date().toISOString(),
      status: ready ? "cloud_consciousness_provider_adapter_plan_ready" : "waiting_for_phase_8_handoff",
      governance: phase9Governance(),
      whitepaperAlignment: {
        thesis: "Cloud consciousness may be connected only through a transparent, user-sovereign adapter contract.",
        phaseTheme: "Define and dry-run a cloud-consciousness provider adapter without external transmission.",
        avoidsLoop: "No real provider call, provider SDK loading, broad approval hardening, or unrelated body-repair expansion is selected.",
      },
      selectedSlices: [
        "openclaw-cloud-consciousness-provider-contract",
        "openclaw-cloud-consciousness-provider-request-envelope",
        "openclaw-cloud-consciousness-provider-dry-run-route-review",
        "openclaw-cloud-consciousness-provider-dry-run-task",
        "openclaw-cloud-consciousness-approved-provider-dry-run",
        "openclaw-cloud-consciousness-provider-dry-run-readback",
        "openclaw-cloud-consciousness-provider-adapter-exit",
      ],
      checks,
      summary: {
        ready,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        phase: "phase-9",
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        writesDryRunArtifact: false,
      },
      evidence: {
        phase8Exit: compactCloudConsciousnessEvidenceRef(phase8Exit),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-provider-contract",
        boundary: "define the adapter contract before request envelope materialization",
      },
    };
  }

  async function buildCloudConsciousnessProviderContract() {
    const plan = await buildCloudConsciousnessProviderAdapterPlan();
    const contract = {
      id: "openclaw.cloud_consciousness.provider_adapter.contract.v0",
      providerKind: "cloud-consciousness",
      transport: "dry-run-local",
      requestSchema: "openclaw.cloud_consciousness.provider_request.v0",
      responseSchema: "openclaw.cloud_consciousness.provider_response_stub.v0",
      requiredMethods: ["prepareRequest", "validateGovernance", "recordDryRunTranscript"],
      forbiddenMethodsInPhase9: ["sendNetworkRequest", "loadProviderSdk", "storeProviderToken"],
      governance: {
        requiresApprovalForDryRunTranscript: true,
        realCloudCallAllowed: false,
        externalTransmissionAllowed: false,
        providerCredentialAllowed: false,
        storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
      },
    };
    const checks = [
      {
        id: "plan-ready",
        label: "Provider adapter plan is ready",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "contract-methods-defined",
        label: "Adapter contract defines request preparation, governance validation, and transcript recording",
        passed: contract.requiredMethods.includes("prepareRequest")
          && contract.requiredMethods.includes("recordDryRunTranscript"),
        evidence: contract.id,
      },
      {
        id: "network-forbidden",
        label: "Contract forbids real cloud calls, SDK loading, credentials, and external transmission",
        passed: contract.governance.realCloudCallAllowed === false
          && contract.governance.externalTransmissionAllowed === false
          && contract.governance.providerCredentialAllowed === false,
        evidence: contract.forbiddenMethodsInPhase9.join(","),
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-contract-v0",
      mode: "phase_9_cloud_consciousness_provider_contract",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_provider_contract_ready" : "waiting_for_provider_contract",
      governance: phase9Governance(),
      contract,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        requiredMethodCount: contract.requiredMethods.length,
        forbiddenMethodCount: contract.forbiddenMethodsInPhase9.length,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
      },
      evidence: {
        plan: compactCloudConsciousnessEvidenceRef(plan),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-provider-request-envelope",
        boundary: "materialize a local provider request envelope from the approved Phase 8 handoff",
      },
    };
  }

  async function buildCloudConsciousnessProviderRequestEnvelope() {
    const contract = await buildCloudConsciousnessProviderContract();
    const handoffReadback = buildCloudConsciousnessHandoffReadback();
    const latest = handoffReadback.handoff?.latest ?? null;
    const envelopeBase = {
      id: `cloud-provider-request-${createHash("sha256").update(`${contract.registry}:${latest?.contentHash ?? "none"}`).digest("hex").slice(0, 16)}`,
      schema: "openclaw.cloud_consciousness.provider_request.v0",
      createdAt: new Date().toISOString(),
      providerKind: "cloud-consciousness",
      transport: "dry-run-local",
      sourceHandoff: {
        registry: handoffReadback.registry,
        recordId: latest?.id ?? null,
        contentHash: latest?.contentHash ?? null,
        packageId: latest?.packageId ?? null,
      },
      request: {
        messages: [
          {
            role: "system",
            content: "OpenClaw provider adapter dry-run. Do not transmit externally.",
          },
          {
            role: "user",
            content: "Summarize body, memory, and task state from the approved local handoff metadata only.",
          },
        ],
        allowedContext: ["body health summary", "task counts", "memory record ids", "content hashes"],
        excludedContext: ["raw user documents", "secrets", "raw screen pixels", "command stdout", "provider credentials"],
      },
      governance: {
        operatorApprovalRequired: true,
        realCloudCallAllowed: false,
        externalTransmissionAllowed: false,
        providerCredentialIncluded: false,
        networkCall: false,
        dryRunTranscriptOnly: true,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(envelopeBase)).digest("hex");
    const envelope = {
      ...envelopeBase,
      contentHash,
    };
    const checks = [
      {
        id: "contract-ready",
        label: "Provider contract is ready",
        passed: contract.summary?.ready === true,
        evidence: contract.registry,
      },
      {
        id: "handoff-linked",
        label: "Request envelope links the approved Phase 8 handoff readback",
        passed: handoffReadback.summary?.ready === true
          && typeof envelope.sourceHandoff.contentHash === "string",
        evidence: handoffReadback.registry,
      },
      {
        id: "dry-run-only",
        label: "Request envelope remains dry-run only with no provider credentials",
        passed: envelope.governance.networkCall === false
          && envelope.governance.providerCredentialIncluded === false
          && envelope.governance.externalTransmissionAllowed === false,
        evidence: envelope.transport,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-request-envelope-v0",
      mode: "phase_9_cloud_consciousness_provider_request_envelope",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_provider_request_envelope_ready" : "waiting_for_provider_request_envelope",
      governance: phase9Governance(),
      envelope,
      checks,
      summary: {
        ready: passed === checks.length,
        passed,
        total: checks.length,
        completionPercent: Math.round((passed / checks.length) * 100),
        sourceHandoffRecordId: envelope.sourceHandoff.recordId,
        contentHash,
        callsCloudModel: false,
        transmitsExternally: false,
        providerCredentialIncluded: false,
      },
      evidence: {
        contract: compactCloudConsciousnessEvidenceRef(contract),
        handoffReadback: compactCloudConsciousnessEvidenceRef(handoffReadback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-provider-dry-run-route-review",
        boundary: "route-review a local provider adapter dry-run transcript before creating a task",
      },
    };
  }

  async function buildCloudConsciousnessProviderDryRunRouteReview() {
    const envelope = await buildCloudConsciousnessProviderRequestEnvelope();
    const decision = {
      selectedSlice: "openclaw-cloud-consciousness-provider-dry-run-task",
      deferredSlice: "openclaw-cloud-consciousness-real-provider-call-plan",
      status: envelope.summary?.ready === true ? "selected" : "blocked",
      reason: "Phase 9 may record an approved local provider adapter dry-run transcript; real provider calls remain deferred.",
      canCreateTask: envelope.summary?.ready === true,
      canWriteDryRunAfterApproval: envelope.summary?.ready === true,
      canCallCloudProviderNow: false,
      storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
    };
    const checks = [
      {
        id: "request-envelope-ready",
        label: "Provider request envelope is ready",
        passed: envelope.summary?.ready === true,
        evidence: envelope.registry,
      },
      {
        id: "dry-run-task-selected",
        label: "Route selects local approval-gated provider dry-run task",
        passed: decision.selectedSlice === "openclaw-cloud-consciousness-provider-dry-run-task",
        evidence: decision.selectedSlice,
      },
      {
        id: "real-call-deferred",
        label: "Real cloud provider calls remain deferred",
        passed: decision.canCallCloudProviderNow === false,
        evidence: decision.deferredSlice,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-dry-run-route-review-v0",
      mode: "phase_9_cloud_consciousness_provider_dry_run_route_review",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_provider_dry_run_route_selected" : "waiting_for_provider_dry_run_route",
      governance: phase9Governance(),
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
        providerSdkLoaded: false,
      },
      evidence: {
        envelope: compactCloudConsciousnessEvidenceRef(envelope),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-provider-dry-run-task",
        boundary: "create the approval-gated dry-run task without provider calls",
      },
    };
  }

  async function createCloudConsciousnessProviderDryRunTask({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness provider dry-run task creation requires confirm=true.");
    }

    const routeReview = await buildCloudConsciousnessProviderDryRunRouteReview();
    if (routeReview.summary?.ready !== true || routeReview.decision?.selectedSlice !== "openclaw-cloud-consciousness-provider-dry-run-task") {
      throw new Error("Cloud consciousness provider dry-run task requires a ready route review.");
    }

    const envelopeReview = await buildCloudConsciousnessProviderRequestEnvelope();
    const envelope = envelopeReview.envelope ?? {};
    const policyRequest = {
      intent: "cloud_consciousness.provider_adapter.dry_run",
      domain: "body_internal",
      risk: "medium",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "provider_adapter", "dry_run_only", "operator_reviewed"],
    };
    const goal = `Record reviewed cloud-consciousness provider adapter dry-run ${envelope.id ?? "request"}`;
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_provider_dry_run_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.provider_dry_run_task.draft",
      type: "cloud_consciousness_provider_dry_run_task",
      goal,
    });
    const providerDryRun = {
      registry: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
      routeReviewRegistry: routeReview.registry,
      requestRegistry: envelopeReview.registry ?? null,
      requestId: envelope.id ?? null,
      dryRunFileDisplayPath: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
      artifactWritten: false,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
    };
    const task = createTask({
      goal,
      type: "cloud_consciousness_provider_dry_run_task",
      workViewStrategy: "cloud-consciousness-provider-dry-run",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-provider-dry-run-task-v0",
        strategy: "approval-gated-cloud-consciousness-provider-adapter-dry-run",
        summary: "Record an approval-gated local provider adapter dry-run transcript without external transmission.",
        governance: phase9Governance({ createsTask: true, createsApproval: true }),
        steps: [
          {
            id: "review-provider-request-envelope",
            phase: "review_provider_request_envelope",
            title: "Review the provider request envelope and governance contract",
            status: "pending",
            requestId: providerDryRun.requestId,
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before writing the local provider dry-run transcript",
            status: "pending",
            capabilityId: "act.filesystem.append_text",
            requiresApproval: true,
            risk: "medium",
          },
          {
            id: "write-provider-dry-run-transcript",
            phase: "cloud_consciousness_provider_dry_run_write",
            title: "Append one local provider adapter dry-run transcript inside OpenClaw-owned artifacts",
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
    task.cloudConsciousnessProviderDryRun = providerDryRun;
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "cloud-consciousness-provider-dry-run-task-v0" });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-provider-dry-run-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeReview.registry,
      routeReview,
      envelope,
      task,
      approval,
      governance: phase9Governance({ createsTask: true, createsApproval: true }),
    };
  }

  function isCloudConsciousnessProviderDryRunTask(task) {
    return task?.type === "cloud_consciousness_provider_dry_run_task"
      && task?.cloudConsciousnessProviderDryRun?.registry === CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY;
  }

  async function executeCloudConsciousnessProviderDryRunTask(task) {
    const routeReview = await buildCloudConsciousnessProviderDryRunRouteReview();
    const envelopeEnvelope = await buildCloudConsciousnessProviderRequestEnvelope();
    const envelope = envelopeEnvelope.envelope ?? {};
    const dryRunFileDisplayPath = CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH;
    const dryRunFilePath = cloudConsciousnessProviderDryRunFilePath();
    const createdAt = new Date().toISOString();
    const responseStub = {
      schema: "openclaw.cloud_consciousness.provider_response_stub.v0",
      status: "dry_run_not_sent",
      summary: "Provider adapter dry-run validated request structure and governance without network transmission.",
      recommendedNextAction: "review transcript before any future real provider-call phase",
    };
    const recordBase = {
      id: `cloud-provider-dry-run-${randomUUID()}`,
      createdAt,
      schema: "openclaw.cloud_consciousness.provider_dry_run.v0",
      adapterContract: "openclaw.cloud_consciousness.provider_adapter.contract.v0",
      requestId: envelope.id ?? null,
      requestContentHash: envelope.contentHash ?? null,
      sourceHandoff: envelope.sourceHandoff ?? null,
      governance: {
        ...(envelope.governance ?? {}),
        taskId: task.id,
        approvalId: task.approval?.requestId ?? null,
        approved: isTaskPolicyApproved(task),
        realCloudCallAllowed: false,
        externalTransmissionAllowed: false,
        networkCall: false,
        providerSdkLoaded: false,
      },
      transcript: {
        preparedRequestSchema: envelope.schema ?? null,
        providerKind: envelope.providerKind ?? "cloud-consciousness",
        transport: "dry-run-local",
        providerEndpoint: null,
        providerCredential: null,
        networkCallAttempted: false,
        transmittedExternally: false,
        cloudCallExecuted: false,
        responseStub,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
    const record = {
      ...recordBase,
      contentHash,
    };
    const line = `${JSON.stringify(record)}\n`;

    await setTaskPhase(task, "cloud_consciousness_provider_dry_run_write", {
      status: "running",
      details: {
        executor: "cloud-consciousness-provider-dry-run-task-v0",
        dryRunFile: dryRunFileDisplayPath,
        artifactWritten: false,
        cloudCallExecuted: false,
        transmittedExternally: false,
        providerSdkLoaded: false,
      },
    });

    mkdirSync(cloudConsciousnessProviderDryRunDirPath(), { recursive: true });
    const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
      path: dryRunFilePath,
      content: line,
      encoding: "utf8",
      createIfMissing: true,
      intent: "cloud_consciousness.provider_adapter.dry_run",
    });
    task.cloudConsciousnessProviderDryRun = {
      ...(task.cloudConsciousnessProviderDryRun ?? {}),
      dryRunFileDisplayPath,
      dryRunFilePath: result.path ?? dryRunFilePath,
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
      appendResult: {
        registry: "openclaw-cloud-consciousness-approved-provider-dry-run-v0",
        mode: result.mode ?? "append_text",
        created: result.created === true,
        createIfMissing: result.createIfMissing === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "cloud-consciousness-provider-dry-run-task-v0",
      summary: `Appended local provider adapter dry-run ${record.id} to ${dryRunFileDisplayPath}.`,
      dryRunFile: dryRunFileDisplayPath,
      result,
      record,
      hostMutation: true,
      artifactWritten: true,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
      scheduler: false,
      backgroundWriter: false,
    });
    await publishEvent(createEventName("cloud_consciousness.provider_dry_run_written"), {
      task: serialiseTask(completedTask),
      dryRunFile: dryRunFileDisplayPath,
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
        registry: "openclaw-cloud-consciousness-approved-provider-dry-run-v0",
        mode: "approved_local_cloud_provider_adapter_dry_run",
        dryRunFile: dryRunFileDisplayPath,
        path: result.path ?? null,
        recordId: record.id,
        contentHash,
        hostMutation: true,
        artifactWritten: true,
        transmittedExternally: false,
        cloudCallExecuted: false,
        providerSdkLoaded: false,
        scheduler: false,
        backgroundWriter: false,
      },
    };
  }

  function buildCloudConsciousnessProviderDryRunReadback() {
    const dryRun = readCloudConsciousnessProviderDryRunRecords();
    const validRecords = dryRun.records.filter((record) => record.ok === true);
    const latest = validRecords.at(-1) ?? null;
    const checks = [
      {
        id: "dry-run-file-readable",
        label: "Provider adapter dry-run JSONL is readable",
        passed: dryRun.exists === true,
        evidence: dryRun.file,
      },
      {
        id: "dry-run-record-present",
        label: "At least one approved local provider dry-run transcript is present",
        passed: validRecords.length >= 1,
        evidence: `${validRecords.length} record(s)`,
      },
      {
        id: "dry-run-not-transmitted",
        label: "Latest dry-run transcript has no provider SDK, cloud call, or external transmission",
        passed: latest?.schema === "openclaw.cloud_consciousness.provider_dry_run.v0"
          && latest?.governance?.networkCall === false
          && latest?.governance?.providerSdkLoaded === false
          && latest?.transcript?.cloudCallExecuted === false
          && latest?.transcript?.transmittedExternally === false
          && typeof latest?.contentHash === "string",
        evidence: latest?.id ?? "none",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-dry-run-readback-v0",
      mode: "phase_9_cloud_consciousness_provider_dry_run_readback",
      generatedAt: new Date().toISOString(),
      status: passed === checks.length ? "cloud_consciousness_provider_dry_run_readback_ready" : "waiting_for_cloud_provider_dry_run",
      governance: phase9Governance(),
      dryRun: {
        file: dryRun.file,
        exists: dryRun.exists,
        lineCount: dryRun.lineCount,
        validRecordCount: validRecords.length,
        latest: latest ? {
          id: latest.id ?? null,
          schema: latest.schema ?? null,
          requestId: latest.requestId ?? null,
          requestContentHash: latest.requestContentHash ?? null,
          contentHash: latest.contentHash ?? null,
          createdAt: latest.createdAt ?? null,
          transmittedExternally: latest.transcript?.transmittedExternally === true,
          cloudCallExecuted: latest.transcript?.cloudCallExecuted === true,
          providerSdkLoaded: latest.governance?.providerSdkLoaded === true,
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
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-provider-adapter-exit",
        boundary: "close Phase 9 after the approved local provider dry-run transcript is readable and audit-safe",
      },
    };
  }

  async function buildCloudConsciousnessProviderAdapterExit() {
    const plan = await buildCloudConsciousnessProviderAdapterPlan();
    const contract = await buildCloudConsciousnessProviderContract();
    const envelope = await buildCloudConsciousnessProviderRequestEnvelope();
    const routeReview = await buildCloudConsciousnessProviderDryRunRouteReview();
    const readback = buildCloudConsciousnessProviderDryRunReadback();
    const checks = [
      {
        id: "provider-plan-ready",
        label: "Cloud-consciousness provider adapter plan is complete",
        passed: plan.summary?.ready === true,
        evidence: plan.registry,
      },
      {
        id: "provider-contract-ready",
        label: "Provider adapter contract is complete",
        passed: contract.summary?.ready === true,
        evidence: contract.registry,
      },
      {
        id: "provider-request-envelope-ready",
        label: "Provider request envelope is complete",
        passed: envelope.summary?.ready === true,
        evidence: envelope.registry,
      },
      {
        id: "dry-run-route-reviewed",
        label: "Dry-run route review defers real provider calls",
        passed: routeReview.summary?.ready === true
          && routeReview.summary?.callsCloudModel === false,
        evidence: routeReview.registry,
      },
      {
        id: "dry-run-readback-ready",
        label: "Approved local provider dry-run transcript is readable",
        passed: readback.summary?.ready === true,
        evidence: readback.registry,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const complete = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-adapter-exit-v0",
      mode: "phase_9_cloud_consciousness_provider_adapter_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_9_complete" : "waiting_for_phase_9_provider_adapter",
      governance: phase9Governance(),
      completedPhase: {
        id: "phase-9",
        name: "Cloud Consciousness Provider Adapter Contract and Dry Run",
        completionClaim: complete ? "phase_9_complete" : "phase_9_incomplete",
      },
      checks,
      summary: {
        complete,
        ready: complete,
        passed,
        total: checks.length,
        completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-9",
        recordCount: readback.summary?.recordCount ?? 0,
        latestRecordId: readback.summary?.latestRecordId ?? null,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        createsTask: true,
        storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
      },
      evidence: {
        plan: compactCloudConsciousnessEvidenceRef(plan),
        contract: compactCloudConsciousnessEvidenceRef(contract),
        envelope: compactCloudConsciousnessEvidenceRef(envelope),
        routeReview: compactCloudConsciousnessEvidenceRef(routeReview),
        readback: compactCloudConsciousnessEvidenceRef(readback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-real-provider-call-plan",
        boundary: "only after the local provider adapter dry-run is complete should a separate phase consider a real provider call",
      },
    };
  }

  return {
    buildCloudConsciousnessProviderAdapterPlan,
    buildCloudConsciousnessProviderContract,
    buildCloudConsciousnessProviderRequestEnvelope,
    buildCloudConsciousnessProviderDryRunRouteReview,
    createCloudConsciousnessProviderDryRunTask,
    buildCloudConsciousnessProviderDryRunReadback,
    buildCloudConsciousnessProviderAdapterExit,
    isCloudConsciousnessProviderDryRunTask,
    executeCloudConsciousnessProviderDryRunTask,
  };
}
