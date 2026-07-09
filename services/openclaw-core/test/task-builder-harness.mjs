export function createTaskLifecycleHarness(overrides = {}) {
  const calls = [];
  const events = [];
  const fetchUrls = [];
  let taskCounter = 0;
  const deps = {
    fetchJson: async (url) => {
      fetchUrls.push(url);
      return overrides.fetchJson ? overrides.fetchJson(url) : {};
    },
    postJson: async (url, body) => {
      calls.push({ name: "postJson", url, body });
      return overrides.postJson ? overrides.postJson(url, body) : {};
    },
    systemSenseUrl: "http://127.0.0.1:4106",
    evaluatePolicyIntent: (input, context) => ({
      id: `policy-${context.stage}`,
      decision: "require_approval",
      domain: input.policy?.domain ?? "body_internal",
      risk: input.policy?.risk ?? "medium",
      reason: "approval_required",
      approved: false,
      autonomyMode: "guardian",
      autonomous: false,
      input,
      context,
    }),
    createTask: (input, options) => {
      calls.push({ name: "createTask", input, options });
      taskCounter += 1;
      return {
        id: `task-${taskCounter}`,
        phase: "queued",
        ...input,
      };
    },
    createApprovalRequestForTask: (task, policy) => {
      calls.push({ name: "createApprovalRequestForTask", taskId: task.id, policy });
      const approval = {
        id: `approval-${task.id}`,
        status: "pending",
        required: true,
      };
      task.approval = approval;
      return approval;
    },
    supersedeOtherActiveTasks: () => {
      calls.push({ name: "supersedeOtherActiveTasks" });
      return [{ id: "reclaimed-task", type: "old_task", phase: "superseded" }];
    },
    reconcileRuntimeState: () => {
      calls.push({ name: "reconcileRuntimeState" });
    },
    persistState: () => {
      calls.push({ name: "persistState" });
    },
    completeTask: (task, details) => {
      calls.push({ name: "completeTask", taskId: task.id, details });
      return {
        ...task,
        status: "completed",
        outcome: {
          kind: details?.executor ?? "completed",
          details,
        },
      };
    },
    appendTaskPhase: (task, phase, details) => {
      calls.push({ name: "appendTaskPhase", taskId: task.id, phase, details });
      task.phase = phase;
      task.phaseHistory = [
        ...(task.phaseHistory ?? []),
        { phase, details },
      ];
      return task;
    },
    publishEvent: async (name, body) => {
      events.push({ name, body });
    },
    publishTaskApprovalIfPending: async (task) => {
      events.push({ name: "approval.pending", body: { taskId: task.id } });
    },
    serialiseApproval: (approval) => ({
      id: approval.id,
      status: approval.status,
      updatedAt: approval.updatedAt ?? null,
    }),
    serialiseTask: (task) => ({
      id: task.id,
      type: task.type,
      goal: task.goal,
      phase: task.phase,
      approval: task.approval ?? null,
      policy: task.policy ?? null,
      plan: task.plan ?? null,
      nativePluginRuntimeRefresh: task.nativePluginRuntimeRefresh ?? null,
      systemdRepair: task.systemdRepair ?? null,
      systemdNextRepair: task.systemdNextRepair ?? null,
      longTermMemoryWrite: task.longTermMemoryWrite ?? null,
      cloudConsciousnessHandoff: task.cloudConsciousnessHandoff ?? null,
      cloudConsciousnessProviderDryRun: task.cloudConsciousnessProviderDryRun ?? null,
      cloudConsciousnessProviderCallRehearsal: task.cloudConsciousnessProviderCallRehearsal ?? null,
      cloudConsciousnessLiveProviderRunbook: task.cloudConsciousnessLiveProviderRunbook ?? null,
      cloudConsciousnessLiveProviderExecutionPlan: task.cloudConsciousnessLiveProviderExecutionPlan ?? null,
      cloudConsciousnessLiveProviderRuntimeAdapter: task.cloudConsciousnessLiveProviderRuntimeAdapter ?? null,
      cloudConsciousnessLiveProviderRuntimeImplementation: task.cloudConsciousnessLiveProviderRuntimeImplementation ?? null,
      cloudConsciousnessLiveProviderRuntimeAdapterImplementation: task.cloudConsciousnessLiveProviderRuntimeAdapterImplementation ?? null,
      cloudConsciousnessLiveProviderRuntimeAdapterModule: task.cloudConsciousnessLiveProviderRuntimeAdapterModule ?? null,
      cloudConsciousnessLiveProviderRequestBuilder: task.cloudConsciousnessLiveProviderRequestBuilder ?? null,
      cloudConsciousnessLiveProviderCredentialReferenceResolver: task.cloudConsciousnessLiveProviderCredentialReferenceResolver ?? null,
      cloudConsciousnessLiveProviderNoNetworkSender: task.cloudConsciousnessLiveProviderNoNetworkSender ?? null,
      cloudConsciousnessLiveProviderEgressTranscriptRecorder: task.cloudConsciousnessLiveProviderEgressTranscriptRecorder ?? null,
      cloudConsciousnessLiveProviderResponseVerifier: task.cloudConsciousnessLiveProviderResponseVerifier ?? null,
      cloudConsciousnessLiveProviderRollbackNote: task.cloudConsciousnessLiveProviderRollbackNote ?? null,
      cloudConsciousnessLiveProviderRuntimeAdapterClosure: task.cloudConsciousnessLiveProviderRuntimeAdapterClosure ?? null,
      cloudConsciousnessLiveProviderRealLaunch: task.cloudConsciousnessLiveProviderRealLaunch ?? null,
      cloudConsciousnessLiveProviderEgressExecution: task.cloudConsciousnessLiveProviderEgressExecution ?? null,
      cloudConsciousnessLiveProviderCredentialValueAuthorization: task.cloudConsciousnessLiveProviderCredentialValueAuthorization ?? null,
      cloudConsciousnessLiveProviderCredentialValueRead: task.cloudConsciousnessLiveProviderCredentialValueRead ?? null,
      cloudConsciousnessLiveProviderCredentialValueAccessAuthorization: task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorization ?? null,
      cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision: task.cloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecision ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalRead: task.cloudConsciousnessLiveProviderCredentialValueLocalRead ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecution: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecution ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalRead ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttempt: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttempt ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalRead: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalRead ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelope: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelope ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreation: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreation ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecution: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecution ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttempt: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttempt ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalRead ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelope ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreation ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution ?? null,
      cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt: task.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionAttempt ?? null,
      bodyEvidenceLedgerDirectory: task.bodyEvidenceLedgerDirectory ?? null,
      bodyEvidenceLedgerFirstRecord: task.bodyEvidenceLedgerFirstRecord ?? null,
      bodyEvidenceLedgerFollowupRecord: task.bodyEvidenceLedgerFollowupRecord ?? null,
    }),
    serialisePlanForPublic: (plan) => plan,
    setTaskPhase: async (task, phase, patch = {}) => {
      calls.push({ name: "setTaskPhase", taskId: task.id, phase, patch });
      task.phase = phase;
      task.status = patch.status ?? task.status;
    },
    isTaskPolicyApproved: (task) => task.approval?.status === "approved",
    approvals: new Map(),
    profiler: {
      measure: (_name, fn) => fn(),
    },
    buildPhase6Exit: async () => ({
      ok: true,
      registry: "openclaw-phase-6-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-long-term-memory-write-plan" },
    }),
    buildPhase6ConsciousnessContextEnvelope: async () => ({
      ok: true,
      registry: "openclaw-phase-6-consciousness-context-envelope-v0",
      summary: { memoryPointers: 3 },
      envelope: {
        bodyState: {
          healthOk: true,
          serviceCount: 8,
          alerts: [],
        },
      },
    }),
    buildLongTermMemoryExit: async () => ({
      ok: true,
      registry: "openclaw-long-term-memory-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-cloud-consciousness-context-review" },
    }),
    buildLongTermMemoryReadback: () => ({
      ok: true,
      registry: "openclaw-long-term-memory-readback-v0",
      ledger: {
        latest: {
          id: "long-term-memory-record",
          memoryType: "operational_lesson",
          contentHash: "hash-long-term-memory",
        },
      },
      summary: {
        ready: true,
        recordCount: 1,
        latestRecordId: "long-term-memory-record",
        latestContentHash: "hash-long-term-memory",
      },
    }),
    buildTaskSummary: () => ({
      counts: { queued: 1, completed: 2 },
      currentTaskId: null,
      currentTaskStatus: null,
    }),
    compactCloudConsciousnessEvidenceRef: (evidence) => ({
      registry: evidence?.registry ?? null,
      status: evidence?.status ?? null,
      summary: evidence?.summary ?? null,
    }),
    buildCloudConsciousnessExit: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-cloud-consciousness-provider-adapter-plan" },
    }),
    buildCloudConsciousnessHandoffReadback: () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-handoff-readback-v0",
      handoff: {
        latest: {
          id: "cloud-context-handoff-record",
          packageId: "cloud-context-package",
          contentHash: "hash-cloud-handoff",
        },
      },
      summary: {
        ready: true,
        recordCount: 1,
        latestRecordId: "cloud-context-handoff-record",
        latestContentHash: "hash-cloud-handoff",
      },
    }),
    buildCloudConsciousnessProviderAdapterExit: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-adapter-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-cloud-consciousness-real-provider-call-plan" },
    }),
    buildCloudConsciousnessProviderRequestEnvelope: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-request-envelope-v0",
      envelope: {
        id: "cloud-provider-request",
        contentHash: "hash-provider-request",
        sourceHandoff: {
          recordId: "cloud-context-handoff-record",
          contentHash: "hash-cloud-handoff",
          packageId: "cloud-context-package",
        },
        governance: {
          networkCall: false,
          providerCredentialIncluded: false,
          transmitsExternally: false,
        },
      },
      summary: {
        ready: true,
        providerCredentialIncluded: false,
        transmitsExternally: false,
      },
    }),
    buildCloudConsciousnessRealProviderCallExit: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-real-provider-call-exit-v0",
      summary: { complete: true },
      next: { recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runbook" },
    }),
    buildCloudConsciousnessProviderResponseReadback: () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-provider-response-readback-v0",
      summary: {
        ready: true,
        recordCount: 1,
        latestRecordId: "cloud-provider-response-rehearsal",
        latestContentHash: "hash-provider-response",
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
      },
    }),
    buildCloudConsciousnessLiveProviderRunbookReadback: () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-runbook-readback-v0",
      summary: {
        ready: true,
        recordCount: 1,
        latestRecordId: "cloud-live-provider-runbook",
        latestContentHash: "hash-live-provider-runbook",
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        liveProviderCallEnabled: false,
      },
    }),
    buildCloudConsciousnessLiveProviderCallExecutionPlanExit: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-execution-plan-exit-v0",
      summary: {
        complete: true,
        ready: true,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        liveProviderCallEnabled: false,
      },
    }),
    buildCloudConsciousnessLiveProviderFinalAuthorizationReview: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-final-authorization-review-v0",
      summary: {
        ready: true,
        liveProviderCallEnabled: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
      },
    }),
    buildCloudConsciousnessLiveProviderCallExecutionPlan: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-execution-plan-v0",
      summary: {
        ready: true,
        callsCloudModel: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
      },
    }),
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding-v0",
      summary: {
        ready: true,
        endpointContacted: false,
        providerCredentialRead: false,
        credentialValueRead: false,
      },
    }),
    buildCloudConsciousnessLiveProviderExecutionPlanReadback: () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-execution-plan-readback-v0",
      summary: {
        ready: true,
        recordCount: 1,
        latestRecordId: "cloud-live-provider-execution-plan",
        latestContentHash: "hash-live-provider-execution-plan",
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        liveProviderCallEnabled: false,
      },
    }),
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema: async () => ({
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-execution-transcript-schema-v0",
      summary: {
        ready: true,
        requiredFieldCount: 12,
        callsCloudModel: false,
        transmitsExternally: false,
      },
    }),
    phase12EvidenceRef: (evidence) => ({
      registry: evidence?.registry ?? null,
      status: evidence?.status ?? null,
      ready: evidence?.summary?.ready ?? evidence?.summary?.complete ?? null,
      completionPercent: evidence?.summary?.completionPercent ?? null,
    }),
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY: "openclaw-systemd-repair-execution-task-v0",
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY: "openclaw-systemd-next-repair-task-shell-v0",
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY: "openclaw-systemd-next-repair-real-execution-v0",
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT: "openclaw-browser-runtime.service",
    SYSTEMD_REPAIR_RESTART_HELPER: "/run/current-system/sw/bin/openclaw-systemd-restart-openclaw-browser-runtime",
    SYSTEMD_REPAIR_AUTH_DELEGATION: "sudo-nopasswd-fixed-helper",
    LONG_TERM_MEMORY_TASK_REGISTRY: "openclaw-long-term-memory-write-task-v0",
    LONG_TERM_MEMORY_DIR_DISPLAY_PATH: ".artifacts/openclaw-long-term-memory",
    LONG_TERM_MEMORY_FILE_DISPLAY_PATH: ".artifacts/openclaw-long-term-memory/long-term-memory.jsonl",
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY: "openclaw-cloud-consciousness-handoff-task-v0",
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH: ".artifacts/openclaw-cloud-consciousness/context-handoff.jsonl",
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY: "openclaw-cloud-consciousness-provider-dry-run-task-v0",
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH: ".artifacts/openclaw-cloud-consciousness/provider-dry-run.jsonl",
    CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY: "openclaw-cloud-consciousness-real-provider-call-task-v0",
    CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH: ".artifacts/openclaw-cloud-consciousness/provider-response-rehearsal.jsonl",
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY: "openclaw-cloud-consciousness-live-provider-call-runbook-task-v0",
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH: ".artifacts/openclaw-cloud-consciousness/live-provider-call-runbook.jsonl",
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY: "openclaw-cloud-consciousness-live-provider-execution-plan-task-v0",
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH: ".artifacts/openclaw-cloud-consciousness/live-provider-call-execution-plan.jsonl",
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY: "openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0",
    ...overrides.deps,
  };

  return { deps, calls, events, fetchUrls };
}

export function createSystemdDryRunEnvelope(unit = "openclaw-browser-runtime.service") {
  return {
    ok: true,
    registry: "openclaw-systemd-repair-dry-run-v0",
    target: { unit },
    source: {
      inventoryRegistry: "openclaw-systemd-unit-inventory-v0",
      planRegistry: "openclaw-systemd-repair-plan-v0",
    },
    plan: {
      registry: "openclaw-systemd-repair-plan-v0",
      source: { inventoryRegistry: "openclaw-systemd-unit-inventory-v0" },
    },
    dryRun: {
      command: "systemctl",
      args: ["restart", unit],
    },
  };
}
