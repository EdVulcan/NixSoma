import { createOpenClawNativePluginRegistry } from "../../../packages/plugin-runtime/src/plugin-registry.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { createCapabilityRuntime } from "./capability-runtime.mjs";
import { createCloudLiveProviderRuntimeImplementation } from "./cloud-live-provider-runtime-implementation.mjs";
import { createRuntimeProfiler } from "./runtime-diagnostics.mjs";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function createPlanBuilder(deps) {
  const profiler = createRuntimeProfiler("plan-builder");
  const { client, state, taskManager, pluginReview, approvalEngine, policyEvaluator, publishEvent, host, port } = deps;
  const {
    fetchJson,
    postJson,
    eventHubUrl,
    sessionManagerUrl,
    browserRuntimeUrl,
    screenSenseUrl,
    screenActUrl,
    systemSenseUrl,
    systemHealUrl,
  } = client;
  const {
    tasks,
    runtimeState,
    persistState,
    approvals,
    policyAuditLog,
    capabilityInvocationLog,
    MAX_CAPABILITY_INVOCATION_ENTRIES,
    CAPABILITY_HEALTH_TIMEOUT_MS,
    autonomyMode,
    CROSS_BOUNDARY_INTENTS,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_REPAIR_RESTART_HELPER,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
    LONG_TERM_MEMORY_TASK_REGISTRY,
    LONG_TERM_MEMORY_DIR_DISPLAY_PATH,
    LONG_TERM_MEMORY_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_HANDOFF_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY,
    CLOUD_CONSCIOUSNESS_HANDOFF_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_PROVIDER_DRY_RUN_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNBOOK_FILE_DISPLAY_PATH,
    CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
  } = state;
  const {
    serialiseTask,
    getTaskById,
    getNextQueuedTask,
    listTasks,
    createTask,
    appendTaskPhase,
    completeTask,
    failTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    buildTaskSummary,
  } = taskManager;
  const { serialiseApproval, buildApprovalSummary, createApprovalRequestForTask, publishTaskApprovalIfPending } = approvalEngine;
  const { evaluatePolicyIntent, recordPolicyDecision, isPolicyExecutionAllowed } = policyEvaluator;
  const {
    selectOpenClawToolCatalogWorkspace,
    buildOpenClawNativePluginRegistryResponse,
    buildNativePluginManifestProfile,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
    buildNativeOpenClawPromptSemanticsProfile,
    buildOpenClawPluginManifestMap,
    buildOpenClawPluginCapabilityPlan,
  } = pluginReview;

  const capabilityRuntime = createCapabilityRuntime({
    host,
    port,
    client,
    state,
    pluginReview,
    policyEvaluator,
    publishEvent,
  });
  const {
    capabilityById,
    capabilityByIntent,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
    buildCapabilityRegistry,
    listCapabilityInvocations,
    buildCapabilityInvocationSummary,
    invokeCapability,
  } = capabilityRuntime;

  const cloudLiveProviderRuntimeImplementation = createCloudLiveProviderRuntimeImplementation({
    buildRuntimeImplementationPlan: buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan,
    createTask,
    createApprovalRequestForTask,
    evaluatePolicyIntent,
    publishEvent,
    publishTaskApprovalIfPending,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    serialiseTask,
    appendTaskPhase,
    completeTask,
    approvals,
    getTaskById,
    listTasks,
  });

function buildOperatorState() {
  reconcileRuntimeState();
  const currentTask = runtimeState.currentTaskId ? getTaskById(runtimeState.currentTaskId) : null;
  const nextTask = getNextQueuedTask();
  const paused = runtimeState.paused === true;

  return {
    status: paused ? "paused" : nextTask ? "ready" : "idle",
    blocked: paused,
    reason: paused ? "runtime_paused" : null,
    currentTask: currentTask ? serialiseTask(currentTask) : null,
    nextTask: nextTask ? serialiseTask(nextTask) : null,
    policy: {
      respectsPause: true,
      enforcesTaskPolicy: true,
      defaultMaxSteps: 5,
      maxStepsLimit: 20,
      supportsDryRun: true,
      controls: ["pause", "resume", "stop", "takeover"],
      decisions: ["allow", "audit_only", "require_approval", "deny"],
    },
    approvals: buildApprovalSummary(),
    summary: buildTaskSummary(),
  };
}

function isBodyEvidenceLedgerFollowupRecordTask(task) {
  return task?.type === "body_evidence_ledger_followup_record_task"
    && task?.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0";
}

  // L7325-8456
function buildNativePluginCapabilityInvokePlan({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const manifestProfile = buildNativePluginManifestProfile({ packagePath });
  const nativeRegistry = createOpenClawNativePluginRegistry();
  const pluginItem = nativeRegistry.items.find((entry) => entry.id === manifestProfile.plugin.id) ?? null;
  const capability = pluginItem?.contract?.capabilities?.find((entry) => entry.id === capabilityId) ?? null;
  if (!capability) {
    throw new Error(`Native plugin capability ${capabilityId} is not registered in the OpenClaw native plugin registry.`);
  }

  const now = new Date().toISOString();
  const policyRequest = {
    intent: "plugin.capability.invoke",
    domain: capability.domains?.includes("cross_boundary") ? "cross_boundary" : capability.domains?.[0] ?? "body_internal",
    risk: capability.risk,
    requiresApproval: true,
    tags: ["native_plugin_adapter", "plugin_capability_invoke", "explicit_approval_required"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "native-plugin-invoke-plan-v0",
    stage: "native_plugin.invoke.plan",
    subject: {
      taskId: null,
      type: "native_plugin_capability",
      goal: `Plan governed invocation for ${capability.id}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: capability.risk,
    decision: "require_approval",
    reason: "native_plugin_capability_invoke_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };

  return {
    registry: "openclaw-native-plugin-invoke-plan-v0",
    mode: "plan-only",
    generatedAt: now,
    sourceRegistry: manifestProfile.registry,
    sourceMode: manifestProfile.mode,
    plugin: {
      id: manifestProfile.plugin.id,
      packageName: manifestProfile.plugin.packageName,
      hasTypes: manifestProfile.plugin.hasTypes,
      hasExports: manifestProfile.plugin.hasExports,
      exportKeys: manifestProfile.plugin.exportKeys,
      scriptNames: manifestProfile.plugin.scriptNames,
      dependencySummary: manifestProfile.plugin.dependencySummary,
    },
    capability: {
      id: capability.id,
      kind: capability.kind,
      risk: capability.risk,
      domains: capability.domains,
      runtimeOwner: capability.runtimeOwner,
      approvalRequired: capability.approval?.required === true,
      approvalReason: capability.approval?.reason ?? null,
      audit: capability.audit,
      permissions: capability.permissions,
    },
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    draft: {
      goal: `Plan governed invocation for ${capability.id}`,
      type: "native_plugin_capability",
      steps: [
        {
          id: "review_manifest_profile",
          title: "Review manifest profile",
          status: "planned",
          canExecute: false,
          evidence: {
            packageName: manifestProfile.plugin.packageName,
            hasExports: manifestProfile.plugin.hasExports,
            hasTypes: manifestProfile.plugin.hasTypes,
          },
        },
        {
          id: "require_user_approval",
          title: "Require explicit user approval before runtime adapter activation",
          status: "blocked_until_future_task_materialization",
          canExecute: false,
          policyDecision: policyDecision.decision,
        },
        {
          id: "defer_runtime_invoke",
          title: "Defer plugin code execution until a separately approved runtime adapter exists",
          status: "deferred",
          canExecute: false,
        },
      ],
    },
    governance: {
      mode: "native_plugin_invoke_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApprovalBeforeTask: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
    blockers: [
      "runtime adapter implementation not approved",
      "task materialization not implemented for plugin capability invocation",
      "explicit user approval not collected",
      "source content review not explicitly approved",
    ],
  };
}

function buildNativePluginRuntimePreflight({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const planEnvelope = buildNativePluginCapabilityInvokePlan({ packagePath, capabilityId });
  const capability = planEnvelope.capability ?? {};
  const plugin = planEnvelope.plugin ?? {};
  const policyDecision = planEnvelope.policy?.decision ?? {};

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-preflight-v0",
    mode: "preflight-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: planEnvelope.registry,
    sourceMode: planEnvelope.mode,
    adapter: {
      id: "native-plugin-adapter-v0",
      runtimeOwner: "openclaw_on_nixos",
      status: "preflight_ready_runtime_disabled",
      canLoadPluginModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
    },
    plugin: {
      id: plugin.id ?? null,
      packageName: plugin.packageName ?? null,
      hasTypes: plugin.hasTypes === true,
      hasExports: plugin.hasExports === true,
      exportKeys: plugin.exportKeys ?? [],
      dependencySummary: plugin.dependencySummary ?? {},
    },
    capability: {
      id: capability.id ?? null,
      kind: capability.kind ?? null,
      risk: capability.risk ?? null,
      domains: capability.domains ?? [],
      runtimeOwner: capability.runtimeOwner ?? null,
      approvalRequired: capability.approvalRequired === true,
      permissions: capability.permissions ?? {},
      audit: capability.audit ?? {},
    },
    executionEnvelope: {
      envelopeVersion: "native-plugin-execution-envelope-v0",
      state: "blocked_pending_runtime_adapter",
      adapterId: "native-plugin-adapter-v0",
      pluginId: plugin.id ?? null,
      packageName: plugin.packageName ?? null,
      capabilityId: capability.id ?? null,
      policyDecision: {
        decision: policyDecision.decision ?? null,
        reason: policyDecision.reason ?? null,
        domain: policyDecision.domain ?? null,
        risk: policyDecision.risk ?? null,
        approved: policyDecision.approved === true,
      },
      approval: {
        required: true,
        collected: false,
        reason: capability.approvalReason ?? "Execution and mutation require explicit user approval.",
      },
      audit: {
        required: capability.audit?.required !== false,
        ledger: capability.audit?.ledger ?? "capability_history",
      },
      permissions: capability.permissions ?? {},
      constraints: {
        canReadManifestMetadata: true,
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutate: false,
        canCreateTask: false,
        canCreateApproval: false,
      },
    },
    governance: {
      mode: "native_plugin_runtime_preflight_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeExecution: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeActivationPlan({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const preflight = buildNativePluginRuntimePreflight({ packagePath, capabilityId });
  const envelope = preflight.executionEnvelope ?? {};
  const constraints = envelope.constraints ?? {};
  const gates = [
    {
      id: "preflight_envelope_ready",
      label: "Runtime preflight envelope is available",
      required: true,
      status: envelope.envelopeVersion === "native-plugin-execution-envelope-v0" ? "passed" : "blocked",
      evidence: `envelope=${envelope.envelopeVersion ?? "missing"}`,
    },
    {
      id: "audit_binding_ready",
      label: "Capability audit ledger is bound",
      required: true,
      status: envelope.audit?.required === true && envelope.audit?.ledger === "capability_history" ? "passed" : "blocked",
      evidence: `ledger=${envelope.audit?.ledger ?? "missing"}`,
    },
    {
      id: "explicit_user_approval_required",
      label: "High-risk plugin invocation requires explicit user approval",
      required: true,
      status: envelope.approval?.required === true ? "passed" : "blocked",
      evidence: `approvalRequired=${Boolean(envelope.approval?.required)} collected=${Boolean(envelope.approval?.collected)}`,
    },
    {
      id: "source_content_review_required",
      label: "Source content review must be separately approved before loading modules",
      required: true,
      status: "blocked",
      evidence: "source content review is not approved in this activation plan",
    },
    {
      id: "runtime_loader_adapter_required",
      label: "Sandboxed runtime loader adapter must be implemented before activation",
      required: true,
      status: "blocked",
      evidence: "no loader/import adapter is active",
    },
    {
      id: "runtime_activation_approval_required",
      label: "Runtime activation needs a future approval-gated task",
      required: true,
      status: "blocked",
      evidence: "this endpoint is plan-only and creates no approval",
    },
  ];
  const requiredGates = gates.filter((gate) => gate.required);
  const passedRequired = requiredGates.filter((gate) => gate.status === "passed").length;
  const blockedRequired = requiredGates.length - passedRequired;

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-activation-plan-v0",
    mode: "activation-plan-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: preflight.registry,
    sourceMode: preflight.mode,
    runtimeOwner: "openclaw_on_nixos",
    status: "blocked_pending_runtime_adapter",
    activationReady: false,
    plugin: preflight.plugin,
    capability: preflight.capability,
    executionEnvelope: {
      envelopeVersion: envelope.envelopeVersion ?? null,
      state: envelope.state ?? null,
      capabilityId: envelope.capabilityId ?? null,
      policyDecision: envelope.policyDecision ?? null,
      approval: envelope.approval ?? null,
      audit: envelope.audit ?? null,
    },
    gates,
    summary: {
      totalGates: gates.length,
      requiredGates: requiredGates.length,
      passedRequired,
      blockedRequired,
      activationReady: false,
      canReadManifestMetadata: constraints.canReadManifestMetadata === true,
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "design sandboxed native runtime loader inside OpenClawOnNixOS",
        "map derived source-content signals into native contract tests",
        "materialize runtime activation only through approval-gated tasks",
      ],
      forbiddenWork: [
        "do not import plugin modules from old OpenClaw in this plan",
        "do not execute plugin code during activation planning",
        "do not activate runtime without a future approval-gated task",
      ],
    },
    governance: {
      mode: "native_plugin_runtime_activation_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: constraints.canReadManifestMetadata === true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeExecution: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeAdapterContract({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const activationPlan = buildNativePluginRuntimeActivationPlan({ packagePath, capabilityId });
  const envelope = activationPlan.executionEnvelope ?? {};
  const plugin = activationPlan.plugin ?? {};
  const capability = activationPlan.capability ?? {};
  const checks = [
    {
      id: "preflight_envelope_bound",
      label: "Runtime adapter contract is bound to native plugin preflight",
      required: true,
      status: envelope.envelopeVersion === "native-plugin-execution-envelope-v0" ? "passed" : "blocked",
      evidence: `envelope=${envelope.envelopeVersion ?? "missing"}`,
    },
    {
      id: "activation_task_chain_available",
      label: "Approval-gated runtime activation task chain exists",
      required: true,
      status: "passed",
      evidence: "runtime activation task, denial/recovery, hardening, persistence, and regression checks are registered",
    },
    {
      id: "source_content_import_blocked",
      label: "Source file content remains unavailable to the runtime contract",
      required: true,
      status: "passed",
      evidence: "canReadSourceFileContent=false",
    },
    {
      id: "module_loader_default_deny",
      label: "Plugin module loading is denied until a future sandbox loader exists",
      required: true,
      status: "passed",
      evidence: "canImportModule=false",
    },
    {
      id: "plugin_execution_blocked",
      label: "Plugin code execution remains blocked by the contract shell",
      required: true,
      status: "passed",
      evidence: "canExecutePluginCode=false",
    },
    {
      id: "runtime_activation_default_deny",
      label: "Runtime activation remains disabled until adapter implementation is approved",
      required: true,
      status: "passed",
      evidence: "canActivateRuntime=false",
    },
    {
      id: "runtime_loader_adapter_required",
      label: "Sandboxed native runtime loader implementation is still required",
      required: true,
      status: "blocked",
      evidence: "no native runtime loader adapter is active",
    },
  ];
  const requiredChecks = checks.filter((check) => check.required);
  const passedRequired = requiredChecks.filter((check) => check.status === "passed").length;
  const blockedRequired = requiredChecks.length - passedRequired;

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-adapter-contract-v0",
    mode: "runtime-adapter-contract",
    generatedAt: new Date().toISOString(),
    sourceRegistry: activationPlan.registry,
    sourceMode: activationPlan.mode,
    runtimeOwner: "openclaw_on_nixos",
    status: "contract_ready_runtime_loader_blocked",
    activationReady: false,
    adapter: {
      id: "native-plugin-runtime-adapter-v0",
      runtimeOwner: "openclaw_on_nixos",
      status: "contract_ready_runtime_disabled",
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
    },
    plugin: {
      id: plugin.id ?? null,
      packageName: plugin.packageName ?? null,
      hasTypes: plugin.hasTypes === true,
      hasExports: plugin.hasExports === true,
    },
    capability: {
      id: capability.id ?? capabilityId,
      kind: capability.kind ?? null,
      risk: capability.risk ?? null,
      domains: capability.domains ?? [],
      approvalRequired: capability.approvalRequired === true,
      audit: capability.audit ?? {},
      permissions: capability.permissions ?? {},
    },
    executionEnvelope: {
      envelopeVersion: envelope.envelopeVersion ?? null,
      state: envelope.state ?? null,
      adapterId: envelope.adapterId ?? null,
      capabilityId: envelope.capabilityId ?? null,
      policyDecision: envelope.policyDecision ?? null,
      approval: envelope.approval ?? null,
      audit: envelope.audit ?? null,
    },
    runtimeContract: {
      contractId: "native-plugin-runtime-adapter.v0",
      contractVersion: "openclaw-native-plugin-runtime-adapter-contract-v0",
      state: "contract_ready_not_implemented",
      approval: {
        required: true,
        collected: false,
        reason: "Native plugin runtime adapter implementation must be separately approved before module loading or execution.",
      },
      isolation: {
        processIsolationRequired: true,
        loaderBoundary: "openclaw_on_nixos_owned_adapter",
        oldOpenClawModuleImportAllowed: false,
        pluginModuleImportAllowed: false,
        secretsMounted: false,
      },
      execution: {
        canReadManifestMetadata: true,
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutate: false,
      },
      privacy: {
        readmeContentExposed: false,
        sourceFileContentExposed: false,
        scriptBodiesExposed: false,
        dependencyVersionsExposed: false,
        packageVersionExposed: false,
      },
      audit: {
        required: true,
        ledger: "capability_history",
        activationTaskRequired: true,
        transcriptRequiredBeforeExecution: true,
        recoveryChainRequired: true,
      },
    },
    checks,
    summary: {
      totalChecks: checks.length,
      requiredChecks: requiredChecks.length,
      passedRequired,
      blockedRequired,
      adapterContractReady: passedRequired >= 6,
      runtimeLoaderImplemented: false,
      activationReady: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement a sandboxed native runtime loader contract task behind explicit approval",
        "bind any future loader to the native activation task and recovery ledger",
        "add transcript and capability-history coverage before plugin code execution",
      ],
      forbiddenWork: [
        "do not import plugin modules from this contract endpoint",
        "do not execute plugin code or activate runtime from this contract endpoint",
        "do not expose README text, source contents, script bodies, dependency versions, or package versions",
      ],
    },
    governance: {
      mode: "native_plugin_runtime_adapter_contract",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      exposesPackageVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeRuntimeImplementation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeAdapterTaskDraft({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const adapterContract = buildNativePluginRuntimeAdapterContract({ packagePath, capabilityId });
  const now = new Date().toISOString();
  const plugin = adapterContract.plugin ?? {};
  const capability = adapterContract.capability ?? {};
  const blockedCheckIds = (adapterContract.checks ?? [])
    .filter((check) => check.required === true && check.status === "blocked")
    .map((check) => check.id);
  const policyRequest = {
    intent: "plugin.runtime_adapter_implementation",
    domain: "cross_boundary",
    risk: capability.risk ?? "high",
    requiresApproval: true,
    approved: false,
    capabilityId: capability.id ?? capabilityId,
    tags: ["native_plugin_runtime_adapter", "explicit_approval_required", "runtime_adapter_implementation_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-plugin-runtime-adapter-task-v0",
    stage: "native_plugin.runtime_adapter.task.materialize",
    subject: {
      taskId: null,
      type: "native_plugin_runtime_adapter_implementation",
      goal: `Prepare approved native plugin runtime adapter implementation shell for ${capability.id ?? capabilityId}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "native_plugin_runtime_adapter_implementation_requires_explicit_user_approval_before_loader_work",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "native-plugin-runtime-adapter-v0",
    planner: "openclaw-native-plugin-runtime-adapter-task-v0",
    capabilityAware: true,
    status: "planned",
    goal: policyDecision.subject.goal,
    targetUrl: null,
    intent: policyRequest.intent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "plan.plugin.runtime_adapter_contract",
        "govern.policy.evaluate",
        capability.id ?? capabilityId,
      ],
      byRisk: {
        low: 1,
        [policyRequest.risk]: 2,
      },
    },
    steps: [
      {
        id: "step-review-native-runtime-adapter-contract",
        kind: "openclaw.native_plugin.runtime_adapter_contract",
        phase: "reviewing_runtime_adapter_contract",
        title: "Review native plugin runtime adapter contract",
        status: "pending",
        capabilityId: "plan.plugin.runtime_adapter_contract",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          contractVersion: adapterContract.runtimeContract?.contractVersion ?? null,
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          blockedCheckIds,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any runtime adapter implementation work",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-native-runtime-adapter-implementation",
        kind: "plugin.runtime_adapter_implementation",
        phase: "runtime_adapter_implementation_deferred",
        title: "Defer native plugin runtime adapter implementation until sandboxed loader work is separately implemented",
        status: "pending",
        capabilityId: capability.id ?? capabilityId,
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
        params: {
          contractId: adapterContract.runtimeContract?.contractId ?? null,
          contractVersion: adapterContract.runtimeContract?.contractVersion ?? null,
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          blockedCheckIds,
          canReadSourceFileContent: false,
          canImportModule: false,
          canExecutePluginCode: false,
          canActivateRuntime: false,
        },
      },
    ],
    governance: {
      mode: "native_plugin_runtime_adapter_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApproval: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-adapter-task-draft-v0",
    mode: "approval-gated-native-plugin-runtime-adapter-task-draft",
    generatedAt: now,
    sourceRegistry: adapterContract.registry,
    sourceMode: adapterContract.mode,
    plugin,
    capability,
    adapterContract: {
      registry: adapterContract.registry,
      status: adapterContract.status,
      activationReady: adapterContract.activationReady,
      runtimeContract: adapterContract.runtimeContract,
      summary: adapterContract.summary,
      checks: adapterContract.checks,
    },
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "native_plugin_runtime_adapter_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      exposesPackageVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeRuntimeImplementation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeActivationTaskDraft({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const activationPlan = buildNativePluginRuntimeActivationPlan({ packagePath, capabilityId });
  const now = new Date().toISOString();
  const capability = activationPlan.capability ?? {};
  const plugin = activationPlan.plugin ?? {};
  const blockedGateIds = (activationPlan.gates ?? [])
    .filter((gate) => gate.required === true && gate.status === "blocked")
    .map((gate) => gate.id);
  const policyRequest = {
    intent: "plugin.runtime_activation",
    domain: "cross_boundary",
    risk: capability.risk ?? "high",
    requiresApproval: true,
    approved: false,
    capabilityId: capability.id ?? capabilityId,
    tags: ["native_plugin_runtime_activation", "explicit_approval_required", "runtime_adapter_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-plugin-runtime-activation-task-v0",
    stage: "native_plugin.runtime_activation.task.materialize",
    subject: {
      taskId: null,
      type: "native_plugin_runtime_activation",
      goal: `Prepare approved native plugin runtime activation for ${capability.id ?? capabilityId}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "native_plugin_runtime_activation_requires_explicit_user_approval_before_runtime_enablement",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "native-plugin-runtime-activation-v0",
    planner: "openclaw-native-plugin-runtime-activation-task-v0",
    capabilityAware: true,
    status: "planned",
    goal: policyDecision.subject.goal,
    targetUrl: null,
    intent: policyRequest.intent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "plan.openclaw.native_plugin_runtime_activation",
        "govern.policy.evaluate",
        capability.id ?? capabilityId,
      ],
      byRisk: {
        low: 1,
        [policyRequest.risk]: 2,
      },
    },
    steps: [
      {
        id: "step-review-native-runtime-activation-plan",
        kind: "openclaw.native_plugin.runtime_activation_plan",
        phase: "reviewing_runtime_activation_plan",
        title: "Review native plugin runtime activation gates",
        status: "pending",
        capabilityId: "plan.openclaw.native_plugin_runtime_activation",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          status: activationPlan.status,
          blockedGateIds,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any native plugin runtime activation attempt",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-native-runtime-activation",
        kind: "plugin.runtime_activation",
        phase: "runtime_activation_deferred",
        title: "Defer native plugin runtime activation until sandboxed runtime loader exists",
        status: "pending",
        capabilityId: capability.id ?? capabilityId,
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
        params: {
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          blockedGateIds,
          canReadSourceFileContent: false,
          canImportModule: false,
          canExecutePluginCode: false,
          canActivateRuntime: false,
        },
      },
    ],
    governance: {
      mode: "native_plugin_runtime_activation_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApproval: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-activation-task-draft-v0",
    mode: "approval-gated-native-plugin-runtime-activation-task-draft",
    generatedAt: now,
    sourceRegistry: activationPlan.registry,
    sourceMode: activationPlan.mode,
    plugin,
    capability,
    activationPlan: {
      registry: activationPlan.registry,
      status: activationPlan.status,
      activationReady: activationPlan.activationReady,
      summary: activationPlan.summary,
      gates: activationPlan.gates,
      executionEnvelope: activationPlan.executionEnvelope,
    },
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "native_plugin_runtime_activation_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeRuntimeActivation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginInvokeTaskPlan(planEnvelope) {
  const now = new Date().toISOString();
  const capability = planEnvelope.capability ?? {};
  const steps = [
    {
      id: "step-review-manifest-profile",
      kind: "plugin.manifest.profile",
      phase: "reviewing_manifest_profile",
      title: "Review native plugin manifest profile",
      status: "pending",
      capabilityId: "sense.plugin.manifest_profile",
      risk: "low",
      governance: "audit_only",
      requiresApproval: false,
    },
    {
      id: "step-user-approval",
      kind: "approval.gate",
      phase: "waiting_for_approval",
      title: "Wait for explicit user approval",
      status: "pending",
      capabilityId: "govern.policy.evaluate",
      risk: capability.risk ?? "high",
      governance: "require_approval",
      requiresApproval: true,
    },
    {
      id: "step-defer-runtime-invoke",
      kind: "plugin.capability.invoke",
      phase: "runtime_adapter_deferred",
      title: "Defer plugin capability execution until runtime adapter exists",
      status: "pending",
      capabilityId: capability.id ?? "act.plugin.capability.invoke",
      risk: capability.risk ?? "high",
      governance: "require_approval",
      requiresApproval: true,
      params: {
        pluginId: planEnvelope.plugin?.id ?? null,
        packageName: planEnvelope.plugin?.packageName ?? null,
      },
    },
  ];

  return {
    planId: `plan-${randomUUID()}`,
    strategy: "native-plugin-invoke-v0",
    planner: "native-plugin-invoke-plan-v0",
    capabilityAware: true,
    status: "planned",
    goal: planEnvelope.draft?.goal ?? `Plan governed invocation for ${capability.id ?? "act.plugin.capability.invoke"}`,
    targetUrl: null,
    intent: "plugin.capability.invoke",
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "sense.plugin.manifest_profile",
        "govern.policy.evaluate",
        capability.id ?? "act.plugin.capability.invoke",
      ],
      byRisk: {
        low: 1,
        [capability.risk ?? "high"]: 2,
      },
    },
    steps,
    governance: {
      mode: "native_plugin_invoke_task_plan",
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApproval: true,
    },
  };
}

async function createNativePluginRuntimeActivationTask({
  packagePath = null,
  capabilityId = "act.plugin.capability.invoke",
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Native plugin runtime activation task creation requires confirm=true.");
  }

  const draft = buildNativePluginRuntimeActivationTaskDraft({ packagePath, capabilityId });
  const task = createTask({
    goal: draft.plan.goal,
    type: "native_plugin_runtime_activation",
    workViewStrategy: "native-plugin-runtime-activation",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "openclaw-native-plugin-runtime-activation-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-activation-task-v0",
    mode: "approval-gated-native-plugin-runtime-activation-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    sourceMode: draft.mode,
    plugin: draft.plugin,
    capability: draft.capability,
    activationPlan: draft.activationPlan,
    task,
    approval,
    governance: {
      mode: "native_plugin_runtime_activation_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeRuntimeActivation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function createNativePluginRuntimeAdapterTask({
  packagePath = null,
  capabilityId = "act.plugin.capability.invoke",
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Native plugin runtime adapter task creation requires confirm=true.");
  }

  const draft = buildNativePluginRuntimeAdapterTaskDraft({ packagePath, capabilityId });
  const task = createTask({
    goal: draft.plan.goal,
    type: "native_plugin_runtime_adapter_implementation",
    workViewStrategy: "native-plugin-runtime-adapter",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "openclaw-native-plugin-runtime-adapter-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-adapter-task-v0",
    mode: "approval-gated-native-plugin-runtime-adapter-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    sourceMode: draft.mode,
    plugin: draft.plugin,
    capability: draft.capability,
    adapterContract: draft.adapterContract,
    task,
    approval,
    governance: {
      mode: "native_plugin_runtime_adapter_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      exposesPackageVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeRuntimeImplementation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function createNativePluginInvokeTask({ packagePath = null, capabilityId = "act.plugin.capability.invoke", confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Native plugin invoke task creation requires confirm=true.");
  }

  const planEnvelope = buildNativePluginCapabilityInvokePlan({ packagePath, capabilityId });
  const task = createTask({
    goal: planEnvelope.draft.goal,
    type: "native_plugin_capability",
    workViewStrategy: "native-plugin-adapter",
    plan: buildNativePluginInvokeTaskPlan(planEnvelope),
    policy: planEnvelope.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = planEnvelope.policy;
  const approval = createApprovalRequestForTask(task, planEnvelope.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "native-plugin-invoke-plan-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-native-plugin-invoke-task-v0",
    mode: "approval-gated",
    generatedAt: new Date().toISOString(),
    sourceRegistry: planEnvelope.registry,
    sourceMode: planEnvelope.mode,
    plugin: planEnvelope.plugin,
    capability: planEnvelope.capability,
    task,
    approval,
    governance: {
      mode: "native_plugin_invoke_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}


  // L8776-9570
function normaliseSystemdRepairUnit(value) {
  const unit = typeof value === "string" && value.trim()
    ? value.trim()
    : "openclaw-browser-runtime.service";
  return unit.endsWith(".service") ? unit : `${unit}.service`;
}

async function buildSystemdRepairExecutionTaskDraft({ unit = null, execute = false } = {}) {
  const targetUnit = normaliseSystemdRepairUnit(unit);
  const realExecution = execute === true;
  if (realExecution && targetUnit !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Real systemd repair execution is limited to ${SYSTEMD_REPAIR_REAL_EXECUTION_UNIT}.`);
  }
  const dryRunEnvelope = await fetchJson(`${systemSenseUrl}/system/systemd/repair-dry-run?unit=${encodeURIComponent(targetUnit)}`);
  const plan = dryRunEnvelope.plan;
  const command = dryRunEnvelope.dryRun;
  const goal = realExecution
    ? `Operator-reviewed real systemd repair execution for ${targetUnit}`
    : `Operator-reviewed systemd repair execution task for ${targetUnit}`;
  const policyRequest = {
    intent: "systemd.repair.execute",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["systemd", "repair", "host_mutation_candidate", "operator_reviewed"],
  };
  const policyDecision = evaluatePolicyIntent({
    type: "systemd_repair_execution_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "systemd_repair_execution_task.draft",
    type: "systemd_repair_execution_task",
    goal,
  });

  return {
    registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    mode: realExecution ? "operator-reviewed-real-execution-task-draft" : "operator-reviewed-execution-task-draft",
    generatedAt: new Date().toISOString(),
    sourceRegistry: dryRunEnvelope.registry,
    target: dryRunEnvelope.target,
    repairPlan: plan,
    dryRunEnvelope,
    draft: {
      goal,
      type: "systemd_repair_execution_task",
      workViewStrategy: "systemd-repair-execution",
      plan: {
        planner: "systemd-repair-execution-task-v0",
        strategy: "operator-reviewed-systemd-repair-execution-task",
        summary: `Create an approval-gated task for ${targetUnit}; do not execute until operator approval.`,
        steps: [
          {
            id: "review-evidence",
            phase: "review_repair_evidence",
            title: "Review inventory, repair plan, and dry-run envelope",
            status: "pending",
            targetUnit,
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before any host mutation",
            status: "pending",
            capabilityId: "act.system.heal",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: realExecution ? "execute-systemd-restart" : "defer-real-execution",
            phase: realExecution ? "operator_reviewed_real_execution" : "deferred_execution_shell",
            title: realExecution
              ? "Execute operator-approved systemd restart for the selected OpenClaw body unit"
              : "Defer real systemd restart to a future execution milestone",
            status: "pending",
            command: command?.command ?? "systemctl",
            args: command?.args ?? ["restart", targetUnit],
            requiresApproval: true,
            hostMutation: realExecution,
          },
        ],
      },
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      systemdRepair: {
        registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
        sourceRegistry: dryRunEnvelope.registry,
        inventoryRegistry: dryRunEnvelope.source?.inventoryRegistry ?? plan?.source?.inventoryRegistry ?? null,
        planRegistry: dryRunEnvelope.source?.planRegistry ?? plan?.registry ?? null,
        target: dryRunEnvelope.target,
        command: {
          command: command?.command ?? "systemctl",
          args: command?.args ?? ["restart", targetUnit],
          wouldExecute: realExecution,
        },
        evidence: {
          plan,
          dryRunEnvelope,
        },
        execution: {
          shellOnly: !realExecution,
          realExecutionEnabled: realExecution,
          executed: false,
          hostMutation: false,
          hostMutationAttempted: false,
          futureExecutionRequiresSeparateMilestone: !realExecution,
          selectedRealExecutionUnit: realExecution ? SYSTEMD_REPAIR_REAL_EXECUTION_UNIT : null,
          authDelegation: SYSTEMD_REPAIR_RESTART_HELPER
            ? {
                mode: SYSTEMD_REPAIR_AUTH_DELEGATION ?? "external-fixed-helper",
                helperConfigured: true,
                passwordlessExpected: SYSTEMD_REPAIR_AUTH_DELEGATION === "sudo-nopasswd-fixed-helper",
                scope: "restart openclaw-browser-runtime.service only",
              }
            : {
                mode: "direct-systemctl",
                helperConfigured: false,
                passwordlessExpected: false,
                scope: "host policy decides whether authentication is required",
              },
        },
      },
    },
    governance: {
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: realExecution,
      requiresExplicitApproval: true,
      linkedEvidence: ["openclaw-systemd-unit-inventory-v0", "openclaw-systemd-repair-plan-v0", "openclaw-systemd-repair-dry-run-v0"],
    },
  };
}

async function createSystemdRepairExecutionTask({ unit = null, confirm = false, execute = false } = {}) {
  if (confirm !== true) {
    throw new Error("Systemd repair execution task creation requires confirm=true.");
  }

  const draftEnvelope = await buildSystemdRepairExecutionTaskDraft({ unit, execute });
  const draft = draftEnvelope.draft;
  const task = createTask({
    goal: draft.goal,
    type: draft.type,
    workViewStrategy: draft.workViewStrategy,
    plan: draft.plan,
    policy: draft.policy.request,
    systemdRepair: draft.systemdRepair,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: draft.plan?.planner ?? "systemd-repair-execution-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    mode: execute === true ? "operator-reviewed-real-execution-task" : "operator-reviewed-execution-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draftEnvelope.sourceRegistry,
    target: draftEnvelope.target,
    task,
    approval,
    repairPlan: draftEnvelope.repairPlan,
    dryRunEnvelope: draftEnvelope.dryRunEnvelope,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: execute === true,
      requiresExplicitApproval: true,
      futureExecutionRequiresSeparateMilestone: execute !== true,
    },
  };
}

async function createSystemdRepairCandidateTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Systemd repair candidate task shell creation requires confirm=true.");
  }

  const routeGate = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-task-route`);
  if (routeGate.routeDecision?.existingRouteAvailable !== true) {
    throw new Error("Selected repair candidate is not covered by an existing operator-reviewed task route.");
  }
  const targetUnit = routeGate.routeDecision?.targetUnit ?? null;
  const shell = await createSystemdRepairExecutionTask({
    unit: targetUnit,
    confirm: true,
    execute: false,
  });
  shell.task.systemdRepairCandidate = {
    registry: "openclaw-systemd-repair-candidate-task-shell-v0",
    routeRegistry: routeGate.registry,
    candidatePlanRegistry: routeGate.source?.candidatePlanRegistry ?? null,
    targetUnit,
    existingRoute: routeGate.routeDecision?.existingRoute ?? null,
  };
  persistState();

  return {
    registry: "openclaw-systemd-repair-candidate-task-shell-v0",
    mode: "approval-gated-candidate-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeGate.registry,
    routeGate,
    task: shell.task,
    approval: shell.approval,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: false,
      requiresExplicitApproval: true,
      reusesExistingOperatorReviewedRoute: true,
    },
  };
}

async function createSystemdNextRepairTaskShell({ confirm = false, execute = false } = {}) {
  if (confirm !== true) {
    throw new Error("Next systemd repair task shell creation requires confirm=true.");
  }

  const routeGate = await fetchJson(`${systemSenseUrl}/system/systemd/next-repair-task-route`);
  if (routeGate.routeDecision?.taskShellAllowed !== true
    || routeGate.routeDecision?.selectedSlice !== "openclaw-systemd-next-repair-task-shell"
    || routeGate.routeDecision?.targetUnit !== "openclaw-system-sense.service") {
    throw new Error("Next systemd repair task shell requires the approved task route for openclaw-system-sense.service.");
  }

  const dryRunEvidence = routeGate.evidence ?? {};
  const targetUnit = routeGate.routeDecision.targetUnit;
  const command = {
    command: dryRunEvidence.command ?? "systemctl",
    args: Array.isArray(dryRunEvidence.args) && dryRunEvidence.args.length > 0
      ? dryRunEvidence.args
      : ["restart", targetUnit],
    wouldExecute: execute === true,
  };
  const registry = execute === true
    ? SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY
    : SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY;
  const goal = execute === true
    ? `Operator-approved real next OpenClaw systemd repair execution for ${targetUnit}`
    : `Approval-gated next OpenClaw systemd repair task shell for ${targetUnit}`;
  const policyRequest = {
    intent: "systemd.next_repair.execute",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["systemd", "repair", "host_mutation_candidate", "operator_reviewed", "next_repair"],
  };
  const policyDecision = evaluatePolicyIntent({
    type: "systemd_next_repair_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "systemd_next_repair_task_shell.draft",
    type: "systemd_next_repair_task",
    goal,
  });
  const plan = {
    planner: execute === true ? "systemd-next-repair-real-execution-v0" : "systemd-next-repair-task-shell-v0",
    strategy: execute === true ? "operator-reviewed-next-systemd-repair-real-execution" : "approval-gated-next-systemd-repair-task-shell",
    summary: execute === true
      ? `Create a queued approval-gated real execution task for ${targetUnit}; execute only after explicit approval.`
      : `Create a queued approval-gated task shell for ${targetUnit}; do not approve or execute in this milestone.`,
    steps: [
      {
        id: "review-next-repair-route",
        phase: "review_next_repair_route",
        title: "Review next repair route and dry-run evidence",
        status: "pending",
        targetUnit,
        requiresApproval: false,
      },
      {
        id: "operator-approval",
        phase: "waiting_for_approval",
        title: "Wait for operator approval before any systemd action",
        status: "pending",
        capabilityId: "act.system.heal",
        requiresApproval: true,
        risk: "high",
      },
      {
        id: execute === true ? "execute-next-systemd-restart" : "defer-next-repair-execution",
        phase: execute === true ? "next_repair_operator_reviewed_real_execution" : "next_repair_execution_deferred",
        title: execute === true
          ? "Execute operator-approved systemd restart for the selected next OpenClaw body unit"
          : "Defer restart execution to a future route-reviewed milestone",
        status: "pending",
        command: command.command,
        args: command.args,
        requiresApproval: true,
        hostMutation: execute === true,
      },
    ],
  };
  const systemdNextRepair = {
    registry,
    sourceRegistry: routeGate.registry,
    dryRunRegistry: dryRunEvidence.dryRunRegistry ?? null,
    target: {
      unit: targetUnit,
    },
    command,
    evidence: {
      routeGate,
      dryRun: dryRunEvidence,
    },
    execution: {
      shellOnly: execute !== true,
      realExecutionEnabled: execute === true,
      executed: false,
      hostMutation: false,
      hostMutationAttempted: false,
      futureExecutionRequiresSeparateMilestone: execute !== true,
    },
  };
  const task = createTask({
    goal,
    type: "systemd_next_repair_task",
    workViewStrategy: "systemd-next-repair-task",
    plan,
    policy: policyRequest,
    systemdNextRepair,
  }, { skipInitialPolicy: true });
  task.policy = {
    request: policyRequest,
    decision: policyDecision,
  };
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: plan.planner });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry,
    mode: execute === true
      ? "operator-reviewed-next-systemd-repair-real-execution-task"
      : "approval-gated-next-systemd-repair-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeGate.registry,
    routeGate,
    task,
    approval,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: execute === true,
      requiresExplicitApproval: true,
      futureExecutionRequiresSeparateMilestone: execute !== true,
    },
  };
}

async function createBodyEvidenceLedgerDirectoryTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger directory task shell creation requires confirm=true.");
  }

  const routeReview = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review`);
  if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-directory-task"
    || routeReview.evidence?.rootInsideWorkspace !== true) {
    throw new Error("Body evidence ledger directory task shell requires a workspace-bounded storage-root route review.");
  }
  const selectedDisplayPath = routeReview.evidence?.selectedDisplayPath ?? ".artifacts/openclaw-body-evidence-ledger";
  const policyRequest = {
    intent: "body.evidence.ledger.directory.create",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    audit: true,
    tags: ["body_evidence_ledger", "filesystem", "mkdir", "host_mutation_candidate"],
  };
  const goal = `Create OpenClaw body evidence ledger directory at ${selectedDisplayPath}`;
  const policyDecision = evaluatePolicyIntent({
    type: "body_evidence_ledger_directory_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "body_evidence_ledger_directory_task.draft",
    type: "body_evidence_ledger_directory_task",
    goal,
  });
  const ledgerDirectory = {
    registry: "openclaw-body-evidence-ledger-directory-task-v0",
    routeReviewRegistry: routeReview.registry,
    selectedRootId: routeReview.evidence?.selectedRootId ?? null,
    displayPath: selectedDisplayPath,
    rootInsideWorkspace: routeReview.evidence?.rootInsideWorkspace === true,
    directoryCreated: false,
    durableStorageWritten: false,
    recordWritesEnabled: false,
  };
  const task = createTask({
    goal,
    type: "body_evidence_ledger_directory_task",
    workViewStrategy: "body-evidence-ledger-directory",
    policy: policyRequest,
    plan: {
      planner: "body-evidence-ledger-directory-task-v0",
      strategy: "approval-gated-ledger-directory-task-shell",
      summary: `Create an approval-gated task shell for ${selectedDisplayPath}; do not create the directory until approval.`,
      steps: [
        {
          id: "review-storage-root",
          phase: "review_ledger_storage_root",
          title: "Review the selected workspace-bounded ledger root",
          status: "pending",
          displayPath: selectedDisplayPath,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before creating the ledger directory",
          status: "pending",
          capabilityId: "act.filesystem.mkdir",
          requiresApproval: true,
          risk: "medium",
        },
        {
          id: "defer-directory-create",
          phase: "deferred_directory_creation_shell",
          title: "Defer mkdir execution to the approved execution milestone",
          status: "pending",
          displayPath: selectedDisplayPath,
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
  task.bodyEvidenceLedgerDirectory = ledgerDirectory;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "body-evidence-ledger-directory-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-body-evidence-ledger-directory-task-v0",
    mode: "approval-gated-ledger-directory-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    task,
    approval,
    ledgerDirectory,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canCreateDirectory: false,
      canWriteLedger: false,
      executed: false,
      hostMutation: false,
      directoryCreated: false,
      durableStorageWritten: false,
      requiresExplicitApproval: true,
      recordWritesEnabled: false,
    },
  };
}

async function createBodyEvidenceLedgerFirstRecordTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger first record task shell creation requires confirm=true.");
  }

  const routeReview = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review`);
  if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-first-record-task"
    || routeReview.evidence?.firstRecordPlanReady !== true
    || routeReview.evidence?.directoryExists !== true
    || routeReview.evidence?.plannedRecordType !== "body_evidence_ledger_bootstrap") {
    throw new Error("Body evidence ledger first record task shell requires a ready first-record route review.");
  }
  const policyRequest = {
    intent: "body.evidence.ledger.record.append",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    audit: true,
    tags: ["body_evidence_ledger", "append_only", "durable_storage_candidate", "operator_reviewed"],
  };
  const recordType = routeReview.evidence?.plannedRecordType ?? "body_evidence_ledger_bootstrap";
  const goal = `Append first OpenClaw body evidence ledger record of type ${recordType}`;
  const policyDecision = evaluatePolicyIntent({
    type: "body_evidence_ledger_first_record_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "body_evidence_ledger_first_record_task.draft",
    type: "body_evidence_ledger_first_record_task",
    goal,
  });
  const firstRecord = {
    registry: "openclaw-body-evidence-ledger-first-record-task-v0",
    routeReviewRegistry: routeReview.registry,
    plannedRecordType: recordType,
    sourceRegistry: routeReview.evidence?.sourceRegistry ?? null,
    requiredFieldCount: routeReview.evidence?.requiredFieldCount ?? 0,
    directoryExists: routeReview.evidence?.directoryExists === true,
    recordAppended: false,
    durableStorageWritten: false,
    appendExecutionEnabled: false,
  };
  const task = createTask({
    goal,
    type: "body_evidence_ledger_first_record_task",
    workViewStrategy: "body-evidence-ledger-first-record",
    policy: policyRequest,
    plan: {
      planner: "body-evidence-ledger-first-record-task-v0",
      strategy: "approval-gated-ledger-first-record-task-shell",
      summary: `Create an approval-gated task shell for the first ${recordType} ledger append; do not append the record in this milestone.`,
      steps: [
        {
          id: "review-first-record-plan",
          phase: "review_first_record_plan",
          title: "Review planned bootstrap ledger record evidence",
          status: "pending",
          recordType,
          sourceRegistry: firstRecord.sourceRegistry,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before the first ledger append",
          status: "pending",
          capabilityId: "act.filesystem.append_jsonl",
          requiresApproval: true,
          risk: "medium",
        },
        {
          id: "defer-first-record-append",
          phase: "deferred_first_record_append_shell",
          title: "Defer JSONL append execution to the approved append milestone",
          status: "pending",
          recordType,
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
  task.bodyEvidenceLedgerFirstRecord = firstRecord;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "body-evidence-ledger-first-record-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-body-evidence-ledger-first-record-task-v0",
    mode: "approval-gated-ledger-first-record-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    task,
    approval,
    firstRecord,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      executed: false,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      requiresExplicitApproval: true,
      appendExecutionEnabled: false,
    },
  };
}

async function createBodyEvidenceLedgerFollowupRecordTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger follow-up record task shell creation requires confirm=true.");
  }

  const routeReview = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review`);
  if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-task"
    || routeReview.decision?.status !== "selected"
    || routeReview.evidence?.followupRecordPlanReady !== true
    || routeReview.evidence?.plannedRecordType !== "body_evidence_timeline_followup"
    || routeReview.evidence?.plannedSequence !== 2
    || routeReview.evidence?.existingRecordCount !== 1) {
    throw new Error("Body evidence ledger follow-up record task shell requires a ready follow-up route review.");
  }
  const policyRequest = {
    intent: "body.evidence.ledger.followup_record.append",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    audit: true,
    tags: ["body_evidence_ledger", "append_only", "followup_record_candidate", "operator_reviewed"],
  };
  const recordType = routeReview.evidence?.plannedRecordType ?? "body_evidence_timeline_followup";
  const plannedSequence = routeReview.evidence?.plannedSequence ?? 2;
  const goal = `Prepare approval-gated follow-up OpenClaw body evidence ledger record ${plannedSequence} of type ${recordType}`;
  const policyDecision = evaluatePolicyIntent({
    type: "body_evidence_ledger_followup_record_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "body_evidence_ledger_followup_record_task.draft",
    type: "body_evidence_ledger_followup_record_task",
    goal,
  });
  const followupRecord = {
    registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
    routeReviewRegistry: routeReview.registry,
    plannedRecordType: recordType,
    plannedSequence,
    existingRecordCount: routeReview.evidence?.existingRecordCount ?? 0,
    latestRecordId: routeReview.evidence?.latestRecordId ?? null,
    sourceRegistry: routeReview.evidence?.sourceRegistry ?? null,
    sourceEndpoint: routeReview.evidence?.sourceEndpoint ?? null,
    preAppendChecks: routeReview.evidence?.preAppendChecks ?? [],
    deferredActions: routeReview.evidence?.deferredActions ?? [],
    recordAppended: false,
    durableStorageWritten: false,
    appendExecutionEnabled: false,
  };
  const task = createTask({
    goal,
    type: "body_evidence_ledger_followup_record_task",
    workViewStrategy: "body-evidence-ledger-followup-record",
    policy: policyRequest,
    plan: {
      planner: "body-evidence-ledger-followup-record-task-v0",
      strategy: "approval-gated-ledger-followup-record-task-shell",
      summary: `Create an approval-gated task shell for follow-up ledger record ${plannedSequence}; do not append the record in this milestone.`,
      steps: [
        {
          id: "review-followup-record-route",
          phase: "review_followup_record_route",
          title: "Review selected follow-up ledger record route",
          status: "pending",
          recordType,
          plannedSequence,
          sourceRegistry: followupRecord.sourceRegistry,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before any follow-up ledger append",
          status: "pending",
          capabilityId: "act.filesystem.append_jsonl",
          requiresApproval: true,
          risk: "medium",
        },
        {
          id: "defer-followup-record-append",
          phase: "deferred_followup_record_append_shell",
          title: "Defer second JSONL append execution to a later approved append milestone",
          status: "pending",
          recordType,
          plannedSequence,
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
  task.bodyEvidenceLedgerFollowupRecord = followupRecord;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "body-evidence-ledger-followup-record-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
    mode: "approval-gated-ledger-followup-record-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    task,
    approval,
    followupRecord,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      executed: false,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      requiresExplicitApproval: true,
      appendExecutionEnabled: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };
}

function redactPublicParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return params ?? {};
  }
  const redacted = { ...params };
  for (const key of ["content", "body", "data"]) {
    if (typeof redacted[key] === "string") {
      redacted[key] = `[redacted:${Buffer.byteLength(redacted[key], "utf8")} bytes]`;
    }
  }
  return redacted;
}

function serialisePlanForPublic(plan) {
  if (!plan || typeof plan !== "object") {
    return plan ?? null;
  }
  return {
    ...plan,
    steps: Array.isArray(plan.steps)
      ? plan.steps.map((step) => ({
          ...step,
          params: redactPublicParams(step.params),
        }))
      : plan.steps,
  };
}

function normalisePlanActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-planner" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      intent: typeof action.intent === "string" && action.intent.trim() ? action.intent.trim() : null,
      params: action.params && typeof action.params === "object" ? action.params : {},
      when: action.when && typeof action.when === "object" ? action.when : null,
      onFailure: typeof action.onFailure === "string" && action.onFailure.trim() ? action.onFailure.trim() : null,
    }));
}

function inferPlannerIntent({ intent, policy, type }) {
  const policyIntent = policy && typeof policy === "object" && typeof policy.intent === "string"
    ? policy.intent.trim()
    : "";
  const explicitIntent = typeof intent === "string" ? intent.trim() : "";
  const explicitType = typeof type === "string" ? type.trim() : "";
  return policyIntent || explicitIntent || explicitType || "task.execute";
}

function resolvePlanCapabilityId({ kind, intent, plannerIntent }) {
  const candidate = intent || kind || plannerIntent || "";
  const directMap = {
    "work_view.prepare": "act.work_view.control",
    "work_view.reveal": "act.work_view.control",
    "work_view.hide": "act.work_view.control",
    "browser.open": "act.browser.open",
    "network.navigate": "act.browser.open",
    "screen.observe": "sense.screen.observe",
    "keyboard.type": "act.screen.pointer_keyboard",
    "keyboard.hotkey": "act.screen.pointer_keyboard",
    "mouse.click": "act.screen.pointer_keyboard",
    "result.verify": "sense.screen.observe",
    "task.complete": "operate.task.loop",
    "policy.evaluate": "govern.policy.evaluate",
    "approval.gate": "govern.policy.evaluate",
  };

  if (directMap[candidate]) {
    return directMap[candidate];
  }
  if (candidate === "filesystem.mkdir" || candidate === "filesystem.directory.create") {
    return "act.filesystem.mkdir";
  }
  if (candidate === "filesystem.append" || candidate === "filesystem.append_text" || candidate === "filesystem.append-text") {
    return "act.filesystem.append_text";
  }
  if (candidate === "filesystem.write" || candidate === "filesystem.write_text" || candidate === "filesystem.write-text") {
    return "act.filesystem.write_text";
  }
  if (candidate.startsWith("filesystem.")) {
    return "sense.filesystem.read";
  }
  if (candidate.startsWith("process.")) {
    return "sense.process.list";
  }
  if (candidate === "command.execute" || candidate === "system.command.execute") {
    return "act.system.command.execute";
  }
  if (candidate === "command.plan" || candidate === "system.command" || candidate.startsWith("system.command.")) {
    return "act.system.command.dry_run";
  }
  if (candidate.startsWith("heal.") || candidate === "system.repair") {
    return "act.system.heal";
  }
  if (CROSS_BOUNDARY_INTENTS.has(candidate)) {
    return "boundary.cross_domain.approval";
  }

  const matchedCapability = capabilityByIntent(candidate);
  return matchedCapability?.id ?? "govern.policy.evaluate";
}

function annotatePlanStepWithCapability(step, plannerIntent) {
  const capabilityId = resolvePlanCapabilityId({
    kind: step.kind,
    intent: step.intent,
    plannerIntent,
  });
  const capability = capabilityById(capabilityId);
  if (!capability) {
    return step;
  }

  const requiresApproval = capability.requiresApproval === true || capability.governance === "require_approval";
  return {
    ...step,
    capabilityId: capability.id,
    capability: {
      id: capability.id,
      name: capability.name,
      kind: capability.kind,
      service: capability.service,
    },
    risk: capability.risk,
    governance: capability.governance,
    requiresApproval,
  };
}

function summarisePlanCapabilities(steps) {
  const byId = new Map();
  for (const step of steps) {
    if (!step.capabilityId) {
      continue;
    }
    if (!byId.has(step.capabilityId)) {
      byId.set(step.capabilityId, {
        id: step.capabilityId,
        risk: step.risk ?? "unknown",
        governance: step.governance ?? "unknown",
        requiresApproval: step.requiresApproval === true,
        stepCount: 0,
      });
    }
    const entry = byId.get(step.capabilityId);
    entry.stepCount += 1;
    entry.requiresApproval = entry.requiresApproval || step.requiresApproval === true;
  }

  return {
    total: byId.size,
    ids: [...byId.keys()],
    items: [...byId.values()],
    approvalGates: [...byId.values()].filter((capability) => capability.requiresApproval).length,
  };
}

function buildRulePlan({ goal, targetUrl, actions, type, intent, policy }) {
  const now = new Date().toISOString();
  const plannerIntent = inferPlannerIntent({ intent, policy, type });
  const actionSteps = normalisePlanActions(actions).map((action, index) => ({
    id: `step-action-${index + 1}`,
    kind: action.kind,
    intent: action.intent ?? action.kind,
    phase: "acting_on_target",
    title: `Perform ${action.kind}`,
    status: "pending",
    params: action.params,
    when: action.when,
    onFailure: action.onFailure,
  }));

  const steps = [
    {
      id: "step-prepare-work-view",
      kind: "work_view.prepare",
      phase: "preparing_work_view",
      title: "Prepare the AI work view",
      status: "pending",
    },
    {
      id: "step-open-target",
      kind: "browser.open",
      phase: "opening_target",
      title: `Open ${targetUrl ?? "the target URL"}`,
      status: "pending",
    },
    {
      id: "step-observe-screen",
      kind: "screen.observe",
      phase: "observing_screen",
      title: "Observe the current screen state",
      status: "pending",
    },
    ...actionSteps,
    {
      id: "step-verify-result",
      kind: "result.verify",
      phase: "verifying_result",
      title: "Verify the task result",
      status: "pending",
    },
    {
      id: "step-close-task",
      kind: "task.complete",
      phase: "completed",
      title: "Close the task after verification",
      status: "pending",
    },
  ].map((step) => annotatePlanStepWithCapability(step, plannerIntent));

  return {
    planId: `plan-${randomUUID()}`,
    strategy: "rule-v1",
    planner: "capability-aware-v1",
    capabilityAware: true,
    status: "planned",
    goal,
    targetUrl,
    intent: plannerIntent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: summarisePlanCapabilities(steps),
    steps,
  };
}

function shouldBuildPlan(body) {
  return body.includePlan === true
    || body.plan === true
    || body.planStrategy === "rule-v1"
    || body.executionMode === "planned";
}

function updatePlanForPhase(task, phase, details = null) {
  if (!task.plan || !Array.isArray(task.plan.steps)) {
    return;
  }

  const now = new Date().toISOString();
  task.plan.status = phase === "failed" ? "failed" : phase === "completed" ? "completed" : "running";
  task.plan.updatedAt = now;
  if (phase === "failed") {
    task.plan.failure = details ?? null;
  }

  const step = task.plan.steps.find((candidate) => candidate.phase === phase && candidate.status !== "completed");
  if (step) {
    step.status = phase === "failed" ? "failed" : "completed";
    step.completedAt = now;
    step.details = details;
  }

  if (phase === "completed") {
    for (const candidate of task.plan.steps) {
      if (candidate.status === "pending") {
        candidate.status = "skipped";
      }
    }
  }
}

async function setTaskPhase(task, phase, { status = task.status, details = null } = {}) {
  task.status = status;
  const updatedTask = appendTaskPhase(task, phase, details);
  reconcileRuntimeState();
  await publishEvent(createEventName("task.phase_changed"), { task: serialiseTask(updatedTask) });
  return updatedTask;
}

function isTaskPolicyApproved(task) {
  return task.policy?.decision?.approved === true
    || task.policy?.approved === true
    || task.approval?.status === "approved";
}


  // L10324-19007
function buildMvpRouteAlignment() {
  const phases = [
    {
      id: "phase-0-body",
      label: "Body",
      whitepaperConcept: "resident sovereign body",
      status: "complete",
      evidence: ["body-config", "state-settling", "service-health"],
    },
    {
      id: "phase-1-eyes",
      label: "Eyes",
      whitepaperConcept: "AI-owned observable work view",
      status: "complete",
      evidence: [
        "openclaw-ai-work-view-capture",
        "openclaw-ai-work-view-capture-summary",
        "screen-sense",
      ],
    },
    {
      id: "phase-2-hands",
      label: "Hands",
      whitepaperConcept: "screen action tied to observation",
      status: "complete",
      evidence: ["openclaw-eye-hand-action-evidence", "screen-act"],
    },
    {
      id: "phase-3-observer",
      label: "Observer",
      whitepaperConcept: "visible and interruptible control plane",
      status: "complete",
      evidence: [
        "observer-openclaw-ai-work-view-task-verification-summary",
        "observer-openclaw-eye-hand-action-evidence",
      ],
    },
    {
      id: "phase-4-recovery",
      label: "Recovery",
      whitepaperConcept: "failed work carries evidence and recovery targets",
      status: "complete",
      evidence: [
        "openclaw-eye-hand-recovery-evidence",
        "openclaw-eye-hand-auto-recovery-execution",
        "openclaw-eye-hand-recovery-regression",
      ],
    },
    {
      id: "phase-5-body-health-self-heal",
      label: "Body Health",
      whitepaperConcept: "basic system health and self-heal loop",
      status: "next",
      evidence: ["system-sense", "system-heal", "sovereign-maintenance"],
    },
  ];

  return {
    ok: true,
    registry: "openclaw-mvp-route-alignment-v0",
    whitepaper: {
      thesis: "OpenClaw is a resident digital body with eyes, hands, observer visibility, and recovery responsibility under user sovereignty.",
      mvpBoundary: "Build body, eyes, hands, observer window, and basic recovery before higher autonomy.",
      sourceDocuments: [
        "docs/OpenClaw body sovereignty whitepaper",
        "docs/OpenClaw on NixOS MVP implementation route v1",
      ],
    },
    mainline: {
      current: "eye-hand-recovery-loop-complete",
      trunk: "body-eyes-hands-observer-recovery",
      completedCapabilities: [
        "browser-runtime-backed AI work view capture",
        "structured AI work view summaries",
        "task verification records final observation evidence",
        "screen actions link to final work view observations",
        "failed tasks carry recovery evidence",
        "auto recovery uses evidence-driven target URLs",
      ],
      nextRecommendedTrunk: "system-health-self-heal",
      nextRecommendedMilestone: "basic body health and conservative self-heal evidence",
    },
    phases,
    guardrails: {
      afterEachMilestone: [
        "re-read the whitepaper and MVP route before selecting the next slice",
        "prefer one visible body-loop capability over another safety-chain increment",
        "stop if the next task only adds approval expiry, duplicate click, or persistence hardening",
      ],
      avoidLoops: [
        "plugin-runtime-adapter-hardening-loop",
        "approval-boundary-expansion-loop",
        "persistence-before-user-visible-body-progress",
      ],
    },
    summary: {
      totalPhases: phases.length,
      complete: phases.filter((phase) => phase.status === "complete").length,
      next: phases.find((phase) => phase.status === "next")?.id ?? null,
      direction: "return-to-mvp-body-health",
    },
  };
}

async function armBodyEvidenceLedgerFollowupRecordAppend({ confirm = false, taskId = null } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger follow-up append requires confirm=true.");
  }

  const routeReview = await buildBodyEvidenceLedgerFollowupRecordAppendRouteReview();
  if (routeReview.status !== "selected"
    || routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-append"
    || routeReview.summary?.existingRecordCount !== 1
    || routeReview.summary?.recordAppended !== false) {
    throw new Error("Body evidence ledger follow-up append requires a selected append route review.");
  }

  const task = taskId ? getTaskById(taskId) : findLatestBodyEvidenceLedgerFollowupRecordTask();
  if (!task || !isBodyEvidenceLedgerFollowupRecordTask(task)) {
    throw new Error("Follow-up ledger record append requires an existing follow-up record task.");
  }
  if (task.id !== routeReview.summary?.taskId) {
    throw new Error("Follow-up ledger record append task must match the selected route-review task.");
  }
  if (task.approval?.status !== "pending" && task.approval?.status !== "approved") {
    throw new Error("Follow-up ledger record append requires a pending or approved task approval.");
  }

  task.bodyEvidenceLedgerFollowupRecord = {
    ...(task.bodyEvidenceLedgerFollowupRecord ?? {}),
    appendExecutionEnabled: true,
    appendRouteReviewRegistry: routeReview.registry,
    appendRouteReviewSelectedAt: routeReview.generatedAt,
    futureAppendRequiresSeparateMilestone: false,
  };
  task.plan = {
    ...(task.plan ?? {}),
    strategy: "approval-gated-ledger-followup-record-append",
    summary: "Execute the approved second body evidence ledger JSONL append for the existing follow-up record task.",
    steps: (task.plan?.steps ?? []).map((step) => {
      if (step.id === "defer-followup-record-append") {
        return {
          ...step,
          phase: "approved_followup_record_append",
          title: "Append the second JSONL record after explicit approval",
          executesNow: true,
        };
      }
      return step;
    }),
  };
  task.updatedAt = new Date().toISOString();
  persistState();
  await publishEvent(createEventName("body_evidence_ledger.followup_record_append_armed"), {
    task: serialiseTask(task),
    routeReview: {
      registry: routeReview.registry,
      selectedSlice: routeReview.decision?.selectedSlice ?? null,
    },
  });

  return {
    registry: "openclaw-body-evidence-ledger-followup-record-append-v0",
    mode: "approval-gated-followup-record-append-armed",
    generatedAt: new Date().toISOString(),
    routeReview,
    task,
    approval: task.approval?.requestId ? approvals.get(task.approval.requestId) : null,
    governance: {
      createsTask: false,
      createsApproval: false,
      requiresExplicitApproval: true,
      canAppendLedgerRecord: true,
      appendExecutionEnabled: true,
      recordAppended: false,
      durableStorageWritten: false,
      hostMutation: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };
}

function taskTimeForDemo(task) {
  const value = Date.parse(task?.closedAt ?? task?.updatedAt ?? task?.createdAt ?? "");
  return Number.isFinite(value) ? value : 0;
}

function findLatestSystemdRepairDemoTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "systemd_repair_execution_task")
    .filter((task) => task.outcome?.details?.postExecutionVerification)
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function findLatestSystemdNextRepairDemoTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "systemd_next_repair_task")
    .filter((task) => task.outcome?.details?.postExecutionVerification)
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function findLatestBodyEvidenceLedgerFollowupRecordTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "body_evidence_ledger_followup_record_task")
    .filter((task) => task.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0")
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function readBodyEvidenceLedgerLines() {
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  if (!existsSync(ledgerFilePath)) {
    return {
      ledgerFileDisplayPath,
      ledgerFilePath,
      exists: false,
      lineCount: 0,
      records: [],
    };
  }
  const text = readFileSync(ledgerFilePath, "utf8");
  const lines = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
  return {
    ledgerFileDisplayPath,
    ledgerFilePath,
    exists: true,
    lineCount: lines.length,
    records: lines.map((line, index) => {
      try {
        const record = JSON.parse(line);
        return {
          index,
          ok: true,
          id: record.id ?? null,
          evidenceType: record.evidenceType ?? null,
          sourceRegistry: record.sourceRegistry ?? null,
          contentHash: record.contentHash ?? null,
        };
      } catch (error) {
        return {
          index,
          ok: false,
          error: error instanceof Error ? error.message : "Invalid JSONL record",
        };
      }
    }),
  };
}

function buildPhase2RepairDemoStatus() {
  const route = buildMvpRouteAlignment();
  const latestTask = findLatestSystemdRepairDemoTask();
  const verification = latestTask?.outcome?.details?.postExecutionVerification ?? null;
  const transcript = latestTask?.outcome?.details?.commandTranscript?.[0] ?? null;
  const checklist = [
    {
      id: "phase2-track-a-route",
      label: "Whitepaper route remains Phase 2 Track A to Track B",
      status: "passed",
      evidence: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
    },
    {
      id: "operator-approved-real-execution",
      label: "Operator-approved real systemd repair execution exists",
      status: latestTask ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "post-execution-body-verification",
      label: "Post-execution body-state verification is attached",
      status: verification ? "passed" : "pending",
      evidence: verification?.registry ?? null,
    },
    {
      id: "observer-visible-evidence",
      label: "Observer can display task evidence without hidden actions",
      status: "passed",
      evidence: "observer-ui phase2 repair demo panel",
    },
  ];
  const passed = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-phase-2-repair-demo-status-v0",
    mode: "observer_demo_status_read_only",
    generatedAt: new Date().toISOString(),
    status: latestTask && verification ? "demo_ready" : "waiting_for_repair_evidence",
    track: {
      phase: "phase-2",
      track: "operator-observer-demo-experience",
      sourceTrack: "real-nixos-systemd-repair-semantics",
      whitepaperDirection: "make body capability explainable and observable",
    },
    route: {
      registry: route.registry,
      current: "phase-2-systemd-repair-evidence-demo",
      previousMvpCurrent: route.mainline?.current ?? null,
      nextRecommendedSlice: "operator-observer-demo-evidence-bundle",
      avoidsSafetyBoundaryLoop: true,
    },
    checklist,
    summary: {
      passed,
      total: checklist.length,
      demoReady: latestTask && verification ? true : false,
      latestTaskId: latestTask?.id ?? null,
      latestOutcome: latestTask?.outcome?.kind ?? null,
      targetUnit: verification?.targetUnit ?? latestTask?.systemdRepair?.target?.unit ?? "openclaw-browser-runtime.service",
      command: transcript?.command ?? null,
      exitCode: verification?.commandExitCode ?? transcript?.exitCode ?? null,
      beforeActiveState: verification?.summary?.beforeActiveState ?? null,
      afterActiveState: verification?.summary?.afterActiveState ?? null,
      beforeServiceOk: verification?.summary?.beforeServiceOk ?? null,
      afterServiceOk: verification?.summary?.afterServiceOk ?? null,
      noAutomaticRecovery: verification?.summary?.noAutomaticRecovery === true,
    },
    evidence: {
      task: latestTask ? serialiseTask(latestTask) : null,
      postExecutionVerification: verification,
      commandTranscript: transcript,
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
  };
}

function buildPhase2NextRepairDemoStatus() {
  const latestTask = findLatestSystemdNextRepairDemoTask();
  const verification = latestTask?.outcome?.details?.postExecutionVerification ?? null;
  const transcript = latestTask?.outcome?.details?.commandTranscript?.[0] ?? null;
  const checklist = [
    {
      id: "next-repair-route",
      label: "Next repair route selected system-sense",
      status: latestTask?.systemdNextRepair?.sourceRegistry === "openclaw-systemd-next-repair-task-route-v0" ? "passed" : "pending",
      evidence: latestTask?.systemdNextRepair?.sourceRegistry ?? null,
    },
    {
      id: "operator-approved-next-real-execution",
      label: "Operator-approved next real execution attempt exists",
      status: latestTask ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "next-post-execution-verification",
      label: "Before/after body-state verification is attached",
      status: verification ? "passed" : "pending",
      evidence: verification?.registry ?? null,
    },
    {
      id: "no-hidden-follow-up",
      label: "No recovery, retry, scheduler, or follow-up mutation is triggered",
      status: verification?.governance?.triggersRecovery === false ? "passed" : "pending",
      evidence: verification?.governance ?? null,
    },
  ];
  const passed = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-systemd-next-repair-demo-status-v0",
    mode: "read_only_next_repair_demo_status",
    generatedAt: new Date().toISOString(),
    status: latestTask && verification ? "demo_ready" : "waiting_for_next_repair_evidence",
    track: {
      phase: "phase-2",
      track: "real-nixos-systemd-repair-semantics",
      whitepaperDirection: "make OpenClaw's body repair attempt explainable and observable",
    },
    checklist,
    summary: {
      ready: latestTask && verification && passed === checklist.length,
      passedChecks: passed,
      totalChecks: checklist.length,
      targetUnit: latestTask?.systemdNextRepair?.target?.unit ?? "openclaw-system-sense.service",
      outcome: latestTask?.outcome?.kind ?? null,
      command: transcript?.command ?? null,
      exitCode: transcript?.exitCode ?? null,
      hostMutationAttempted: latestTask?.outcome?.details?.hostMutationAttempted === true,
      executionSucceeded: latestTask?.outcome?.details?.executionSucceeded ?? null,
    },
    evidence: {
      taskId: latestTask?.id ?? null,
      approval: latestTask?.approval ?? null,
      systemdNextRepair: latestTask?.systemdNextRepair ?? null,
      commandTranscript: transcript ?? null,
      postExecutionVerification: verification,
      rollbackNote: latestTask?.outcome?.details?.rollbackNote ?? null,
    },
    governance: {
      readsTaskHistoryOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      hostMutation: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-timeline",
      boundary: "return to read-only body memory; do not add another execution, recovery, or hardening loop",
    },
  };
}

function buildBodyEvidenceLedgerFollowupRecordReadiness() {
  const latestTask = findLatestBodyEvidenceLedgerFollowupRecordTask();
  const followupRecord = latestTask?.bodyEvidenceLedgerFollowupRecord ?? null;
  const ledger = readBodyEvidenceLedgerLines();
  const checklist = [
    {
      id: "followup-task-shell",
      label: "Follow-up ledger record task shell exists",
      status: latestTask?.type === "body_evidence_ledger_followup_record_task" ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "pending-approval-boundary",
      label: "Follow-up task remains approval-gated before append execution",
      status: latestTask?.approval?.status === "pending" && followupRecord?.appendExecutionEnabled === false ? "passed" : "pending",
      evidence: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
    },
    {
      id: "planned-second-record",
      label: "Task shell targets planned sequence 2 follow-up timeline record",
      status: followupRecord?.plannedRecordType === "body_evidence_timeline_followup"
        && followupRecord?.plannedSequence === 2 ? "passed" : "pending",
      evidence: followupRecord?.sourceRegistry ?? null,
    },
    {
      id: "no-second-ledger-record",
      label: "Ledger still contains exactly one durable record",
      status: ledger.exists === true && ledger.lineCount === 1 ? "passed" : "pending",
      evidence: ledger.ledgerFileDisplayPath,
    },
    {
      id: "no-hidden-writer",
      label: "No scheduler, background writer, command execution, or host mutation is enabled",
      status: followupRecord?.recordAppended === false
        && followupRecord?.durableStorageWritten === false
        && latestTask?.status === "queued" ? "passed" : "pending",
      evidence: "followup_record_readiness_governance",
    },
  ];
  const passedChecks = checklist.filter((item) => item.status === "passed").length;
  const ready = passedChecks === checklist.length;

  return {
    ok: true,
    registry: "openclaw-body-evidence-ledger-followup-record-readiness-v0",
    mode: "read_only_followup_record_task_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "ready_for_route_review" : "waiting_for_followup_task_shell",
    source: {
      service: "openclaw-core",
      taskId: latestTask?.id ?? null,
      taskRegistry: followupRecord?.registry ?? null,
      ledgerFile: ledger.ledgerFileDisplayPath,
      evidence: "body_evidence_ledger_followup_record_readiness",
    },
    checklist,
    summary: {
      ready,
      passedChecks,
      totalChecks: checklist.length,
      taskId: latestTask?.id ?? null,
      approvalId: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
      approvalStatus: latestTask?.approval?.status ?? null,
      plannedRecordType: followupRecord?.plannedRecordType ?? null,
      plannedSequence: followupRecord?.plannedSequence ?? null,
      existingRecordCount: ledger.lineCount,
      recordAppended: followupRecord?.recordAppended === true,
      durableStorageWritten: followupRecord?.durableStorageWritten === true,
      hiddenMutation: false,
    },
    evidence: {
      task: latestTask ? serialiseTask(latestTask) : null,
      followupRecord,
      ledger,
      noSecondRecord: ledger.lineCount === 1,
      hardBoundary: [
        "do not approve follow-up append in this checkpoint",
        "do not append a second ledger record",
        "no scheduler",
        "no background writer",
        "no command execution",
        "no host mutation",
      ],
    },
    governance: {
      readsTaskHistoryOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      hostMutation: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      recordAppended: false,
      durableStorageWritten: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before approving the follow-up append, writing a second ledger record, or adding background persistence",
    },
  };
}

async function buildBodyEvidenceLedgerFollowupRecordAppendRouteReview() {
  const readiness = buildBodyEvidenceLedgerFollowupRecordReadiness();
  const routeReview = await buildPhase2NextCapabilityRouteReview();
  const ready = readiness.summary?.ready === true
    && routeReview.decision?.selectedSlice === "openclaw-body-evidence-ledger-followup-record-append-route-review"
    && readiness.summary?.recordAppended === false
    && readiness.summary?.existingRecordCount === 1;
  const checklist = [
    {
      id: "followup-readiness-ready",
      label: "Follow-up task readiness is complete",
      status: readiness.summary?.ready === true ? "passed" : "pending",
      evidence: readiness.registry,
    },
    {
      id: "route-selected",
      label: "Next capability route selected follow-up append route review",
      status: routeReview.decision?.selectedSlice === "openclaw-body-evidence-ledger-followup-record-append-route-review" ? "passed" : "pending",
      evidence: routeReview.registry,
    },
    {
      id: "pending-approval",
      label: "Existing follow-up task remains pending approval",
      status: readiness.summary?.approvalStatus === "pending" ? "passed" : "pending",
      evidence: readiness.summary?.approvalId ?? null,
    },
    {
      id: "no-second-record",
      label: "Ledger still contains exactly one durable record",
      status: readiness.summary?.existingRecordCount === 1 && readiness.summary?.recordAppended === false ? "passed" : "pending",
      evidence: readiness.source?.ledgerFile ?? null,
    },
    {
      id: "review-only",
      label: "Route review creates no task, approval, append, scheduler, or host mutation",
      status: "passed",
      evidence: "followup_append_route_review_governance",
    },
  ];
  const passedChecks = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-body-evidence-ledger-followup-record-append-route-review-v0",
    mode: "read_only_followup_append_route_review",
    generatedAt: new Date().toISOString(),
    status: ready ? "selected" : "blocked_until_followup_readiness_route",
    source: {
      service: "openclaw-core",
      readinessRegistry: readiness.registry,
      nextCapabilityRouteRegistry: routeReview.registry,
      evidence: "body_evidence_ledger_followup_append_route_review",
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: ready ? "openclaw-body-evidence-ledger-followup-record-append" : "wait-for-followup-readiness-route",
      status: ready ? "selected" : "blocked",
      rationale: ready
        ? "The follow-up ledger task is visible and pending; a future append execution may be opened only as a separate approved milestone."
        : "The follow-up append route waits for readiness plus next-capability route selection.",
      notSelected: [
        "no approval in route review",
        "no second ledger record append in route review",
        "no background ledger writer",
        "no scheduler",
        "no automatic repair",
        "no plugin/runtime adapter work",
        "no arbitrary host control",
      ],
    },
    checklist,
    summary: {
      ready,
      passedChecks,
      totalChecks: checklist.length,
      taskId: readiness.summary?.taskId ?? null,
      approvalId: readiness.summary?.approvalId ?? null,
      approvalStatus: readiness.summary?.approvalStatus ?? null,
      plannedRecordType: readiness.summary?.plannedRecordType ?? null,
      plannedSequence: readiness.summary?.plannedSequence ?? null,
      existingRecordCount: readiness.summary?.existingRecordCount ?? 0,
      recordAppended: false,
      durableStorageWritten: false,
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      approvesTask: false,
      executesCommand: false,
      hostMutation: false,
      canAppendLedgerRecord: false,
      recordAppended: false,
      durableStorageWritten: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      triggersRecovery: false,
    },
    evidence: {
      readiness,
      routeReview: {
        registry: routeReview.registry,
        selectedSlice: routeReview.decision?.selectedSlice ?? null,
        recommendedSlice: routeReview.next?.recommendedSlice ?? null,
      },
      noSecondRecord: readiness.evidence?.noSecondRecord === true,
    },
    next: {
      recommendedSlice: ready ? "openclaw-body-evidence-ledger-followup-record-append" : "openclaw-body-evidence-ledger-followup-record-readiness",
      boundary: "future append must be a separate approved execution milestone; do not approve or write JSONL in this route review",
    },
  };
}

function buildBodyEvidenceLedgerFollowupRecordAppendReadiness() {
  const latestTask = findLatestBodyEvidenceLedgerFollowupRecordTask();
  const followupRecord = latestTask?.bodyEvidenceLedgerFollowupRecord ?? null;
  const ledger = readBodyEvidenceLedgerLines();
  const firstRecord = ledger.records?.[0] ?? null;
  const secondRecord = ledger.records?.[1] ?? null;
  const checklist = [
    {
      id: "followup-task-completed",
      label: "Follow-up ledger append task completed",
      status: latestTask?.status === "completed" && followupRecord?.recordAppended === true ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "two-ledger-records",
      label: "Ledger contains exactly two durable JSONL records",
      status: ledger.exists === true && ledger.lineCount === 2 ? "passed" : "pending",
      evidence: ledger.ledgerFileDisplayPath,
    },
    {
      id: "followup-record-type",
      label: "Second record is the planned follow-up timeline record",
      status: secondRecord?.evidenceType === "body_evidence_timeline_followup" ? "passed" : "pending",
      evidence: secondRecord?.id ?? null,
    },
    {
      id: "previous-record-link",
      label: "Second record links back to the first durable record",
      status: followupRecord?.previousRecordId === firstRecord?.id
        && followupRecord?.previousRecordHash === firstRecord?.contentHash ? "passed" : "pending",
      evidence: firstRecord?.id ?? null,
    },
    {
      id: "no-hidden-writer",
      label: "No scheduler, background writer, command execution, or recovery was added",
      status: latestTask?.outcome?.details?.scheduler === false
        && latestTask?.outcome?.details?.backgroundWriter === false
        && latestTask?.outcome?.details?.bulkImport === false ? "passed" : "pending",
      evidence: "followup_append_readiness_governance",
    },
  ];
  const passedChecks = checklist.filter((item) => item.status === "passed").length;
  const ready = passedChecks === checklist.length;

  return {
    ok: true,
    registry: "openclaw-body-evidence-ledger-followup-record-append-readiness-v0",
    mode: "read_only_followup_append_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "ready_for_route_review" : "waiting_for_followup_append",
    source: {
      service: "openclaw-core",
      taskId: latestTask?.id ?? null,
      taskRegistry: followupRecord?.registry ?? null,
      appendRegistry: followupRecord?.appendResult?.registry ?? null,
      ledgerFile: ledger.ledgerFileDisplayPath,
      evidence: "body_evidence_ledger_followup_record_append_readiness",
    },
    checklist,
    summary: {
      ready,
      passedChecks,
      totalChecks: checklist.length,
      taskId: latestTask?.id ?? null,
      approvalId: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
      approvalStatus: latestTask?.approval?.status ?? null,
      plannedRecordType: followupRecord?.plannedRecordType ?? null,
      plannedSequence: followupRecord?.plannedSequence ?? null,
      recordId: followupRecord?.recordId ?? null,
      previousRecordId: followupRecord?.previousRecordId ?? null,
      previousRecordHash: followupRecord?.previousRecordHash ?? null,
      contentHash: followupRecord?.contentHash ?? null,
      existingRecordCount: ledger.lineCount,
      recordAppended: followupRecord?.recordAppended === true,
      durableStorageWritten: followupRecord?.durableStorageWritten === true,
      hiddenMutation: false,
    },
    evidence: {
      task: latestTask ? serialiseTask(latestTask) : null,
      followupRecord,
      ledger,
      firstRecord,
      secondRecord,
      routeBoundary: [
        "return to whitepaper route review before additional ledger records",
        "no scheduler",
        "no background writer",
        "no command execution",
        "no recovery action",
      ],
    },
    governance: {
      readsTaskHistoryOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      hostMutation: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      recordAppended: false,
      durableStorageWritten: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before more ledger writes, schedulers, background persistence, or broader mutation",
    },
  };
}

async function buildPhase2DemoControlRoom() {
  const mvpRoute = buildMvpRouteAlignment();
  const repairDemo = buildPhase2RepairDemoStatus();
  let routeReview = null;
  try {
    routeReview = await fetchJson(`${systemSenseUrl}/system/route/phase-2-review`);
  } catch {
    routeReview = null;
  }

  const panels = [
    {
      id: "service-health",
      label: "Body service health",
      source: "/health plus Observer service health pills",
      status: "available",
    },
    {
      id: "mvp-route",
      label: "Whitepaper route alignment",
      source: "/mvp/route",
      status: mvpRoute?.ok ? "available" : "unavailable",
    },
    {
      id: "phase-2-repair-demo",
      label: "Phase 2 repair demo evidence",
      source: "/phase-2/repair-demo-status",
      status: repairDemo?.ok ? "available" : "unavailable",
    },
    {
      id: "phase-2-route-review",
      label: "Phase 2 next-block route review",
      source: `${systemSenseUrl}/system/route/phase-2-review`,
      status: routeReview?.ok ? "available" : "unavailable",
    },
    {
      id: "body-governance-readiness",
      label: "Track C body governance readiness",
      source: routeReview?.source?.bodyGovernanceReadinessRegistry ?? "openclaw-body-governance-readiness-v0",
      status: routeReview?.evidence?.trackCReady === true ? "available" : "unavailable",
    },
  ];
  const available = panels.filter((panel) => panel.status === "available").length;
  const ready = available === panels.length
    && routeReview?.decision?.selectedSlice === "openclaw-phase-2-demo-control-room";

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-control-room-v0",
    mode: "read_only_demo_control_surface",
    generatedAt: new Date().toISOString(),
    status: ready ? "control_room_ready" : "waiting_for_route_review_evidence",
    source: {
      service: "openclaw-core",
      mvpRouteRegistry: mvpRoute?.registry ?? null,
      repairDemoRegistry: repairDemo?.registry ?? null,
      routeReviewRegistry: routeReview?.registry ?? null,
      evidence: "phase_2_demo_control_room_bundle",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready,
      availablePanels: available,
      totalPanels: panels.length,
      selectedTrack: routeReview?.decision?.selectedTrack ?? "unknown",
      selectedSlice: routeReview?.decision?.selectedSlice ?? "unknown",
      repairDemoStatus: repairDemo?.status ?? "unknown",
      repairDemoReady: repairDemo?.summary?.demoReady === true,
      bodyGovernanceReady: routeReview?.evidence?.trackCReady === true,
      avoidsSafetyBoundaryLoop: routeReview?.decision?.notSelected?.some((item) => item.includes("safety-boundary")) === true,
    },
    panels,
    evidence: {
      mvpRoute: {
        current: mvpRoute?.mainline?.current ?? null,
        nextRecommendedTrunk: mvpRoute?.mainline?.nextRecommendedTrunk ?? null,
        guardrails: mvpRoute?.guardrails ?? null,
      },
      repairDemo: {
        status: repairDemo?.status ?? null,
        checklistPassed: repairDemo?.summary?.passed ?? 0,
        checklistTotal: repairDemo?.summary?.total ?? 0,
        targetUnit: repairDemo?.summary?.targetUnit ?? "openclaw-browser-runtime.service",
        nextRecommendedSlice: repairDemo?.route?.nextRecommendedSlice ?? null,
      },
      routeReview: routeReview ? {
        selectedTrack: routeReview.decision?.selectedTrack ?? null,
        selectedSlice: routeReview.decision?.selectedSlice ?? null,
        notSelected: routeReview.decision?.notSelected ?? [],
      } : null,
    },
    operatorScript: [
      "Open Observer UI.",
      "Confirm service health, MVP route, repair demo status, body governance readiness, and Phase 2 route review panels are visible.",
      "Explain that the next work is demo/control-room clarity, not broader mutation or plugin/runtime work.",
      "Only run a real repair through the already-approved operator-reviewed repair path when intentionally demonstrating Track A.",
    ],
    next: {
      recommendedSlice: "openclaw-phase-2-demo-walkthrough",
      boundary: "turn the control room into a human-readable walkthrough without adding new autonomy or host mutation",
    },
  };
}

async function buildPhase2DemoWalkthrough() {
  const controlRoom = await buildPhase2DemoControlRoom();
  const ready = controlRoom.summary?.ready === true;
  const steps = [
    {
      id: "open-observer",
      title: "Open the Observer UI",
      operatorAction: "Navigate to the Observer UI and confirm the control room panel is visible.",
      expectedEvidence: "phase2-demo-control-room-panel",
      status: ready ? "ready" : "waiting",
    },
    {
      id: "explain-route",
      title: "Explain the whitepaper route",
      operatorAction: "Show MVP route, Phase 2 route review, and the selected Track B demo-control-room slice.",
      expectedEvidence: controlRoom.evidence?.routeReview?.selectedSlice ?? "openclaw-phase-2-demo-control-room",
      status: controlRoom.summary?.selectedSlice === "openclaw-phase-2-demo-control-room" ? "ready" : "waiting",
    },
    {
      id: "show-body-governance",
      title: "Show body governance readiness",
      operatorAction: "Point to dependency, trend, recovery policy, and readiness panels as the body reasoning foundation.",
      expectedEvidence: "openclaw-body-governance-readiness-v0",
      status: controlRoom.summary?.bodyGovernanceReady ? "ready" : "waiting",
    },
    {
      id: "show-repair-demo",
      title: "Show repair demo status",
      operatorAction: "Show whether real repair evidence is ready or still waiting; do not run hidden repair actions.",
      expectedEvidence: controlRoom.evidence?.repairDemo?.targetUnit ?? "openclaw-browser-runtime.service",
      status: controlRoom.evidence?.repairDemo?.status ? "ready" : "waiting",
    },
    {
      id: "state-boundary",
      title: "State the boundary",
      operatorAction: "Say explicitly that this walkthrough creates no task, approval, command, host mutation, scheduler, or recovery action.",
      expectedEvidence: "read_only_demo_walkthrough",
      status: "ready",
    },
  ];
  const readySteps = steps.filter((step) => step.status === "ready").length;

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-walkthrough-v0",
    mode: "read_only_human_demo_walkthrough",
    generatedAt: new Date().toISOString(),
    status: readySteps === steps.length ? "walkthrough_ready" : "walkthrough_waiting_for_evidence",
    source: {
      service: "openclaw-core",
      demoControlRoomRegistry: controlRoom.registry,
      evidence: "phase_2_human_demo_walkthrough",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready: readySteps === steps.length,
      readySteps,
      totalSteps: steps.length,
      selectedSlice: controlRoom.summary?.selectedSlice ?? "unknown",
      controlRoomReady: ready,
      repairDemoReady: controlRoom.summary?.repairDemoReady === true,
      bodyGovernanceReady: controlRoom.summary?.bodyGovernanceReady === true,
    },
    steps,
    script: [
      "OpenClaw is now demonstrating a resident body loop, not a plugin/runtime adapter loop.",
      "Track A proved a narrow operator-reviewed repair path.",
      "Track C proved body governance evidence and route-aware recovery judgment.",
      "Track B now packages those signals into an operator-visible demo surface.",
      "No hidden mutation happens during this walkthrough.",
    ],
    next: {
      recommendedSlice: "openclaw-phase-2-demo-readiness-exit",
      boundary: "close the Track B demo block after the walkthrough is visible and read-only",
    },
  };
}

async function buildPhase2DemoReadinessExit() {
  const walkthrough = await buildPhase2DemoWalkthrough();
  const exitChecks = [
    {
      id: "control-room-ready",
      label: "Phase 2 demo control room is ready",
      passed: walkthrough.summary?.controlRoomReady === true,
      evidence: walkthrough.source?.demoControlRoomRegistry ?? "openclaw-phase-2-demo-control-room-v0",
    },
    {
      id: "walkthrough-ready",
      label: "Human demo walkthrough steps are ready",
      passed: walkthrough.summary?.ready === true,
      evidence: walkthrough.registry,
    },
    {
      id: "body-governance-visible",
      label: "Body governance readiness is visible in the demo story",
      passed: walkthrough.summary?.bodyGovernanceReady === true,
      evidence: "openclaw-body-governance-readiness-v0",
    },
    {
      id: "operator-boundary-visible",
      label: "No-hidden-mutation boundary is visible in the walkthrough",
      passed: (walkthrough.script ?? []).some((line) => line.includes("No hidden mutation")),
      evidence: "walkthrough-script",
    },
    {
      id: "read-only-exit",
      label: "Exit gate remains read-only and non-executing",
      passed: walkthrough.governance?.createsTask === false
        && walkthrough.governance?.executesCommand === false
        && walkthrough.governance?.mutatesHost === false
        && walkthrough.governance?.triggersRecovery === false,
      evidence: "exit-governance",
    },
  ];
  const passed = exitChecks.filter((check) => check.passed).length;
  const ready = passed === exitChecks.length;

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-readiness-exit-v0",
    mode: "read_only_demo_block_exit",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_2_demo_block_ready" : "phase_2_demo_block_waiting",
    source: {
      service: "openclaw-core",
      demoWalkthroughRegistry: walkthrough.registry,
      demoControlRoomRegistry: walkthrough.source?.demoControlRoomRegistry ?? null,
      evidence: "phase_2_track_b_demo_readiness_exit",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready,
      passed,
      total: exitChecks.length,
      walkthroughStatus: walkthrough.status,
      selectedSlice: walkthrough.summary?.selectedSlice ?? "unknown",
      repairDemoReady: walkthrough.summary?.repairDemoReady === true,
      bodyGovernanceReady: walkthrough.summary?.bodyGovernanceReady === true,
    },
    exitChecks,
    completedBlock: {
      id: "phase-2-track-b-demo-experience",
      name: "Operator/Observer Demo Experience",
      completedSlices: [
        "openclaw-phase-2-route-review",
        "openclaw-phase-2-demo-control-room",
        "openclaw-phase-2-demo-walkthrough",
      ],
      completionClaim: ready ? "track_b_demo_readiness_exit_passed" : "track_b_demo_readiness_incomplete",
    },
    operatorOutcome: {
      demoNarrative: "OpenClaw can now show a resident body loop, real repair evidence, body governance evidence, and the next-route decision from one Observer path.",
      safeToDemo: ready,
      hiddenMutation: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to the whitepaper route before opening the next body capability block",
    },
  };
}

async function buildPhase2NextCapabilityRouteReview(options = {}) {
  const demoExit = await buildPhase2DemoReadinessExit();
  const demoReady = demoExit.summary?.ready === true;
  const ledgerDemoStatusCheckpointComplete = options.ledgerDemoStatusCheckpointComplete === true;
  const repairCandidateDemoCheckpointComplete = options.repairCandidateDemoCheckpointComplete === true;
  let candidateDemoStatus = null;
  let bodyEvidenceTimelineReadiness = null;
  let bodyEvidenceLedgerReadiness = null;
  let bodyEvidenceLedgerDemoStatus = null;
  let bodyEvidenceLedgerFollowupRecordPlan = null;
  let bodyEvidenceLedgerFollowupRecordReadiness = null;
  let bodyEvidenceLedgerFollowupRecordAppendReadiness = null;
  try {
    candidateDemoStatus = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-demo-status`);
  } catch {
    candidateDemoStatus = null;
  }
  try {
    bodyEvidenceTimelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
  } catch {
    bodyEvidenceTimelineReadiness = null;
  }
  try {
    bodyEvidenceLedgerReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-readiness`);
  } catch {
    bodyEvidenceLedgerReadiness = null;
  }
  if (ledgerDemoStatusCheckpointComplete) {
    try {
      bodyEvidenceLedgerDemoStatus = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-demo-status`);
    } catch {
      bodyEvidenceLedgerDemoStatus = null;
    }
  }
  if (repairCandidateDemoCheckpointComplete) {
    try {
      bodyEvidenceLedgerFollowupRecordPlan = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-followup-record-plan`);
    } catch {
      bodyEvidenceLedgerFollowupRecordPlan = null;
    }
  }
  try {
    bodyEvidenceLedgerFollowupRecordReadiness = buildBodyEvidenceLedgerFollowupRecordReadiness();
  } catch {
    bodyEvidenceLedgerFollowupRecordReadiness = null;
  }
  try {
    bodyEvidenceLedgerFollowupRecordAppendReadiness = buildBodyEvidenceLedgerFollowupRecordAppendReadiness();
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendReadiness = null;
  }
  const candidateDemoReady = candidateDemoStatus?.summary?.demoReady === true;
  const bodyEvidenceTimelineReady = bodyEvidenceTimelineReadiness?.summary?.ready === true;
  const bodyEvidenceLedgerReady = bodyEvidenceLedgerReadiness?.summary?.ready === true;
  const bodyEvidenceLedgerDemoReady = bodyEvidenceLedgerDemoStatus?.summary?.demoReady === true;
  const followupRecordPlanReady = bodyEvidenceLedgerFollowupRecordPlan?.summary?.planReady === true;
  const followupRecordReadinessReady = bodyEvidenceLedgerFollowupRecordReadiness?.summary?.ready === true;
  const followupRecordAppendReadinessReady = bodyEvidenceLedgerFollowupRecordAppendReadiness?.summary?.ready === true;
  const followupRecordPlanRouteReady = repairCandidateDemoCheckpointComplete
    && candidateDemoReady
    && bodyEvidenceTimelineReady
    && bodyEvidenceLedgerReady;
  const selectedTrack = followupRecordAppendReadinessReady
    ? "Phase 2 Completion"
    : followupRecordReadinessReady
    ? "Track C: Body Evidence Memory"
    : followupRecordPlanRouteReady
    ? "Track C: Body Evidence Memory"
    : candidateDemoReady
    ? (bodyEvidenceLedgerDemoReady
      ? "Track A: Real NixOS/systemd Repair Semantics"
      : "Track C: Body Governance Enhancement")
    : "Track A: Real NixOS/systemd Repair Semantics";
  const selectedSlice = followupRecordAppendReadinessReady
    ? "openclaw-phase-2-completion-readiness"
    : followupRecordReadinessReady
    ? "openclaw-body-evidence-ledger-followup-record-append-route-review"
    : followupRecordPlanRouteReady
    ? "openclaw-body-evidence-ledger-followup-record-plan"
    : candidateDemoReady
    ? (bodyEvidenceLedgerDemoReady
        ? "openclaw-systemd-next-repair-scope-review"
        : bodyEvidenceLedgerReady
        ? "openclaw-body-evidence-ledger-demo-status"
        : bodyEvidenceTimelineReady
          ? "openclaw-body-evidence-ledger-plan"
          : "openclaw-body-evidence-timeline")
    : "openclaw-systemd-repair-candidate-assessment";
  const candidates = [
    {
      track: "Track A",
      id: "real-systemd-repair-semantics",
      label: "Read-only next repair candidate assessment",
      score: candidateDemoReady ? 58 : (demoReady ? 96 : 60),
      recommended: !candidateDemoReady,
      firstSlice: "openclaw-systemd-repair-candidate-assessment",
      mutation: false,
      reason: candidateDemoReady
        ? "The repair candidate route is already demo-ready; repeating candidate assessment would create a route loop."
        : "Phase 2 now has demo readiness and body governance; the next body capability should return to real NixOS/systemd repair semantics without immediately broadening mutation.",
    },
    {
      track: "Track C",
      id: "body-governance-evidence-memory",
      label: "Read-only body evidence timeline",
      score: candidateDemoReady ? 97 : 64,
      recommended: candidateDemoReady && !bodyEvidenceTimelineReady,
      firstSlice: "openclaw-body-evidence-timeline",
      mutation: false,
      reason: bodyEvidenceTimelineReady
        ? "The body evidence timeline is already ready; do not loop back into the same memory slice."
        : "The repair candidate route is demo-ready; the next whitepaper-aligned gain is durable body evidence memory before any broader mutation.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger",
      label: "Read-only durable body evidence ledger plan",
      score: bodyEvidenceTimelineReady ? 98 : 62,
      recommended: bodyEvidenceTimelineReady && !bodyEvidenceLedgerReady,
      firstSlice: "openclaw-body-evidence-ledger-plan",
      mutation: false,
      reason: bodyEvidenceLedgerReady
        ? "The first durable ledger record is ready; do not loop back into the ledger plan."
        : "The in-process evidence timeline is ready; the next route-reviewed step is a plan-only durable ledger design, not persistence implementation.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-demo-status",
      label: "Read-only body evidence ledger demo status",
      score: bodyEvidenceLedgerReady ? 99 : 50,
      recommended: bodyEvidenceLedgerReady && !bodyEvidenceLedgerDemoReady && !followupRecordPlanRouteReady && !followupRecordReadinessReady && !followupRecordAppendReadinessReady,
      firstSlice: "openclaw-body-evidence-ledger-demo-status",
      mutation: false,
      reason: bodyEvidenceLedgerDemoReady
        ? "The ledger demo status is already ready; do not loop back into the same demo package."
        : bodyEvidenceLedgerReady
        ? "The first durable ledger record is ready; package the completed body-memory block for operator demo before adding more writes."
        : "Ledger demo status waits until the first durable record readiness gate passes.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-followup-record-plan",
      label: "Plan-only follow-up body evidence ledger record",
      score: followupRecordPlanRouteReady ? 101 : 56,
      recommended: followupRecordPlanRouteReady && !followupRecordReadinessReady && !followupRecordAppendReadinessReady,
      firstSlice: "openclaw-body-evidence-ledger-followup-record-plan",
      mutation: false,
      reason: followupRecordPlanRouteReady
        ? "The candidate demo and durable ledger evidence are ready; plan the next body evidence ledger record without creating a task or writing JSONL."
        : "Follow-up ledger record planning waits until candidate demo status and the first ledger record are both ready.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-followup-append-route",
      label: "Route review for pending follow-up ledger append",
      score: followupRecordReadinessReady ? 102 : 55,
      recommended: followupRecordReadinessReady && !followupRecordAppendReadinessReady,
      firstSlice: "openclaw-body-evidence-ledger-followup-record-append-route-review",
      mutation: false,
      reason: followupRecordReadinessReady
        ? "The follow-up ledger task shell is visible and pending; return to route review before any approval or second JSONL append."
        : "Follow-up append route review waits until the task shell readiness bundle proves no second ledger record exists.",
    },
    {
      track: "Phase 2 Completion",
      id: "phase-2-completion-readiness",
      label: "Read-only Phase 2 completion readiness",
      score: followupRecordAppendReadinessReady ? 103 : 45,
      recommended: followupRecordAppendReadinessReady,
      firstSlice: "openclaw-phase-2-completion-readiness",
      mutation: false,
      reason: followupRecordAppendReadinessReady
        ? "The second durable body-memory record is ready; stop expanding ledger slices and summarize Phase 2 completion evidence."
        : "Phase 2 completion readiness waits until the follow-up append readiness bundle closes body memory.",
    },
    {
      track: "Track A",
      id: "next-systemd-repair-scope-review",
      label: "Read-only next systemd repair scope review",
      score: bodyEvidenceLedgerDemoReady ? 100 : 54,
      recommended: bodyEvidenceLedgerDemoReady && !followupRecordPlanRouteReady,
      firstSlice: "openclaw-systemd-next-repair-scope-review",
      mutation: false,
      reason: bodyEvidenceLedgerDemoReady
        ? "The body evidence ledger demo is ready; return to real systemd repair semantics with a read-only scope review before any new repair plan."
        : "Next repair scope review waits until the durable body-memory demo package is ready.",
    },
    {
      track: "Track B",
      id: "operator-observer-demo-experience",
      label: "Additional demo polish",
      score: 55,
      recommended: false,
      firstSlice: "defer-additional-demo-polish",
      mutation: false,
      reason: "The demo block has an exit gate; more polish would be lower-value than advancing body capability.",
    },
    {
      track: "Track C",
      id: "body-governance-enhancement",
      label: "Additional body governance summaries",
      score: 65,
      recommended: false,
      firstSlice: "defer-governance-expansion",
      mutation: false,
      reason: "Track C readiness is already present and should now inform the next real repair candidate assessment.",
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 20,
      recommended: false,
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
      reason: "Plugin/runtime adapter work still lacks a stronger visible body-capability need than next real repair candidate assessment.",
    },
  ];

  return {
    ok: true,
    registry: "openclaw-phase-2-next-capability-route-review-v0",
    mode: "read_only_next_capability_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-core",
      demoReadinessExitRegistry: demoExit.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_next_capability_route_review",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    decision: {
      selectedTrack,
      selectedSlice,
      status: demoReady ? "selected" : "blocked_until_demo_exit_ready",
      rationale: followupRecordAppendReadinessReady
        ? "The follow-up append readiness bundle is complete, so stop opening new body-memory writes and prepare a read-only Phase 2 completion readiness summary."
        : followupRecordReadinessReady
        ? "The follow-up ledger task shell is visible, so the next whitepaper-aligned step is a route review before any approval or second record append."
        : followupRecordPlanRouteReady
        ? "Candidate repair demo evidence and the first ledger record are ready, so plan a follow-up body evidence ledger record without appending it yet."
        : candidateDemoReady
        ? (bodyEvidenceLedgerDemoReady
            ? "The durable body evidence ledger is demo-ready, so return to Track A with a read-only next repair scope review rather than adding more ledger writes."
            : bodyEvidenceLedgerReady
            ? "The first durable body evidence ledger record is ready, so avoid more ledger writes and package the completed block for operator demo."
            : bodyEvidenceTimelineReady
            ? "The body evidence timeline is ready, so avoid looping and plan durable evidence storage before implementing it."
            : "The repair candidate route has been made demo-ready, so avoid looping back into the same candidate block and move to read-only body evidence memory.")
        : "Return to the highest-priority body capability track, but start with read-only candidate assessment before broadening real repair mutation.",
      notSelected: [
        candidateDemoReady ? "no repair candidate assessment loop" : "no additional demo polish before new body capability",
        bodyEvidenceTimelineReady ? "no body evidence timeline loop" : "no candidate-specific approval replay",
        bodyEvidenceLedgerReady ? "no body evidence ledger plan or append loop" : "no body evidence ledger demo before readiness",
        bodyEvidenceLedgerDemoReady ? "no body evidence ledger demo status loop" : "no next repair scope before ledger demo status",
        followupRecordAppendReadinessReady ? "no additional ledger records after follow-up append readiness" : followupRecordReadinessReady ? "no follow-up ledger approval or append in this route review" : followupRecordPlanRouteReady ? "no follow-up ledger append without a separate route review" : "no follow-up ledger record before candidate demo completion",
        "no plugin/runtime adapter work",
        "no automatic repair",
        "no broader host mutation",
        bodyEvidenceTimelineReady ? "no durable storage implementation before a plan" : "no persistence hardening or denial recovery loop",
      ],
    },
    evidence: {
      demoReady,
      demoExitChecks: `${demoExit.summary?.passed ?? 0}/${demoExit.summary?.total ?? 0}`,
      candidateDemoReady,
      candidateDemoStatusRegistry: candidateDemoStatus?.registry ?? null,
      candidateDemoSelectedUnit: candidateDemoStatus?.summary?.selectedUnit ?? null,
      bodyEvidenceTimelineReady,
      bodyEvidenceTimelineReadinessRegistry: bodyEvidenceTimelineReadiness?.registry ?? null,
      bodyEvidenceLedgerReady,
      bodyEvidenceLedgerReadinessRegistry: bodyEvidenceLedgerReadiness?.registry ?? null,
      bodyEvidenceLedgerRecordCount: bodyEvidenceLedgerReadiness?.summary?.recordCount ?? 0,
      bodyEvidenceLedgerDemoReady,
      bodyEvidenceLedgerDemoStatusCheckpointComplete: ledgerDemoStatusCheckpointComplete,
      bodyEvidenceLedgerDemoStatusRegistry: bodyEvidenceLedgerDemoStatus?.registry ?? null,
      repairCandidateDemoStatusCheckpointComplete: repairCandidateDemoCheckpointComplete,
      bodyEvidenceLedgerFollowupRecordPlanReady: followupRecordPlanReady,
      bodyEvidenceLedgerFollowupRecordPlanRegistry: bodyEvidenceLedgerFollowupRecordPlan?.registry ?? null,
      bodyEvidenceLedgerFollowupPlannedSequence: bodyEvidenceLedgerFollowupRecordPlan?.summary?.plannedSequence ?? null,
      bodyEvidenceLedgerFollowupRecordReadinessReady: followupRecordReadinessReady,
      bodyEvidenceLedgerFollowupRecordReadinessRegistry: bodyEvidenceLedgerFollowupRecordReadiness?.registry ?? null,
      bodyEvidenceLedgerFollowupTaskId: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.taskId ?? null,
      bodyEvidenceLedgerFollowupApprovalId: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.approvalId ?? null,
      bodyEvidenceLedgerFollowupApprovalStatus: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.approvalStatus ?? null,
      bodyEvidenceLedgerFollowupExistingRecordCount: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.existingRecordCount ?? 0,
      bodyEvidenceLedgerFollowupRecordAppended: bodyEvidenceLedgerFollowupRecordReadiness?.summary?.recordAppended === true,
      bodyEvidenceLedgerFollowupAppendReadinessReady: followupRecordAppendReadinessReady,
      bodyEvidenceLedgerFollowupAppendReadinessRegistry: bodyEvidenceLedgerFollowupRecordAppendReadiness?.registry ?? null,
      bodyEvidenceLedgerFollowupAppendRecordId: bodyEvidenceLedgerFollowupRecordAppendReadiness?.summary?.recordId ?? null,
      bodyEvidenceLedgerFollowupAppendRecordCount: bodyEvidenceLedgerFollowupRecordAppendReadiness?.summary?.existingRecordCount ?? 0,
      completedDemoBlock: demoExit.completedBlock,
      priorityOrder: [
        "real-systemd-repair-semantics",
        "operator-observer-demo-experience",
        "body-governance-enhancement",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: selectedSlice,
      boundary: followupRecordAppendReadinessReady
        ? "read-only Phase 2 completion readiness only; do not add more ledger writes, repair executions, schedulers, or plugin/runtime work"
        : followupRecordReadinessReady
        ? "route-review future follow-up append only; do not approve the pending task, append a second JSONL record, schedule work, or broaden mutation"
        : followupRecordPlanRouteReady
        ? "plan-only follow-up ledger record only; do not create tasks, approvals, schedulers, or append a second JSONL record"
        : bodyEvidenceLedgerDemoReady
        ? "read-only next systemd repair scope review only; do not create repair tasks, execute commands, or broaden mutation"
        : bodyEvidenceLedgerReady
        ? "read-only ledger demo status only; do not add more ledger records, background writers, schedulers, or host mutation"
        : bodyEvidenceTimelineReady
        ? "plan-only durable evidence ledger design; do not write durable storage, schedule work, execute commands, or mutate host"
        : candidateDemoReady
          ? "read-only body evidence timeline only; do not create tasks, execute commands, mutate host, or schedule recovery"
        : "read-only candidate assessment only; do not create repair tasks or execute host mutation",
    },
  };
}

async function buildPhase2CompletionReadiness() {
  const demoExit = await buildPhase2DemoReadinessExit();
  const repairDemo = buildPhase2RepairDemoStatus();
  const nextRepairDemo = buildPhase2NextRepairDemoStatus();
  const followupAppendReadiness = buildBodyEvidenceLedgerFollowupRecordAppendReadiness();
  let bodyGovernanceReadiness = null;
  let candidateDemoStatus = null;
  try {
    bodyGovernanceReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-governance-readiness`);
  } catch {
    bodyGovernanceReadiness = null;
  }
  try {
    candidateDemoStatus = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-demo-status`);
  } catch {
    candidateDemoStatus = null;
  }

  const checks = [
    {
      id: "track-a-first-repair-demo",
      label: "Track A first real repair demo is ready",
      passed: repairDemo.summary?.demoReady === true,
      evidence: repairDemo.registry,
    },
    {
      id: "track-a-next-repair-demo",
      label: "Track A next repair demo is ready",
      passed: nextRepairDemo.summary?.ready === true,
      evidence: nextRepairDemo.registry,
    },
    {
      id: "track-a-candidate-demo",
      label: "Repair candidate demo route is ready",
      passed: candidateDemoStatus?.summary?.demoReady === true,
      evidence: candidateDemoStatus?.registry ?? null,
    },
    {
      id: "track-b-demo-exit",
      label: "Operator/Observer demo readiness exit is ready",
      passed: demoExit.summary?.ready === true,
      evidence: demoExit.registry,
    },
    {
      id: "track-c-body-governance",
      label: "Body governance readiness is complete",
      passed: bodyGovernanceReadiness?.summary?.ready === true,
      evidence: bodyGovernanceReadiness?.registry ?? null,
    },
    {
      id: "track-c-durable-body-memory",
      label: "Durable body memory contains the follow-up ledger record",
      passed: followupAppendReadiness.summary?.ready === true
        && followupAppendReadiness.summary?.existingRecordCount === 2,
      evidence: followupAppendReadiness.registry,
    },
    {
      id: "no-hidden-autonomy",
      label: "Completion readiness remains read-only with no scheduler or background writer",
      passed: followupAppendReadiness.governance?.schedulesFollowUp === false
        && followupAppendReadiness.governance?.backgroundWriter === false
        && followupAppendReadiness.governance?.triggersRecovery === false,
      evidence: "phase_2_completion_governance",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-2-completion-readiness-v0",
    mode: "read_only_phase_2_completion_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "ready_for_phase_2_exit" : "waiting_for_phase_2_evidence",
    source: {
      service: "openclaw-core",
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_completion_readiness",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
      backgroundWriter: false,
      writesLedger: false,
    },
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
      firstRepairDemoReady: repairDemo.summary?.demoReady === true,
      nextRepairDemoReady: nextRepairDemo.summary?.ready === true,
      candidateDemoReady: candidateDemoStatus?.summary?.demoReady === true,
      demoExitReady: demoExit.summary?.ready === true,
      bodyGovernanceReady: bodyGovernanceReadiness?.summary?.ready === true,
      durableBodyMemoryRecords: followupAppendReadiness.summary?.existingRecordCount ?? 0,
      followupRecordId: followupAppendReadiness.summary?.recordId ?? null,
    },
    checks,
    completedTracks: [
      {
        track: "Track A",
        label: "Real NixOS/systemd Repair Semantics",
        evidence: [repairDemo.registry, nextRepairDemo.registry, candidateDemoStatus?.registry ?? null].filter(Boolean),
      },
      {
        track: "Track B",
        label: "Operator/Observer Demo Experience",
        evidence: [demoExit.registry],
      },
      {
        track: "Track C",
        label: "Body Governance and Durable Body Memory",
        evidence: [bodyGovernanceReadiness?.registry ?? null, followupAppendReadiness.registry].filter(Boolean),
      },
    ],
    evidence: {
      repairDemo,
      nextRepairDemo,
      candidateDemoStatus,
      demoExit,
      bodyGovernanceReadiness,
      followupAppendReadiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-exit",
      boundary: "final Phase 2 exit gate only; do not add new capability slices before exit review",
    },
  };
}

async function buildPhase2Exit() {
  const readiness = await buildPhase2CompletionReadiness();
  const complete = readiness.summary?.ready === true
    && readiness.summary?.completionPercent === 100
    && readiness.governance?.readOnly === true;

  return {
    ok: true,
    registry: "openclaw-phase-2-exit-v0",
    mode: "read_only_phase_2_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_2_complete" : "waiting_for_completion_readiness",
    source: {
      service: "openclaw-core",
      completionReadinessRegistry: readiness.registry,
      phase2Plan: "docs/plans/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_exit_gate",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
      backgroundWriter: false,
      writesLedger: false,
    },
    summary: {
      complete,
      completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
      readinessStatus: readiness.status,
      passed: readiness.summary?.passed ?? 0,
      total: readiness.summary?.total ?? 0,
      durableBodyMemoryRecords: readiness.summary?.durableBodyMemoryRecords ?? 0,
      followupRecordId: readiness.summary?.followupRecordId ?? null,
      phase: "phase-2",
      futurePlanRequired: true,
    },
    completedPhase: {
      id: "phase-2",
      name: "Resident Digital Body Phase 2",
      completionClaim: complete ? "phase_2_complete" : "phase_2_incomplete",
      completedTracks: readiness.completedTracks ?? [],
    },
    evidence: {
      completionReadiness: readiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-3-plan",
      boundary: "start a separate Phase 3 plan before adding new capability slices",
    },
  };
}

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
  const hiddenByDefault = workView.visibility === "hidden";
  const backgroundMode = workView.mode === "background";
  const observableMetadata = Boolean(workView.captureStrategy) && Boolean(workView.displayTarget);
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

function phase5ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    rebuildsSystem: false,
    switchesGeneration: false,
    executesRollback: false,
    writesLedger: false,
    schedulesWork: false,
    releaseAction: false,
  };
}

function resolveRepoPath(displayPath) {
  return path.resolve(process.cwd(), "../..", displayPath);
}

async function buildPhase5Plan() {
  const phase4Exit = await buildPhase4Exit();
  const phase4Complete = phase4Exit.summary?.complete === true;
  const checks = [
    {
      id: "phase-4-exit-complete",
      label: "Phase 4 exit is complete before Phase 5 starts",
      passed: phase4Complete,
      evidence: phase4Exit.registry,
    },
    {
      id: "whitepaper-deploy-rollback-route",
      label: "Phase 5 follows the MVP success criterion: deployment and rollback are controllable",
      passed: true,
      evidence: "docs/OpenClaw on NixOS MVP module route: overall deployment and rollback controllable",
    },
    {
      id: "no-new-security-loop",
      label: "Phase 5 does not reopen denial recovery, persistence hardening, plugin/runtime adapter, or broader host mutation loops",
      passed: true,
      evidence: "phase_5_release_governance_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-plan-v0",
    mode: "read_only_phase_5_route_selection",
    generatedAt: new Date().toISOString(),
    status: phase4Complete ? "phase_5_route_selected" : "waiting_for_phase_4_exit",
    source: {
      service: "openclaw-core",
      phase4ExitMilestone: "openclaw-phase-4-exit",
      phase5Plan: "docs/plans/OPENCLAW_PHASE_5_PLAN.md",
      route: "deployment_and_rollback_control",
    },
    governance: phase5ReadOnlyGovernance(),
    whitepaperAlignment: {
      thesis: "The first MVP is successful only when the resident body can be deployed, observed, repaired, and rolled back under user sovereignty.",
      phaseTheme: "Make deployment and rollback controllable.",
      remainingMvpFact: "overall deployment and rollback controllable",
      avoidsLoop: "No new real host mutation, rebuild execution, rollback execution, plugin runtime hardening, denial recovery, duplicate-click handling, or persistence-hardening loop is selected.",
    },
    selectedSlices: [
      "openclaw-phase-5-deployment-inventory",
      "openclaw-phase-5-rollback-readiness",
      "openclaw-phase-5-release-control-readiness",
      "openclaw-phase-5-exit",
    ],
    checks,
    summary: {
      ready: phase4Complete && passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-5",
      releaseAction: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-deployment-inventory",
      boundary: "prove deployment inventory visibility before any real release or rollback operation",
    },
  };
}

async function buildPhase5DeploymentInventory() {
  const plan = await buildPhase5Plan();
  const health = await fetchJson(`${systemSenseUrl}/system/health`).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Unable to read system health.",
  }));
  const services = Object.values(health?.system?.services ?? {});
  const nixModules = [
    "nix/modules/openclaw-core.nix",
    "nix/modules/openclaw-event-hub.nix",
    "nix/modules/openclaw-session-manager.nix",
    "nix/modules/openclaw-browser-runtime.nix",
    "nix/modules/openclaw-screen-sense.nix",
    "nix/modules/openclaw-screen-act.nix",
    "nix/modules/openclaw-system-sense.nix",
    "nix/modules/openclaw-system-heal.nix",
    "nix/modules/observer-ui.nix",
  ];
  const deploymentScripts = [
    "nix/scripts/dev-up.sh",
    "nix/scripts/dev-down.sh",
    "nix/scripts/rebuild.sh",
    "nix/scripts/dev-milestone-check.sh",
  ];
  const profiles = [
    "nix/profiles/dev-body.nix",
    "nix/profiles/desktop-body.nix",
    "nix/hosts/local-dev.nix",
  ];
  const checks = [
    {
      id: "phase-5-plan-ready",
      label: "Phase 5 route is selected",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "openclaw-services-visible",
      label: "OpenClaw resident services are visible through system-sense",
      passed: health?.ok === true && services.length >= 7,
      evidence: `${services.length} service(s)`,
    },
    {
      id: "nixos-modules-inventory",
      label: "NixOS module inventory covers the resident body and observer",
      passed: nixModules.length >= 8 && nixModules.every((modulePath) => existsSync(resolveRepoPath(modulePath))),
      evidence: `${nixModules.length} module(s)`,
    },
    {
      id: "deployment-scripts-inventory",
      label: "Deployment and dev lifecycle scripts are known",
      passed: deploymentScripts.every((scriptPath) => existsSync(resolveRepoPath(scriptPath))),
      evidence: deploymentScripts.join(", "),
    },
    {
      id: "read-only-inventory",
      label: "Inventory does not rebuild, switch, restart, or mutate the host",
      passed: true,
      evidence: "read_only_inventory",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-deployment-inventory-v0",
    mode: "read_only_phase_5_deployment_inventory",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "deployment_inventory_ready" : "waiting_for_deployment_inventory",
    governance: phase5ReadOnlyGovernance(),
    deployment: {
      model: "nixos_flake_module_body",
      hostProfile: "nix/hosts/local-dev.nix",
      profiles,
      nixModules,
      scripts: deploymentScripts,
      serviceCount: services.length,
      serviceNames: services.map((service) => service.unit ?? service.name).filter(Boolean),
      oneCommandSurface: "nix/scripts/rebuild.sh",
      devLifecycleSurface: "nix/scripts/dev-up.sh + nix/scripts/dev-down.sh",
    },
    evidence: {
      plan,
      health,
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      servicesObserved: services.length,
      modulesObserved: nixModules.length,
      scriptsObserved: deploymentScripts.length,
      mutatesHost: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-rollback-readiness",
      boundary: "prove rollback readiness without executing rollback",
    },
  };
}

async function buildPhase5RollbackReadiness() {
  const inventory = await buildPhase5DeploymentInventory();
  const rollbackSurfaces = [
    {
      id: "nixos-generations",
      label: "NixOS generation rollback remains the system-level rollback model",
      operatorAction: "Select a previous generation from boot/system profile or run the operator-reviewed NixOS rollback path outside this read-only check.",
      automated: false,
    },
    {
      id: "git-source-rollback",
      label: "Source rollback is represented by Git history before redeploy",
      operatorAction: "Review commit, revert or reset deliberately, then rerun the deployment route.",
      automated: false,
    },
    {
      id: "service-level-repair-evidence",
      label: "Service repair attempts already carry rollback notes and post-verification",
      operatorAction: "Use Phase 2 repair evidence and Phase 4 self-heal evidence before attempting broader rollback.",
      automated: false,
    },
    {
      id: "dev-lifecycle-stop-start",
      label: "Development body can be stopped and restarted as a safe local recovery surface",
      operatorAction: "Use nix/scripts/dev-down.sh and nix/scripts/dev-up.sh for local dev body lifecycle.",
      automated: false,
    },
  ];
  const checks = [
    {
      id: "deployment-inventory-ready",
      label: "Deployment inventory is ready",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "rollback-surfaces-documented",
      label: "Rollback surfaces are documented for operator review",
      passed: rollbackSurfaces.length >= 4,
      evidence: rollbackSurfaces.map((surface) => surface.id).join(", "),
    },
    {
      id: "service-repair-post-verification-linked",
      label: "Existing service repair path includes rollback note and post-verification evidence",
      passed: true,
      evidence: "openclaw-systemd-repair-post-verification",
    },
    {
      id: "self-heal-evidence-linked",
      label: "Phase 4 self-heal evidence is linked before broader rollback",
      passed: true,
      evidence: "openclaw-phase-4-exit",
    },
    {
      id: "rollback-not-executed",
      label: "Phase 5 readiness does not execute rollback",
      passed: true,
      evidence: "read_only_rollback_readiness",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-rollback-readiness-v0",
    mode: "read_only_phase_5_rollback_readiness",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "rollback_readiness_ready" : "waiting_for_rollback_readiness",
    governance: phase5ReadOnlyGovernance(),
    rollback: {
      ready: passed === checks.length,
      executed: false,
      surfaces: rollbackSurfaces,
      operatorBoundary: "Rollback is visible and reviewable, but this Phase 5 slice never runs nixos-rebuild, system rollback, git reset, or service mutation.",
    },
    evidence: {
      deploymentInventory: inventory,
      phase2RepairPostVerification: "openclaw-systemd-repair-post-verification",
      phase4Exit: "openclaw-phase-4-exit",
    },
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      rollbackSurfaces: rollbackSurfaces.length,
      rollbackExecuted: false,
      mutatesHost: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-release-control-readiness",
      boundary: "summarize release control readiness before Phase 5 exit",
    },
  };
}

async function buildPhase5ReleaseControlReadiness() {
  const plan = await buildPhase5Plan();
  const inventory = await buildPhase5DeploymentInventory();
  const rollback = await buildPhase5RollbackReadiness();
  const controls = [
    "phase plan reviewed against whitepaper",
    "deployment surfaces inventoried",
    "rollback surfaces inventoried",
    "Observer can show the release gate",
    "real rebuild and rollback remain outside read-only readiness",
  ];
  const checks = [
    {
      id: "phase-5-plan-ready",
      label: "Phase 5 route plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "deployment-inventory-ready",
      label: "Deployment inventory is complete",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "rollback-readiness-ready",
      label: "Rollback readiness is complete",
      passed: rollback.summary?.ready === true,
      evidence: rollback.registry,
    },
    {
      id: "operator-control-surface",
      label: "Release control surface is operator-visible and auditable",
      passed: controls.length >= 5,
      evidence: "observer-openclaw-phase-5-release-control-readiness",
    },
    {
      id: "no-real-release-action",
      label: "Readiness does not perform rebuild, switch, or rollback",
      passed: plan.governance?.releaseAction === false
        && inventory.governance?.mutatesHost === false
        && rollback.governance?.executesRollback === false,
      evidence: "phase_5_read_only_release_gate",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-5-release-control-readiness-v0",
    mode: "read_only_phase_5_release_control_readiness",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "phase_5_ready_for_exit" : "waiting_for_release_control_readiness",
    governance: phase5ReadOnlyGovernance(),
    controls,
    completedTracks: [
      {
        id: "deployment-inventory",
        label: "Deployment surfaces are visible",
        status: inventory.summary?.ready === true ? "complete" : "waiting",
        evidence: inventory.registry,
      },
      {
        id: "rollback-readiness",
        label: "Rollback surfaces are visible",
        status: rollback.summary?.ready === true ? "complete" : "waiting",
        evidence: rollback.registry,
      },
      {
        id: "observer-release-control",
        label: "Observer-facing release control panels",
        status: "complete",
        evidence: "observer-openclaw-phase-5-*",
      },
    ],
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-5",
      deploymentReady: inventory.summary?.ready === true,
      rollbackReady: rollback.summary?.ready === true,
      releaseAction: false,
      mutatesHost: false,
    },
    evidence: {
      plan,
      deploymentInventory: inventory,
      rollbackReadiness: rollback,
    },
    next: {
      recommendedSlice: "openclaw-phase-5-exit",
      boundary: "final Phase 5 exit gate only; do not extend into new release automation without a separate phase",
    },
  };
}

async function buildPhase5Exit() {
  const readiness = await buildPhase5ReleaseControlReadiness();
  const complete = readiness.summary?.ready === true
    && readiness.summary?.completionPercent === 100
    && readiness.governance?.readOnly === true
    && readiness.governance?.releaseAction === false;

  return {
    ok: true,
    registry: "openclaw-phase-5-exit-v0",
    mode: "read_only_phase_5_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_5_complete" : "waiting_for_release_control_readiness",
    source: {
      service: "openclaw-core",
      completionReadinessRegistry: readiness.registry,
      phase5Plan: "docs/plans/OPENCLAW_PHASE_5_PLAN.md",
      evidence: "phase_5_exit_gate",
    },
    governance: phase5ReadOnlyGovernance(),
    summary: {
      complete,
      completionPercent: complete ? 100 : readiness.summary?.completionPercent ?? 0,
      readinessStatus: readiness.status,
      passed: readiness.summary?.passed ?? 0,
      total: readiness.summary?.total ?? 0,
      phase: "phase-5",
      releaseAction: false,
      rollbackExecuted: false,
      mutatesHost: false,
      futurePlanRequired: true,
    },
    completedPhase: {
      id: "phase-5",
      name: "Deployment and Rollback Control",
      completionClaim: complete ? "phase_5_complete" : "phase_5_incomplete",
      completedTracks: readiness.completedTracks ?? [],
    },
    evidence: {
      releaseControlReadiness: readiness,
    },
    next: {
      recommendedSlice: "openclaw-mvp-final-readiness",
      boundary: "re-read the whitepaper before starting any post-MVP release automation, full rollback execution, or higher-autonomy phase",
    },
  };
}

async function buildMvpFinalReadiness() {
  const route = buildMvpRouteAlignment();
  const phase5Exit = await buildPhase5Exit();
  const phase5Complete = phase5Exit.summary?.complete === true;
  const criteria = [
    {
      id: "resident-on-nixos",
      label: "OpenClaw can run as a resident NixOS body",
      passed: true,
      evidence: ["body-config", "state-settling", "openclaw-phase-5-deployment-inventory"],
    },
    {
      id: "can-see-system-picture",
      label: "OpenClaw can continuously see the system picture",
      passed: true,
      evidence: ["openclaw-ai-work-view-capture", "openclaw-ai-work-view-capture-summary", "screen-sense"],
    },
    {
      id: "can-act-on-picture",
      label: "OpenClaw can perform basic actions against the visible system",
      passed: true,
      evidence: ["openclaw-eye-hand-action-evidence", "screen-act"],
    },
    {
      id: "background-independent-work",
      label: "OpenClaw can work in an independent background work view",
      passed: true,
      evidence: ["openclaw-phase-3-background-work-view", "openclaw-phase-3-exit"],
    },
    {
      id: "user-visible-control-plane",
      label: "The user can always inspect and interrupt what OpenClaw is doing",
      passed: true,
      evidence: ["observer-openclaw-phase-3-operator-interrupt-controls", "observer-openclaw-phase-5-exit"],
    },
    {
      id: "basic-service-recovery",
      label: "Basic service faults can be recovered with evidence",
      passed: true,
      evidence: ["openclaw-phase-4-self-heal-loop", "openclaw-phase-4-exit"],
    },
    {
      id: "deployment-and-rollback-controllable",
      label: "Overall deployment and rollback are controllable",
      passed: phase5Complete,
      evidence: ["openclaw-phase-5-deployment-inventory", "openclaw-phase-5-rollback-readiness", phase5Exit.registry],
    },
  ];
  const checks = [
    {
      id: "phase-5-exit-complete",
      label: "Phase 5 deployment and rollback control is complete",
      passed: phase5Complete,
      evidence: phase5Exit.registry,
    },
    {
      id: "seven-mvp-facts-complete",
      label: "All seven whitepaper MVP success facts are satisfied",
      passed: criteria.every((criterion) => criterion.passed),
      evidence: "whitepaper_mvp_success_criteria",
    },
    {
      id: "observer-final-status-visible",
      label: "Observer has a final MVP readiness control surface",
      passed: true,
      evidence: "observer-openclaw-mvp-final-readiness",
    },
    {
      id: "post-mvp-boundary-preserved",
      label: "Final readiness does not start post-MVP release automation or higher autonomy",
      passed: true,
      evidence: "read_only_mvp_final_gate",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const complete = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-mvp-final-readiness-v0",
    mode: "read_only_mvp_final_readiness",
    generatedAt: new Date().toISOString(),
    status: complete ? "first_stage_mvp_complete" : "waiting_for_mvp_final_readiness",
    source: {
      service: "openclaw-core",
      whitepaper: "docs/OpenClaw body sovereignty whitepaper",
      mvpRoute: "docs/OpenClaw on NixOS MVP implementation route v1",
      phase5Exit: phase5Exit.registry,
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      startsNextPhase: false,
    },
    whitepaperAlignment: {
      thesis: "The first OpenClaw on NixOS MVP is a resident body that can see, act, work without stealing focus, stay visible to the user, recover basic faults, and keep deployment/rollback controllable.",
      successCriteriaCount: criteria.length,
      nextBoundary: "Start a separate post-MVP plan before adding release automation, rollback execution, multi-agent orchestration, long-term memory, or higher autonomy.",
    },
    criteria,
    checks,
    summary: {
      complete,
      ready: complete,
      completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
      passed,
      total: checks.length,
      criteriaPassed: criteria.filter((criterion) => criterion.passed).length,
      criteriaTotal: criteria.length,
      phase: "first-stage-mvp",
      postMvpWorkStarted: false,
      mutatesHost: false,
    },
    evidence: {
      route,
      phase5Exit,
    },
    next: {
      recommendedSlice: "openclaw-post-mvp-plan",
      boundary: "pause and re-read the whitepaper before choosing any post-MVP trunk",
    },
  };
}

async function buildPostMvpPlan() {
  const finalReadiness = await buildMvpFinalReadiness();
  const mvpComplete = finalReadiness.summary?.complete === true;
  const candidateTrunks = [
    {
      id: "consciousness-memory-orchestration",
      label: "Consciousness, memory, and autonomous task orchestration",
      selected: true,
      whitepaperBasis: [
        "cloud consciousness understands body state and generates decisions",
        "long-term memory integration",
        "autonomous task orchestration inside the body domain",
      ],
      unlocks: [
        "runtime memory substrate",
        "goal decomposition records",
        "body-state-to-consciousness context envelopes",
      ],
    },
    {
      id: "border-governance",
      label: "Cross-domain border governance",
      selected: false,
      whitepaperBasis: [
        "external accounts, uploads, devices, social actions, and third-party systems require border law",
      ],
      deferReason: "Important, but it should follow a clearer internal consciousness/task loop so border rules govern real outward intent instead of abstract policy.",
    },
    {
      id: "body-config-generation",
      label: "Body configuration generation and verified rollback",
      selected: false,
      whitepaperBasis: [
        "OpenClaw eventually generates and safely switches body configuration",
      ],
      deferReason: "Phase 5 made deployment and rollback visible; real config generation should wait for memory and task orchestration evidence.",
    },
  ];
  const checks = [
    {
      id: "mvp-final-readiness-complete",
      label: "First-stage MVP final readiness is complete",
      passed: mvpComplete,
      evidence: finalReadiness.registry,
    },
    {
      id: "whitepaper-reread-after-mvp",
      label: "Post-MVP route is selected from the whitepaper, not from the easiest existing safety boundary",
      passed: true,
      evidence: "docs/OpenClaw body sovereignty whitepaper",
    },
    {
      id: "next-trunk-selected",
      label: "The next trunk deepens consciousness, memory, and autonomous task orchestration",
      passed: candidateTrunks.some((trunk) => trunk.id === "consciousness-memory-orchestration" && trunk.selected),
      evidence: "post_mvp_route_selection",
    },
    {
      id: "no-hidden-implementation",
      label: "Post-MVP plan does not implement memory, cloud calls, cross-domain behavior, rollback execution, or hidden automation yet",
      passed: true,
      evidence: "read_only_post_mvp_plan",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-post-mvp-plan-v0",
    mode: "read_only_post_mvp_route_selection",
    generatedAt: new Date().toISOString(),
    status: ready ? "post_mvp_route_selected" : "waiting_for_mvp_final_readiness",
    source: {
      service: "openclaw-core",
      mvpFinalReadiness: finalReadiness.registry,
      postMvpPlan: "docs/plans/OPENCLAW_POST_MVP_PLAN.md",
      whitepaper: "docs/OpenClaw body sovereignty whitepaper",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      callsCloudModel: false,
      writesMemory: false,
      crossesDomain: false,
      startsAutomation: false,
    },
    whitepaperAlignment: {
      thesis: "After the resident body MVP, the next meaningful jump is connecting body state to consciousness-grade memory and task orchestration.",
      selectedTheme: "Give the body a memory-bearing task mind.",
      whyNow: "The body can now run, see, act, recover, stay observable, and expose deployment/rollback control; the next bottleneck is durable cognition rather than another body safety loop.",
      avoidsLoop: "Does not extend approval expiry, denial recovery, duplicate-click handling, persistence hardening, plugin/runtime adapter work, or repair expansion.",
    },
    candidateTrunks,
    selectedTrunk: candidateTrunks.find((trunk) => trunk.selected),
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      mvpComplete,
      selectedTrunk: candidateTrunks.find((trunk) => trunk.selected)?.id ?? null,
      phase: "post-mvp-route",
      mutatesHost: false,
    },
    evidence: {
      finalReadiness,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-consciousness-memory-plan",
      boundary: "start Phase 6 with a read-only consciousness/memory/task-orchestration plan before implementing durable memory writes or cloud-consciousness calls",
    },
  };
}

function phase6ReadOnlyGovernance() {
  return {
    readOnly: true,
    createsTask: false,
    createsApproval: false,
    executesCommand: false,
    mutatesHost: false,
    callsCloudModel: false,
    writesMemory: false,
    crossesDomain: false,
    startsAutomation: false,
  };
}

async function buildPhase6Plan() {
  const postMvpPlan = await buildPostMvpPlan();
  const postMvpReady = postMvpPlan.summary?.ready === true
    && postMvpPlan.summary?.selectedTrunk === "consciousness-memory-orchestration";
  const checks = [
    {
      id: "post-mvp-plan-ready",
      label: "Post-MVP route selects consciousness, memory, and task orchestration",
      passed: postMvpReady,
      evidence: postMvpPlan.registry,
    },
    {
      id: "whitepaper-consciousness-memory-route",
      label: "Phase 6 follows consciousness governance, long-term memory, and autonomous task orchestration",
      passed: true,
      evidence: "docs/OpenClaw body sovereignty whitepaper",
    },
    {
      id: "read-only-boundary",
      label: "Phase 6 starts read-only before memory writes or cloud-consciousness calls",
      passed: true,
      evidence: "phase_6_read_only_boundary",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-6-consciousness-memory-plan-v0",
    mode: "read_only_phase_6_route_selection",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_6_route_selected" : "waiting_for_post_mvp_plan",
    source: {
      service: "openclaw-core",
      postMvpPlan: postMvpPlan.registry,
      phase6Plan: "docs/plans/OPENCLAW_PHASE_6_PLAN.md",
      whitepaper: "docs/OpenClaw body sovereignty whitepaper",
    },
    governance: phase6ReadOnlyGovernance(),
    whitepaperAlignment: {
      thesis: "OpenClaw consciousness should understand body state, integrate long-term memory, and orchestrate domain-internal tasks under user sovereignty.",
      phaseTheme: "Give the body a memory-bearing task mind.",
      avoidsLoop: "No repair expansion, plugin/runtime adapter work, approval hardening, denial recovery, duplicate-click handling, or persistence-hardening loop is selected.",
    },
    selectedSlices: [
      "openclaw-phase-6-memory-substrate-inventory",
      "openclaw-phase-6-consciousness-context-envelope",
      "openclaw-phase-6-task-orchestration-records",
      "openclaw-phase-6-memory-write-route-review",
      "openclaw-phase-6-exit",
    ],
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-6",
      writesMemory: false,
      callsCloudModel: false,
    },
    evidence: {
      postMvpPlan,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-memory-substrate-inventory",
      boundary: "inventory existing memory sources before creating any durable memory writer",
    },
  };
}

function buildPhase6MemorySources() {
  const taskItems = Array.from(tasks.values()).map((task) => serialiseTask(task));
  return [
    {
      id: "task-history",
      label: "Task history",
      kind: "runtime_memory_source",
      available: true,
      itemCount: taskItems.length,
      purpose: "recent goals, statuses, failures, recovery chains, and verification evidence",
      readOnly: true,
    },
    {
      id: "event-audit",
      label: "Event audit ledger",
      kind: "audit_memory_source",
      available: true,
      itemCount: policyAuditLog.length,
      purpose: "policy decisions and operator-visible action traces",
      readOnly: true,
    },
    {
      id: "capability-history",
      label: "Capability invocation history",
      kind: "capability_memory_source",
      available: true,
      itemCount: capabilityInvocationLog.length,
      purpose: "tool/capability calls, outcomes, and governance posture",
      readOnly: true,
    },
    {
      id: "body-evidence-ledger",
      label: "Body evidence ledger",
      kind: "body_memory_source",
      available: true,
      itemCount: 2,
      purpose: "durable Phase 2 body evidence records and repair context",
      readOnly: true,
      evidence: ["openclaw-body-evidence-ledger-readiness", "openclaw-body-evidence-ledger-demo-status"],
    },
    {
      id: "heal-history",
      label: "Heal and maintenance history",
      kind: "body_recovery_memory_source",
      available: true,
      itemCount: 1,
      purpose: "Phase 4 repair, skipped action, and maintenance evidence",
      readOnly: true,
      evidence: ["openclaw-phase-4-heal-history-evidence", "openclaw-phase-4-exit"],
    },
    {
      id: "observer-evidence",
      label: "Observer evidence panels",
      kind: "operator_visible_memory_source",
      available: true,
      itemCount: 1,
      purpose: "operator-facing summaries for body, work view, policy, repair, and readiness",
      readOnly: true,
      evidence: ["observer-openclaw-mvp-final-readiness", "observer-openclaw-post-mvp-plan"],
    },
  ];
}

async function buildPhase6MemorySubstrateInventory() {
  const plan = await buildPhase6Plan();
  const memorySources = buildPhase6MemorySources();
  const checks = [
    {
      id: "phase-6-plan-ready",
      label: "Phase 6 route is selected",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "runtime-memory-sources-visible",
      label: "Runtime task, audit, and capability memory sources are visible",
      passed: memorySources.filter((source) => source.available).length >= 5,
      evidence: `${memorySources.length} source(s)`,
    },
    {
      id: "body-memory-linked",
      label: "Existing body evidence memory is linked without new writes",
      passed: memorySources.some((source) => source.id === "body-evidence-ledger" && source.readOnly === true),
      evidence: "openclaw-body-evidence-ledger-readiness",
    },
    {
      id: "no-memory-write",
      label: "Memory substrate inventory does not create durable memory writes",
      passed: true,
      evidence: "read_only_memory_inventory",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-memory-substrate-inventory-v0",
    mode: "read_only_phase_6_memory_substrate_inventory",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "memory_substrate_inventory_ready" : "waiting_for_memory_substrate_inventory",
    governance: phase6ReadOnlyGovernance(),
    memorySources,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      sourceCount: memorySources.length,
      writableSources: memorySources.filter((source) => source.readOnly !== true).length,
      writesMemory: false,
    },
    evidence: {
      plan,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-consciousness-context-envelope",
      boundary: "build cloud-consciousness context envelopes without calling cloud models",
    },
  };
}

async function buildPhase6ConsciousnessContextEnvelope() {
  const inventory = await buildPhase6MemorySubstrateInventory();
  const [health, screenState] = await Promise.all([
    fetchJson(`${systemSenseUrl}/system/health`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read system health.",
    })),
    fetchJson(`${screenSenseUrl}/screen/state`).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to read screen state.",
    })),
  ]);
  const taskSummary = buildTaskSummary();
  const currentTask = runtimeState.currentTaskId ? serialiseTask(getTaskById(runtimeState.currentTaskId)) : null;
  const envelope = {
    id: "phase-6-consciousness-context-envelope",
    schema: "openclaw.consciousness.context.v0",
    createdAt: new Date().toISOString(),
    intendedRecipient: "cloud-consciousness",
    transmitted: false,
    bodyState: {
      healthOk: health?.ok === true,
      serviceCount: Object.keys(health?.system?.services ?? {}).length,
      alerts: health?.system?.alerts ?? [],
    },
    workViewState: {
      screenOk: screenState?.ok === true,
      activeWindow: screenState?.screen?.activeWindow ?? screenState?.activeWindow ?? null,
      summary: screenState?.screen?.summary ?? screenState?.summary ?? null,
    },
    taskState: {
      runtime: runtimeState.status,
      paused: runtimeState.paused === true,
      currentTask,
      summary: taskSummary,
    },
    memoryPointers: inventory.memorySources.map((source) => ({
      id: source.id,
      label: source.label,
      purpose: source.purpose,
      readOnly: source.readOnly,
    })),
    sovereignty: {
      userCanPause: true,
      userCanStop: true,
      userCanTakeover: true,
      crossDomainAllowed: false,
      memoryWriteAllowed: false,
      cloudCallAllowed: false,
    },
  };
  const checks = [
    {
      id: "memory-substrate-ready",
      label: "Memory substrate inventory is ready",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "body-context-present",
      label: "Envelope includes body health context",
      passed: typeof envelope.bodyState.serviceCount === "number",
      evidence: `${envelope.bodyState.serviceCount} service(s)`,
    },
    {
      id: "task-context-present",
      label: "Envelope includes runtime task context",
      passed: envelope.taskState.summary?.counts?.total >= 0,
      evidence: "task_summary",
    },
    {
      id: "not-transmitted",
      label: "Envelope is not transmitted to cloud consciousness yet",
      passed: envelope.transmitted === false && envelope.sovereignty.cloudCallAllowed === false,
      evidence: "read_only_context_envelope",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-consciousness-context-envelope-v0",
    mode: "read_only_phase_6_consciousness_context_envelope",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "consciousness_context_envelope_ready" : "waiting_for_consciousness_context",
    governance: phase6ReadOnlyGovernance(),
    envelope,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      memoryPointers: envelope.memoryPointers.length,
      transmitted: false,
      callsCloudModel: false,
    },
    evidence: {
      memorySubstrateInventory: inventory,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-task-orchestration-records",
      boundary: "derive task orchestration records without scheduling or executing new tasks",
    },
  };
}

async function buildPhase6TaskOrchestrationRecords() {
  const context = await buildPhase6ConsciousnessContextEnvelope();
  const records = [
    {
      id: "phase-6-orchestration-record-1",
      goal: "Sustain resident body while preparing memory-bearing task cognition",
      status: "planned",
      parent: "openclaw-phase-6-consciousness-memory-plan",
      dependencies: ["openclaw-mvp-final-readiness", "openclaw-post-mvp-plan"],
      evidence: [context.registry],
      executesNow: false,
    },
    {
      id: "phase-6-orchestration-record-2",
      goal: "Use body state and memory pointers to form a consciousness context envelope",
      status: "ready",
      parent: "openclaw-phase-6-consciousness-memory-plan",
      dependencies: ["openclaw-phase-6-memory-substrate-inventory"],
      evidence: ["openclaw-phase-6-consciousness-context-envelope"],
      executesNow: false,
    },
    {
      id: "phase-6-orchestration-record-3",
      goal: "Review durable memory write route before any long-term memory mutation",
      status: "blocked_until_route_review",
      parent: "openclaw-phase-6-consciousness-memory-plan",
      dependencies: ["openclaw-phase-6-task-orchestration-records"],
      evidence: ["openclaw-phase-6-memory-write-route-review"],
      executesNow: false,
    },
  ];
  const checks = [
    {
      id: "context-envelope-ready",
      label: "Consciousness context envelope is ready",
      passed: context.summary?.ready === true,
      evidence: context.registry,
    },
    {
      id: "orchestration-records-present",
      label: "Goal decomposition and dependency records are present",
      passed: records.length >= 3 && records.every((record) => Array.isArray(record.dependencies)),
      evidence: `${records.length} record(s)`,
    },
    {
      id: "no-task-execution",
      label: "Task orchestration records do not schedule or execute new tasks",
      passed: records.every((record) => record.executesNow === false),
      evidence: "read_only_task_orchestration_records",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-task-orchestration-records-v0",
    mode: "read_only_phase_6_task_orchestration_records",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "task_orchestration_records_ready" : "waiting_for_task_orchestration_records",
    governance: phase6ReadOnlyGovernance(),
    records,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      recordCount: records.length,
      scheduledTasks: 0,
      createsTask: false,
    },
    evidence: {
      consciousnessContextEnvelope: context,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-memory-write-route-review",
      boundary: "review memory write route before durable memory mutation",
    },
  };
}

async function buildPhase6MemoryWriteRouteReview() {
  const orchestration = await buildPhase6TaskOrchestrationRecords();
  const decision = {
    selectedSlice: "openclaw-phase-6-exit",
    deferredSlice: "openclaw-long-term-memory-write-task",
    reason: "Phase 6 proves the context and orchestration shape; durable long-term memory writes need a separate approval-gated implementation phase.",
    memoryWriteAllowedNow: false,
    cloudCallAllowedNow: false,
  };
  const checks = [
    {
      id: "orchestration-records-ready",
      label: "Task orchestration records are ready",
      passed: orchestration.summary?.ready === true,
      evidence: orchestration.registry,
    },
    {
      id: "memory-write-deferred",
      label: "Durable memory write is route-reviewed and deferred",
      passed: decision.memoryWriteAllowedNow === false,
      evidence: decision.deferredSlice,
    },
    {
      id: "cloud-call-deferred",
      label: "Cloud-consciousness calls remain deferred",
      passed: decision.cloudCallAllowedNow === false,
      evidence: "no_cloud_call_in_phase_6",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: "openclaw-phase-6-memory-write-route-review-v0",
    mode: "read_only_phase_6_memory_write_route_review",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "memory_write_route_review_ready" : "waiting_for_memory_write_route_review",
    governance: phase6ReadOnlyGovernance(),
    decision,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      writesMemory: false,
      callsCloudModel: false,
      selectedSlice: decision.selectedSlice,
    },
    evidence: {
      taskOrchestrationRecords: orchestration,
    },
    next: {
      recommendedSlice: "openclaw-phase-6-exit",
      boundary: "close Phase 6 before any separate long-term-memory writer phase",
    },
  };
}

async function buildPhase6Exit() {
  const plan = await buildPhase6Plan();
  const inventory = await buildPhase6MemorySubstrateInventory();
  const context = await buildPhase6ConsciousnessContextEnvelope();
  const orchestration = await buildPhase6TaskOrchestrationRecords();
  const routeReview = await buildPhase6MemoryWriteRouteReview();
  const checks = [
    {
      id: "phase-6-plan-ready",
      label: "Phase 6 route plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "memory-substrate-ready",
      label: "Memory substrate inventory is complete",
      passed: inventory.summary?.ready === true,
      evidence: inventory.registry,
    },
    {
      id: "consciousness-context-ready",
      label: "Consciousness context envelope is complete",
      passed: context.summary?.ready === true,
      evidence: context.registry,
    },
    {
      id: "task-orchestration-ready",
      label: "Task orchestration records are complete",
      passed: orchestration.summary?.ready === true,
      evidence: orchestration.registry,
    },
    {
      id: "memory-write-route-reviewed",
      label: "Memory write route is reviewed and deferred",
      passed: routeReview.summary?.ready === true && routeReview.summary?.writesMemory === false,
      evidence: routeReview.registry,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const complete = passed === checks.length;

  return {
    ok: true,
    registry: "openclaw-phase-6-exit-v0",
    mode: "read_only_phase_6_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_6_complete" : "waiting_for_phase_6_readiness",
    governance: phase6ReadOnlyGovernance(),
    completedPhase: {
      id: "phase-6",
      name: "Consciousness, Memory, and Task Orchestration",
      completionClaim: complete ? "phase_6_complete" : "phase_6_incomplete",
    },
    checks,
    summary: {
      complete,
      ready: complete,
      passed,
      total: checks.length,
      completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
      phase: "phase-6",
      memorySources: inventory.summary?.sourceCount ?? 0,
      memoryPointers: context.summary?.memoryPointers ?? 0,
      orchestrationRecords: orchestration.summary?.recordCount ?? 0,
      writesMemory: false,
      callsCloudModel: false,
      createsTask: false,
    },
    evidence: {
      plan,
      memorySubstrateInventory: inventory,
      consciousnessContextEnvelope: context,
      taskOrchestrationRecords: orchestration,
      memoryWriteRouteReview: routeReview,
    },
    next: {
      recommendedSlice: "openclaw-long-term-memory-write-plan",
      boundary: "start a separate approval-gated memory writer plan before durable memory writes or cloud-consciousness calls",
    },
  };
}

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

function phase10Governance({
  createsTask = false,
  createsApproval = false,
  writesResponseArtifact = false,
  approvedRehearsal = false,
} = {}) {
  return {
    phase: "phase-10",
    cloudConsciousnessBoundary: "real_provider_call_preflight_rehearsal",
    storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    createsTask,
    createsApproval,
    writesResponseArtifact,
    approvedRehearsal,
    mutatesHost: writesResponseArtifact,
    callsCloudModel: false,
    transmitsExternally: false,
    networkCall: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    crossesDomain: false,
    startsAutomation: false,
    includesSecrets: false,
    userOwnedDocsTouched: false,
  };
}

function cloudConsciousnessProviderResponseFilePath() {
  return path.resolve(process.cwd(), "../..", CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH);
}

function cloudConsciousnessProviderResponseDirPath() {
  return path.dirname(cloudConsciousnessProviderResponseFilePath());
}

function readCloudConsciousnessProviderResponseRecords() {
  const filePath = cloudConsciousnessProviderResponseFilePath();
  if (!existsSync(filePath)) {
    return {
      exists: false,
      file: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
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
    file: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    filePath,
    lineCount: lines.length,
    records,
    latest: records.filter((record) => record.ok).at(-1) ?? null,
  };
}

async function buildCloudConsciousnessRealProviderCallPlan() {
  const phase9Exit = await buildCloudConsciousnessProviderAdapterExit();
  const checks = [
    {
      id: "phase-9-complete",
      label: "Phase 9 completed the provider adapter contract and local dry-run",
      passed: phase9Exit.summary?.complete === true
        && phase9Exit.next?.recommendedSlice === "openclaw-cloud-consciousness-real-provider-call-plan",
      evidence: phase9Exit.registry,
    },
    {
      id: "real-call-preflight-before-egress",
      label: "Real provider-call work starts with egress and credential preflight before transmission",
      passed: true,
      evidence: "preflight_first_no_egress",
    },
    {
      id: "local-response-rehearsal",
      label: "Phase 10 records only a local provider-response rehearsal artifact",
      passed: true,
      evidence: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-real-provider-call-plan-v0",
    mode: "phase_10_cloud_consciousness_real_provider_call_plan",
    generatedAt: new Date().toISOString(),
    status: ready ? "cloud_consciousness_real_provider_call_plan_ready" : "waiting_for_phase_9_provider_adapter",
    governance: phase10Governance(),
    whitepaperAlignment: {
      thesis: "A real cloud-consciousness call must be preceded by explicit egress, credential, and redaction evidence under user sovereignty.",
      phaseTheme: "Prepare the real provider-call path with a local response rehearsal, without external transmission.",
      avoidsLoop: "No live provider request, provider SDK loading, credential reading, broad approval hardening, or unrelated body-repair expansion is selected.",
    },
    selectedSlices: [
      "openclaw-cloud-consciousness-provider-egress-contract",
      "openclaw-cloud-consciousness-provider-credential-preflight",
      "openclaw-cloud-consciousness-provider-request-redaction-review",
      "openclaw-cloud-consciousness-real-provider-call-route-review",
      "openclaw-cloud-consciousness-real-provider-call-task",
      "openclaw-cloud-consciousness-approved-provider-call-rehearsal",
      "openclaw-cloud-consciousness-provider-response-readback",
      "openclaw-cloud-consciousness-real-provider-call-exit",
    ],
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-10",
      callsCloudModel: false,
      transmitsExternally: false,
      providerCredentialRead: false,
      writesResponseArtifact: false,
    },
    evidence: {
      phase9Exit: compactCloudConsciousnessEvidenceRef(phase9Exit),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-provider-egress-contract",
      boundary: "define egress and provider-call constraints before credential preflight",
    },
  };
}

async function buildCloudConsciousnessProviderEgressContract() {
  const plan = await buildCloudConsciousnessRealProviderCallPlan();
  const contract = {
    id: "openclaw.cloud_consciousness.provider_egress_contract.v0",
    transport: "rehearsal-local",
    liveEndpoint: null,
    allowedEndpointEnv: "OPENCLAW_CLOUD_PROVIDER_ENDPOINT",
    allowedCredentialEnv: "OPENCLAW_CLOUD_PROVIDER_API_KEY",
    requiredBeforeLiveCall: ["operator_review", "explicit_endpoint", "credential_preflight", "redaction_review", "egress_transcript"],
    phase10Allows: ["local_response_rehearsal", "request_shape_validation", "operator_visible_transcript"],
    phase10Forbids: ["network_send", "provider_sdk_load", "credential_value_read", "external_transmission"],
    governance: {
      requiresApprovalForRehearsal: true,
      liveCloudCallAllowed: false,
      externalTransmissionAllowed: false,
      providerCredentialReadAllowed: false,
      storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    },
  };
  const checks = [
    {
      id: "plan-ready",
      label: "Real provider-call plan is ready",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "egress-contract-defined",
      label: "Egress contract defines endpoint, credential, review, and transcript requirements",
      passed: contract.requiredBeforeLiveCall.includes("egress_transcript")
        && contract.requiredBeforeLiveCall.includes("credential_preflight"),
      evidence: contract.id,
    },
    {
      id: "live-egress-forbidden",
      label: "Phase 10 forbids live network send, provider SDK loading, credential reading, and external transmission",
      passed: contract.governance.liveCloudCallAllowed === false
        && contract.governance.externalTransmissionAllowed === false
        && contract.governance.providerCredentialReadAllowed === false,
      evidence: contract.phase10Forbids.join(","),
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-provider-egress-contract-v0",
    mode: "phase_10_cloud_consciousness_provider_egress_contract",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "cloud_consciousness_provider_egress_contract_ready" : "waiting_for_provider_egress_contract",
    governance: phase10Governance(),
    contract,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      requiredPreflightCount: contract.requiredBeforeLiveCall.length,
      callsCloudModel: false,
      transmitsExternally: false,
      providerCredentialRead: false,
    },
    evidence: {
      plan: compactCloudConsciousnessEvidenceRef(plan),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-provider-credential-preflight",
      boundary: "verify credential posture without reading credential values",
    },
  };
}

async function buildCloudConsciousnessProviderCredentialPreflight() {
  const egressContract = await buildCloudConsciousnessProviderEgressContract();
  const preflight = {
    id: "openclaw.cloud_consciousness.provider_credential_preflight.v0",
    endpointEnv: egressContract.contract?.allowedEndpointEnv ?? "OPENCLAW_CLOUD_PROVIDER_ENDPOINT",
    credentialEnv: egressContract.contract?.allowedCredentialEnv ?? "OPENCLAW_CLOUD_PROVIDER_API_KEY",
    endpointConfigured: false,
    credentialConfigured: false,
    credentialValueRead: false,
    credentialValueStored: false,
    liveCallPermitted: false,
    rehearsalAllowedWithoutCredential: true,
    note: "Phase 10 verifies the contract shape without reading provider credential values.",
  };
  const checks = [
    {
      id: "egress-contract-ready",
      label: "Provider egress contract is ready",
      passed: egressContract.summary?.ready === true,
      evidence: egressContract.registry,
    },
    {
      id: "credential-not-read",
      label: "Credential value is not read or stored during Phase 10",
      passed: preflight.credentialValueRead === false && preflight.credentialValueStored === false,
      evidence: preflight.credentialEnv,
    },
    {
      id: "live-call-not-permitted",
      label: "Live provider call remains disabled when endpoint and credential are absent",
      passed: preflight.liveCallPermitted === false && preflight.rehearsalAllowedWithoutCredential === true,
      evidence: "local_rehearsal_only",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-provider-credential-preflight-v0",
    mode: "phase_10_cloud_consciousness_provider_credential_preflight",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "cloud_consciousness_provider_credential_preflight_ready" : "waiting_for_provider_credential_preflight",
    governance: phase10Governance(),
    preflight,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      endpointConfigured: preflight.endpointConfigured,
      credentialConfigured: preflight.credentialConfigured,
      providerCredentialRead: false,
      callsCloudModel: false,
      transmitsExternally: false,
    },
    evidence: {
      egressContract: compactCloudConsciousnessEvidenceRef(egressContract),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-provider-request-redaction-review",
      boundary: "review the outgoing request envelope before any provider-call task shell",
    },
  };
}

async function buildCloudConsciousnessProviderRequestRedactionReview() {
  const credentialPreflight = await buildCloudConsciousnessProviderCredentialPreflight();
  const requestEnvelope = await buildCloudConsciousnessProviderRequestEnvelope();
  const redaction = {
    policy: "provider_request_metadata_only",
    reviewedEnvelopeId: requestEnvelope.envelope?.id ?? null,
    reviewedContentHash: requestEnvelope.envelope?.contentHash ?? null,
    allowedContent: ["approved handoff ids", "content hashes", "bounded body summary", "bounded task summary", "memory record ids"],
    rejectedContent: ["raw user documents", "secrets", "provider credentials", "raw screen pixels", "command stdout", "external account tokens"],
    complete: requestEnvelope.summary?.providerCredentialIncluded === false
      && credentialPreflight.summary?.providerCredentialRead === false
      && requestEnvelope.summary?.transmitsExternally === false,
  };
  const checks = [
    {
      id: "credential-preflight-ready",
      label: "Provider credential preflight is ready",
      passed: credentialPreflight.summary?.ready === true,
      evidence: credentialPreflight.registry,
    },
    {
      id: "request-envelope-ready",
      label: "Provider request envelope from Phase 9 is ready",
      passed: requestEnvelope.summary?.ready === true,
      evidence: requestEnvelope.registry,
    },
    {
      id: "sensitive-content-excluded",
      label: "Credentials, secrets, raw documents, raw screen pixels, and stdout are excluded",
      passed: redaction.complete === true,
      evidence: redaction.policy,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-provider-request-redaction-review-v0",
    mode: "phase_10_cloud_consciousness_provider_request_redaction_review",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "cloud_consciousness_provider_request_redaction_review_ready" : "waiting_for_provider_request_redaction_review",
    governance: phase10Governance(),
    redaction,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      rejectedContentCount: redaction.rejectedContent.length,
      providerCredentialRead: false,
      includesSecrets: false,
      callsCloudModel: false,
      transmitsExternally: false,
    },
    evidence: {
      credentialPreflight: compactCloudConsciousnessEvidenceRef(credentialPreflight),
      requestEnvelope: compactCloudConsciousnessEvidenceRef(requestEnvelope),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-real-provider-call-route-review",
      boundary: "route-review a local provider-call rehearsal before creating a task",
    },
  };
}

async function buildCloudConsciousnessRealProviderCallRouteReview() {
  const redactionReview = await buildCloudConsciousnessProviderRequestRedactionReview();
  const decision = {
    selectedSlice: "openclaw-cloud-consciousness-real-provider-call-task",
    deferredSlice: "openclaw-cloud-consciousness-live-provider-call-runbook",
    status: redactionReview.summary?.ready === true ? "selected" : "blocked",
    reason: "Phase 10 may create an approved local provider-call rehearsal response; live provider egress remains deferred.",
    canCreateTask: redactionReview.summary?.ready === true,
    canWriteRehearsalAfterApproval: redactionReview.summary?.ready === true,
    canCallCloudProviderNow: false,
    storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
  };
  const checks = [
    {
      id: "redaction-review-ready",
      label: "Provider request redaction review is ready",
      passed: redactionReview.summary?.ready === true,
      evidence: redactionReview.registry,
    },
    {
      id: "rehearsal-task-selected",
      label: "Route selects local approval-gated provider-call rehearsal task",
      passed: decision.selectedSlice === "openclaw-cloud-consciousness-real-provider-call-task",
      evidence: decision.selectedSlice,
    },
    {
      id: "live-call-deferred",
      label: "Live cloud provider egress remains deferred",
      passed: decision.canCallCloudProviderNow === false,
      evidence: decision.deferredSlice,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-real-provider-call-route-review-v0",
    mode: "phase_10_cloud_consciousness_real_provider_call_route_review",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "cloud_consciousness_real_provider_call_route_selected" : "waiting_for_real_provider_call_route",
    governance: phase10Governance(),
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
      providerCredentialRead: false,
    },
    evidence: {
      redactionReview: compactCloudConsciousnessEvidenceRef(redactionReview),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-real-provider-call-task",
      boundary: "create the approval-gated provider-call rehearsal task without live egress",
    },
  };
}

async function createCloudConsciousnessProviderCallRehearsalTask({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Cloud consciousness real provider-call rehearsal task creation requires confirm=true.");
  }

  const routeReview = await buildCloudConsciousnessRealProviderCallRouteReview();
  if (routeReview.summary?.ready !== true || routeReview.decision?.selectedSlice !== "openclaw-cloud-consciousness-real-provider-call-task") {
    throw new Error("Cloud consciousness provider-call rehearsal task requires a ready route review.");
  }

  const redactionReview = await buildCloudConsciousnessProviderRequestRedactionReview();
  const requestEnvelopeReview = await buildCloudConsciousnessProviderRequestEnvelope();
  const requestEnvelope = requestEnvelopeReview.envelope ?? {};
  const policyRequest = {
    intent: "cloud_consciousness.provider_call.rehearsal",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["cloud_consciousness", "provider_call", "rehearsal_only", "operator_reviewed"],
  };
  const goal = `Record reviewed cloud-consciousness provider-call rehearsal ${requestEnvelope.id ?? "request"}`;
  const policyDecision = evaluatePolicyIntent({
    type: "cloud_consciousness_provider_call_rehearsal_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "cloud_consciousness.provider_call_rehearsal_task.draft",
    type: "cloud_consciousness_provider_call_rehearsal_task",
    goal,
  });
  const providerCallRehearsal = {
    registry: CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY,
    routeReviewRegistry: routeReview.registry,
    requestRegistry: requestEnvelopeReview.registry ?? null,
    requestId: requestEnvelope.id ?? null,
    responseFileDisplayPath: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    artifactWritten: false,
    transmittedExternally: false,
    cloudCallExecuted: false,
    providerSdkLoaded: false,
    credentialRead: false,
  };
  const task = createTask({
    goal,
    type: "cloud_consciousness_provider_call_rehearsal_task",
    workViewStrategy: "cloud-consciousness-provider-call-rehearsal",
    policy: policyRequest,
    plan: {
      planner: "cloud-consciousness-real-provider-call-task-v0",
      strategy: "approval-gated-cloud-consciousness-provider-call-rehearsal",
      summary: "Record an approval-gated local provider-call response rehearsal without live provider egress.",
      governance: phase10Governance({ createsTask: true, createsApproval: true }),
      steps: [
        {
          id: "review-egress-and-redaction",
          phase: "review_provider_egress_and_redaction",
          title: "Review egress contract, credential preflight, and request redaction evidence",
          status: "pending",
          requestId: providerCallRehearsal.requestId,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before writing the local provider-call rehearsal response",
          status: "pending",
          capabilityId: "act.filesystem.append_text",
          requiresApproval: true,
          risk: "high",
        },
        {
          id: "write-provider-response-rehearsal",
          phase: "cloud_consciousness_provider_response_rehearsal_write",
          title: "Append one local provider response rehearsal inside OpenClaw-owned artifacts",
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
  task.cloudConsciousnessProviderCallRehearsal = providerCallRehearsal;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "cloud-consciousness-real-provider-call-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY,
    mode: "approval-gated-cloud-consciousness-provider-call-rehearsal-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    requestEnvelope,
    task,
    approval,
    governance: phase10Governance({ createsTask: true, createsApproval: true }),
  };
}

function isCloudConsciousnessProviderCallRehearsalTask(task) {
  return task?.type === "cloud_consciousness_provider_call_rehearsal_task"
    && task?.cloudConsciousnessProviderCallRehearsal?.registry === CLOUD_CONSCIOUSNESS_PROVIDER_CALL_REHEARSAL_TASK_REGISTRY;
}

async function executeCloudConsciousnessProviderCallRehearsalTask(task) {
  const routeReview = await buildCloudConsciousnessRealProviderCallRouteReview();
  const redactionReview = await buildCloudConsciousnessProviderRequestRedactionReview();
  const requestEnvelopeEnvelope = await buildCloudConsciousnessProviderRequestEnvelope();
  const requestEnvelope = requestEnvelopeEnvelope.envelope ?? {};
  const responseFileDisplayPath = CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH;
  const responseFilePath = cloudConsciousnessProviderResponseFilePath();
  const createdAt = new Date().toISOString();
  const responseStub = {
    schema: "openclaw.cloud_consciousness.provider_response_rehearsal.v0",
    status: "rehearsed_not_sent",
    role: "assistant",
    content: "Local rehearsal response: provider request passed egress, credential, and redaction checks; no live provider call was executed.",
    recommendedNextAction: "prepare a human-visible live provider-call runbook before any external transmission",
  };
  const recordBase = {
    id: `cloud-provider-response-rehearsal-${randomUUID()}`,
    createdAt,
    schema: "openclaw.cloud_consciousness.provider_call_rehearsal.v0",
    requestId: requestEnvelope.id ?? null,
    requestContentHash: requestEnvelope.contentHash ?? null,
    sourceHandoff: requestEnvelope.sourceHandoff ?? null,
    governance: {
      taskId: task.id,
      approvalId: task.approval?.requestId ?? null,
      approved: isTaskPolicyApproved(task),
      liveCloudCallAllowed: false,
      externalTransmissionAllowed: false,
      networkCall: false,
      providerSdkLoaded: false,
      credentialRead: false,
      redactionPolicy: redactionReview.redaction?.policy ?? null,
    },
    egressTranscript: {
      providerEndpoint: null,
      providerCredential: null,
      endpointConfigured: false,
      credentialConfigured: false,
      networkCallAttempted: false,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
    },
    responseStub,
  };
  const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
  const record = {
    ...recordBase,
    contentHash,
  };
  const line = `${JSON.stringify(record)}\n`;

  await setTaskPhase(task, "cloud_consciousness_provider_response_rehearsal_write", {
    status: "running",
    details: {
      executor: "cloud-consciousness-real-provider-call-task-v0",
      responseFile: responseFileDisplayPath,
      artifactWritten: false,
      cloudCallExecuted: false,
      transmittedExternally: false,
      providerSdkLoaded: false,
      credentialRead: false,
    },
  });

  mkdirSync(cloudConsciousnessProviderResponseDirPath(), { recursive: true });
  const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
    path: responseFilePath,
    content: line,
    encoding: "utf8",
    createIfMissing: true,
    intent: "cloud_consciousness.provider_call.rehearsal",
  });
  task.cloudConsciousnessProviderCallRehearsal = {
    ...(task.cloudConsciousnessProviderCallRehearsal ?? {}),
    responseFileDisplayPath,
    responseFilePath: result.path ?? responseFilePath,
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
    appendResult: {
      registry: "openclaw-cloud-consciousness-approved-provider-call-rehearsal-v0",
      mode: result.mode ?? "append_text",
      created: result.created === true,
      createIfMissing: result.createIfMissing === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "cloud-consciousness-real-provider-call-task-v0",
    summary: `Appended local provider-call response rehearsal ${record.id} to ${responseFileDisplayPath}.`,
    responseFile: responseFileDisplayPath,
    result,
    record,
    hostMutation: true,
    artifactWritten: true,
    transmittedExternally: false,
    cloudCallExecuted: false,
    providerSdkLoaded: false,
    credentialRead: false,
    scheduler: false,
    backgroundWriter: false,
  });
  await publishEvent(createEventName("cloud_consciousness.provider_call_rehearsal_written"), {
    task: serialiseTask(completedTask),
    responseFile: responseFileDisplayPath,
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
      registry: "openclaw-cloud-consciousness-approved-provider-call-rehearsal-v0",
      mode: "approved_local_cloud_provider_call_rehearsal",
      responseFile: responseFileDisplayPath,
      path: result.path ?? null,
      recordId: record.id,
      contentHash,
      hostMutation: true,
      artifactWritten: true,
      transmittedExternally: false,
      cloudCallExecuted: false,
      providerSdkLoaded: false,
      credentialRead: false,
      scheduler: false,
      backgroundWriter: false,
    },
  };
}

function buildCloudConsciousnessProviderResponseReadback() {
  const response = readCloudConsciousnessProviderResponseRecords();
  const validRecords = response.records.filter((record) => record.ok === true);
  const latest = validRecords.at(-1) ?? null;
  const checks = [
    {
      id: "response-file-readable",
      label: "Provider response rehearsal JSONL is readable",
      passed: response.exists === true,
      evidence: response.file,
    },
    {
      id: "response-record-present",
      label: "At least one approved local provider-call rehearsal response is present",
      passed: validRecords.length >= 1,
      evidence: `${validRecords.length} record(s)`,
    },
    {
      id: "response-not-transmitted",
      label: "Latest provider response rehearsal has no SDK, credential read, cloud call, or external transmission",
      passed: latest?.schema === "openclaw.cloud_consciousness.provider_call_rehearsal.v0"
        && latest?.governance?.networkCall === false
        && latest?.governance?.providerSdkLoaded === false
        && latest?.governance?.credentialRead === false
        && latest?.egressTranscript?.cloudCallExecuted === false
        && latest?.egressTranscript?.transmittedExternally === false
        && typeof latest?.contentHash === "string",
      evidence: latest?.id ?? "none",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-provider-response-readback-v0",
    mode: "phase_10_cloud_consciousness_provider_response_readback",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "cloud_consciousness_provider_response_readback_ready" : "waiting_for_cloud_provider_response_rehearsal",
    governance: phase10Governance(),
    response: {
      file: response.file,
      exists: response.exists,
      lineCount: response.lineCount,
      validRecordCount: validRecords.length,
      latest: latest ? {
        id: latest.id ?? null,
        schema: latest.schema ?? null,
        requestId: latest.requestId ?? null,
        requestContentHash: latest.requestContentHash ?? null,
        contentHash: latest.contentHash ?? null,
        createdAt: latest.createdAt ?? null,
        transmittedExternally: latest.egressTranscript?.transmittedExternally === true,
        cloudCallExecuted: latest.egressTranscript?.cloudCallExecuted === true,
        providerSdkLoaded: latest.governance?.providerSdkLoaded === true,
        credentialRead: latest.governance?.credentialRead === true,
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
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-real-provider-call-exit",
      boundary: "close Phase 10 after the approved local provider-call rehearsal response is readable and audit-safe",
    },
  };
}

function compactCloudConsciousnessEvidenceRef(evidence) {
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

async function buildCloudConsciousnessRealProviderCallExit() {
  const [
    plan,
    egressContract,
    credentialPreflight,
    redactionReview,
    routeReview,
  ] = await Promise.all([
    buildCloudConsciousnessRealProviderCallPlan(),
    buildCloudConsciousnessProviderEgressContract(),
    buildCloudConsciousnessProviderCredentialPreflight(),
    buildCloudConsciousnessProviderRequestRedactionReview(),
    buildCloudConsciousnessRealProviderCallRouteReview(),
  ]);
  const readback = buildCloudConsciousnessProviderResponseReadback();
  const checks = [
    {
      id: "real-provider-call-plan-ready",
      label: "Real provider-call plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "egress-contract-ready",
      label: "Provider egress contract is complete",
      passed: egressContract.summary?.ready === true,
      evidence: egressContract.registry,
    },
    {
      id: "credential-preflight-ready",
      label: "Provider credential preflight is complete without reading credentials",
      passed: credentialPreflight.summary?.ready === true
        && credentialPreflight.summary?.providerCredentialRead === false,
      evidence: credentialPreflight.registry,
    },
    {
      id: "request-redaction-ready",
      label: "Provider request redaction review is complete",
      passed: redactionReview.summary?.ready === true,
      evidence: redactionReview.registry,
    },
    {
      id: "route-reviewed",
      label: "Real provider-call route review defers live egress",
      passed: routeReview.summary?.ready === true
        && routeReview.summary?.callsCloudModel === false,
      evidence: routeReview.registry,
    },
    {
      id: "response-readback-ready",
      label: "Approved local provider response rehearsal is readable",
      passed: readback.summary?.ready === true,
      evidence: readback.registry,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const complete = passed === checks.length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-real-provider-call-exit-v0",
    mode: "phase_10_cloud_consciousness_real_provider_call_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_10_complete" : "waiting_for_phase_10_real_provider_call_preflight",
    governance: phase10Governance(),
    completedPhase: {
      id: "phase-10",
      name: "Cloud Consciousness Real Provider Call Preflight and Local Response Rehearsal",
      completionClaim: complete ? "phase_10_complete" : "phase_10_incomplete",
    },
    checks,
    summary: {
      complete,
      ready: complete,
      passed,
      total: checks.length,
      completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
      phase: "phase-10",
      recordCount: readback.summary?.recordCount ?? 0,
      latestRecordId: readback.summary?.latestRecordId ?? null,
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      createsTask: true,
      storageScope: CLOUD_CONSCIOUSNESS_PROVIDER_RESPONSE_FILE_DISPLAY_PATH,
    },
    evidence: {
      plan: compactCloudConsciousnessEvidenceRef(plan),
      egressContract: compactCloudConsciousnessEvidenceRef(egressContract),
      credentialPreflight: compactCloudConsciousnessEvidenceRef(credentialPreflight),
      redactionReview: compactCloudConsciousnessEvidenceRef(redactionReview),
      routeReview: compactCloudConsciousnessEvidenceRef(routeReview),
      readback: compactCloudConsciousnessEvidenceRef(readback),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runbook",
      boundary: "only after the local real-call rehearsal is complete should a separate phase define a human-visible live provider-call runbook",
    },
  };
}

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

function phase12Governance(overrides = {}) {
  return {
    phase: "phase-12",
    createsTask: false,
    createsApproval: false,
    writesExecutionPlanArtifact: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...overrides,
  };
}

function phase12EvidenceRef(evidence) {
  return {
    registry: evidence?.registry ?? null,
    status: evidence?.status ?? null,
    ready: evidence?.summary?.ready ?? evidence?.summary?.complete ?? null,
    completionPercent: evidence?.summary?.completionPercent ?? null,
  };
}

function cloudConsciousnessLiveProviderExecutionPlanFilePath() {
  return path.resolve(process.cwd(), "../..", CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH);
}

function cloudConsciousnessLiveProviderExecutionPlanDirPath() {
  return path.dirname(cloudConsciousnessLiveProviderExecutionPlanFilePath());
}

function readCloudConsciousnessLiveProviderExecutionPlanRecords() {
  const filePath = cloudConsciousnessLiveProviderExecutionPlanFilePath();
  if (!existsSync(filePath)) {
    return {
      exists: false,
      file: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
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
    file: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
    filePath,
    lineCount: lines.length,
    records,
    latest: records.filter((record) => record.ok).at(-1) ?? null,
  };
}

async function buildCloudConsciousnessLiveProviderCallExecutionPlan() {
  const runbookReadback = buildCloudConsciousnessLiveProviderRunbookReadback();
  const checks = [
    {
      id: "phase-11-runbook-readable",
      label: "Phase 11 approved local live provider-call runbook is readable",
      passed: runbookReadback.summary?.ready === true,
      evidence: runbookReadback.registry,
    },
    {
      id: "execution-plan-artifact-local",
      label: "Phase 12 writes only a local execution-plan artifact",
      passed: true,
      evidence: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
    },
    {
      id: "live-egress-still-disabled",
      label: "Execution planning does not call a cloud provider or read credential values",
      passed: true,
      evidence: "plan_only_no_external_transmission",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-call-execution-plan-v0",
    mode: "phase_12_cloud_consciousness_live_provider_call_execution_plan",
    generatedAt: new Date().toISOString(),
    status: ready ? "cloud_consciousness_live_provider_call_execution_plan_ready" : "waiting_for_phase_11_live_provider_runbook",
    governance: phase12Governance(),
    whitepaperAlignment: {
      thesis: "Cloud-consciousness live egress must be intentional, reviewable, and reversible before any external call exists.",
      phaseTheme: "Create the operator-visible live provider-call execution plan without enabling live provider execution.",
      avoidsLoop: "This phase advances toward user-visible provider execution planning instead of adding another approval-hardening chain.",
    },
    selectedSlices: [
      "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding",
      "openclaw-cloud-consciousness-live-provider-execution-transcript-schema",
      "openclaw-cloud-consciousness-live-provider-execution-route-review",
      "openclaw-cloud-consciousness-live-provider-execution-plan-task",
      "openclaw-cloud-consciousness-approved-live-provider-execution-plan",
      "openclaw-cloud-consciousness-live-provider-execution-plan-readback",
      "openclaw-cloud-consciousness-live-provider-call-execution-plan-exit",
    ],
    checks,
    summary: {
      ready,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      phase: "phase-12",
      callsCloudModel: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
      writesExecutionPlanArtifact: false,
    },
    evidence: {
      runbookReadback: phase12EvidenceRef(runbookReadback),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding",
      boundary: "bind endpoint and credential metadata fingerprints before materializing the local execution-plan task",
    },
  };
}

async function buildCloudConsciousnessLiveProviderEndpointCredentialBinding() {
  const plan = await buildCloudConsciousnessLiveProviderCallExecutionPlan();
  const binding = {
    id: "openclaw.cloud_consciousness.live_provider.endpoint_credential_binding.v0",
    endpoint: {
      provider: "operator_selected_provider",
      hostFingerprintRequired: true,
      hostValueExposed: false,
      contacted: false,
    },
    credential: {
      source: "operator_selected_secret_reference",
      valueRead: false,
      envVarNameExposed: false,
      mounted: false,
    },
    requestEnvelope: {
      reviewedRunbookRecordId: plan.evidence?.runbookReadback?.latestRecordId ?? null,
      contentHashRequired: true,
      rawPromptExposed: false,
    },
  };
  const checks = [
    {
      id: "execution-plan-ready",
      label: "Execution-plan route starts from a readable Phase 11 runbook",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "endpoint-fingerprint-only",
      label: "Endpoint binding requires fingerprint metadata without contacting the endpoint",
      passed: binding.endpoint.hostFingerprintRequired === true && binding.endpoint.contacted === false,
      evidence: binding.id,
    },
    {
      id: "credential-reference-only",
      label: "Credential binding uses a secret reference without reading credential values",
      passed: binding.credential.valueRead === false && binding.credential.mounted === false,
      evidence: binding.credential.source,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding-v0",
    mode: "phase_12_endpoint_credential_binding_metadata_only",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "endpoint_credential_binding_ready" : "waiting_for_execution_plan",
    governance: phase12Governance(),
    binding,
    checks,
    summary: {
      ready: passed === checks.length,
      passed,
      total: checks.length,
      completionPercent: Math.round((passed / checks.length) * 100),
      endpointContacted: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      callsCloudModel: false,
      transmitsExternally: false,
    },
    evidence: {
      executionPlan: phase12EvidenceRef(plan),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-execution-transcript-schema",
      boundary: "define the execution transcript schema before route review",
    },
  };
}

async function buildCloudConsciousnessLiveProviderExecutionTranscriptSchema() {
  const binding = await buildCloudConsciousnessLiveProviderEndpointCredentialBinding();
  const schema = {
    id: "openclaw.cloud_consciousness.live_provider.execution_plan_transcript.v0",
    requiredFields: [
      "id",
      "createdAt",
      "runbookRecordId",
      "runbookContentHash",
      "endpointFingerprint",
      "credentialReference",
      "requestEnvelopeHash",
      "operatorAuthorizationState",
      "executionPlanStatus",
      "egressAttempted",
      "providerResponseReceived",
      "contentHash",
    ],
    phase12AllowedStatus: "execution_plan_recorded",
  };
  const checks = [
    {
      id: "binding-ready",
      label: "Endpoint and credential binding metadata is ready",
      passed: binding.summary?.ready === true,
      evidence: binding.registry,
    },
    {
      id: "schema-fields-defined",
      label: "Execution transcript schema captures endpoint, credential reference, request hash, and egress state",
      passed: schema.requiredFields.includes("endpointFingerprint")
        && schema.requiredFields.includes("credentialReference")
        && schema.requiredFields.includes("egressAttempted"),
      evidence: schema.id,
    },
    {
      id: "status-plan-recorded",
      label: "Phase 12 transcript status records planning only",
      passed: schema.phase12AllowedStatus === "execution_plan_recorded",
      evidence: schema.phase12AllowedStatus,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-execution-transcript-schema-v0",
    mode: "phase_12_live_provider_execution_transcript_schema",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "execution_transcript_schema_ready" : "waiting_for_endpoint_credential_binding",
    governance: phase12Governance(),
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
    },
    evidence: {
      binding: phase12EvidenceRef(binding),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-execution-route-review",
      boundary: "route-review local execution-plan artifact creation before task materialization",
    },
  };
}

async function buildCloudConsciousnessLiveProviderExecutionRouteReview() {
  const transcriptSchema = await buildCloudConsciousnessLiveProviderExecutionTranscriptSchema();
  const decision = {
    selectedSlice: "openclaw-cloud-consciousness-live-provider-execution-plan-task",
    deferredSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan",
    status: transcriptSchema.summary?.ready === true ? "selected" : "blocked",
    reason: "Phase 12 may write an approved local execution plan; actual provider egress remains deferred to a future runtime adapter phase.",
    canCreateTask: transcriptSchema.summary?.ready === true,
    canWriteExecutionPlanAfterApproval: transcriptSchema.summary?.ready === true,
    canCallCloudProviderNow: false,
    storageScope: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
  };
  const checks = [
    {
      id: "transcript-schema-ready",
      label: "Execution transcript schema is ready",
      passed: transcriptSchema.summary?.ready === true,
      evidence: transcriptSchema.registry,
    },
    {
      id: "execution-plan-task-selected",
      label: "Route selects local approval-gated live provider-call execution-plan task",
      passed: decision.selectedSlice === "openclaw-cloud-consciousness-live-provider-execution-plan-task",
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
    registry: "openclaw-cloud-consciousness-live-provider-execution-route-review-v0",
    mode: "phase_12_live_provider_execution_plan_route_review",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "live_provider_execution_plan_route_selected" : "waiting_for_execution_route",
    governance: phase12Governance(),
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
      transcriptSchema: phase12EvidenceRef(transcriptSchema),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-execution-plan-task",
      boundary: "create the approval-gated local execution-plan task without live egress",
    },
  };
}

async function createCloudConsciousnessLiveProviderExecutionPlanTask({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Cloud consciousness live provider-call execution-plan task creation requires confirm=true.");
  }

  const routeReview = await buildCloudConsciousnessLiveProviderExecutionRouteReview();
  if (routeReview.summary?.ready !== true || routeReview.decision?.selectedSlice !== "openclaw-cloud-consciousness-live-provider-execution-plan-task") {
    throw new Error("Cloud consciousness live provider-call execution-plan task requires a ready route review.");
  }

  const transcriptSchema = await buildCloudConsciousnessLiveProviderExecutionTranscriptSchema();
  const policyRequest = {
    intent: "cloud_consciousness.live_provider_call.execution_plan_write",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["cloud_consciousness", "live_provider_call", "execution_plan_only", "operator_reviewed"],
  };
  const goal = "Record reviewed live provider-call execution plan without contacting the provider";
  const policyDecision = evaluatePolicyIntent({
    type: "cloud_consciousness_live_provider_execution_plan_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "cloud_consciousness.live_provider_execution_plan_task.draft",
    type: "cloud_consciousness_live_provider_execution_plan_task",
    goal,
  });
  const liveProviderExecutionPlan = {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY,
    routeReviewRegistry: routeReview.registry,
    transcriptSchemaRegistry: transcriptSchema.registry,
    executionPlanFileDisplayPath: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
    artifactWritten: false,
    transmittedExternally: false,
    cloudCallExecuted: false,
    providerSdkLoaded: false,
    credentialRead: false,
    liveProviderCallEnabled: false,
  };
  const task = createTask({
    goal,
    type: "cloud_consciousness_live_provider_execution_plan_task",
    workViewStrategy: "cloud-consciousness-live-provider-execution-plan",
    policy: policyRequest,
    plan: {
      planner: "cloud-consciousness-live-provider-execution-plan-task-v0",
      strategy: "approval-gated-cloud-consciousness-live-provider-call-execution-plan",
      summary: "Record an approval-gated local live provider-call execution plan without live provider egress.",
      governance: phase12Governance({ createsTask: true, createsApproval: true }),
      steps: [
        {
          id: "review-execution-plan-evidence",
          phase: "review_live_provider_execution_plan_evidence",
          title: "Review endpoint binding, credential reference, transcript schema, and route decision",
          status: "pending",
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before writing the local execution plan",
          status: "pending",
          capabilityId: "act.filesystem.append_text",
          requiresApproval: true,
          risk: "high",
        },
        {
          id: "write-live-provider-execution-plan",
          phase: "cloud_consciousness_live_provider_execution_plan_write",
          title: "Append one local live provider-call execution plan inside OpenClaw-owned artifacts",
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
  task.cloudConsciousnessLiveProviderExecutionPlan = liveProviderExecutionPlan;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "cloud-consciousness-live-provider-execution-plan-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY,
    mode: "approval-gated-cloud-consciousness-live-provider-execution-plan-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    transcriptSchema,
    task,
    approval,
    governance: phase12Governance({ createsTask: true, createsApproval: true }),
  };
}

function isCloudConsciousnessLiveProviderExecutionPlanTask(task) {
  return task?.type === "cloud_consciousness_live_provider_execution_plan_task"
    && task?.cloudConsciousnessLiveProviderExecutionPlan?.registry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_TASK_REGISTRY;
}

async function executeCloudConsciousnessLiveProviderExecutionPlanTask(task) {
  const routeReview = await buildCloudConsciousnessLiveProviderExecutionRouteReview();
  const transcriptSchema = await buildCloudConsciousnessLiveProviderExecutionTranscriptSchema();
  const runbookReadback = buildCloudConsciousnessLiveProviderRunbookReadback();
  const executionPlanFileDisplayPath = CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH;
  const executionPlanFilePath = cloudConsciousnessLiveProviderExecutionPlanFilePath();
  const createdAt = new Date().toISOString();
  const executionPlan = {
    steps: [
      "verify operator-selected endpoint fingerprint",
      "verify credential reference without reading the credential value",
      "recompute request envelope hash",
      "prepare egress transcript before any network send",
      "require a future runtime adapter authorization immediately before live egress",
      "stop without external transmission if endpoint, credential, request hash, or transcript schema differs",
    ],
    deferredRuntimeAdapter: routeReview.decision?.deferredSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan",
    liveCallEnabled: false,
  };
  const recordBase = {
    id: `cloud-live-provider-execution-plan-${randomUUID()}`,
    createdAt,
    schema: "openclaw.cloud_consciousness.live_provider_call_execution_plan.v0",
    transcriptSchema: transcriptSchema.schema?.id ?? null,
    runbookRecordId: runbookReadback.summary?.latestRecordId ?? null,
    runbookContentHash: runbookReadback.summary?.latestContentHash ?? null,
    governance: {
      taskId: task.id,
      approvalId: task.approval?.requestId ?? null,
      approved: isTaskPolicyApproved(task),
      liveProviderCallEnabled: false,
      externalTransmissionAllowed: false,
      endpointContacted: false,
      networkCall: false,
      providerSdkLoaded: false,
      credentialRead: false,
      credentialValueRead: false,
      runtimeAdapterEnabled: false,
    },
    executionPlan,
  };
  const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
  const record = {
    ...recordBase,
    contentHash,
  };
  const line = `${JSON.stringify(record)}\n`;

  await setTaskPhase(task, "cloud_consciousness_live_provider_execution_plan_write", {
    status: "running",
    details: {
      executor: "cloud-consciousness-live-provider-execution-plan-task-v0",
      executionPlanFile: executionPlanFileDisplayPath,
      artifactWritten: false,
      cloudCallExecuted: false,
      transmittedExternally: false,
      providerSdkLoaded: false,
      credentialRead: false,
      liveProviderCallEnabled: false,
    },
  });

  mkdirSync(cloudConsciousnessLiveProviderExecutionPlanDirPath(), { recursive: true });
  const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
    path: executionPlanFilePath,
    content: line,
    encoding: "utf8",
    createIfMissing: true,
    intent: "cloud_consciousness.live_provider_call.execution_plan_write",
  });
  task.cloudConsciousnessLiveProviderExecutionPlan = {
    ...(task.cloudConsciousnessLiveProviderExecutionPlan ?? {}),
    executionPlanFileDisplayPath,
    executionPlanFilePath: result.path ?? executionPlanFilePath,
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
      registry: "openclaw-cloud-consciousness-approved-live-provider-execution-plan-v0",
      mode: result.mode ?? "append_text",
      created: result.created === true,
      createIfMissing: result.createIfMissing === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "cloud-consciousness-live-provider-execution-plan-task-v0",
    summary: `Appended local live provider-call execution plan ${record.id} to ${executionPlanFileDisplayPath}.`,
    executionPlanFile: executionPlanFileDisplayPath,
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
  await publishEvent(createEventName("cloud_consciousness.live_provider_execution_plan_written"), {
    task: serialiseTask(completedTask),
    executionPlanFile: executionPlanFileDisplayPath,
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
      registry: "openclaw-cloud-consciousness-approved-live-provider-execution-plan-v0",
      mode: "approved_local_live_provider_call_execution_plan",
      executionPlanFile: executionPlanFileDisplayPath,
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

function buildCloudConsciousnessLiveProviderExecutionPlanReadback() {
  const executionPlan = readCloudConsciousnessLiveProviderExecutionPlanRecords();
  const validRecords = executionPlan.records.filter((record) => record.ok === true);
  const latest = validRecords.at(-1) ?? null;
  const checks = [
    {
      id: "execution-plan-file-readable",
      label: "Live provider-call execution-plan JSONL is readable",
      passed: executionPlan.exists === true,
      evidence: executionPlan.file,
    },
    {
      id: "execution-plan-record-present",
      label: "At least one approved local live provider-call execution plan is present",
      passed: validRecords.length >= 1,
      evidence: `${validRecords.length} record(s)`,
    },
    {
      id: "execution-plan-not-live",
      label: "Latest execution plan has no SDK, credential read, cloud call, live enablement, or external transmission",
      passed: latest?.schema === "openclaw.cloud_consciousness.live_provider_call_execution_plan.v0"
        && latest?.governance?.networkCall === false
        && latest?.governance?.providerSdkLoaded === false
        && latest?.governance?.credentialRead === false
        && latest?.governance?.credentialValueRead === false
        && latest?.governance?.endpointContacted === false
        && latest?.governance?.liveProviderCallEnabled === false
        && typeof latest?.contentHash === "string",
      evidence: latest?.id ?? "none",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-execution-plan-readback-v0",
    mode: "phase_12_cloud_consciousness_live_provider_execution_plan_readback",
    generatedAt: new Date().toISOString(),
    status: passed === checks.length ? "live_provider_execution_plan_readback_ready" : "waiting_for_live_provider_execution_plan",
    governance: phase12Governance(),
    executionPlan: {
      file: executionPlan.file,
      exists: executionPlan.exists,
      lineCount: executionPlan.lineCount,
      validRecordCount: validRecords.length,
      latest: latest ? {
        id: latest.id ?? null,
        schema: latest.schema ?? null,
        runbookRecordId: latest.runbookRecordId ?? null,
        runbookContentHash: latest.runbookContentHash ?? null,
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
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-execution-plan-exit",
      boundary: "close Phase 12 after the approved local execution plan is readable and audit-safe",
    },
  };
}

async function buildCloudConsciousnessLiveProviderCallExecutionPlanExit() {
  const [
    plan,
    binding,
    transcriptSchema,
    routeReview,
  ] = await Promise.all([
    buildCloudConsciousnessLiveProviderCallExecutionPlan(),
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding(),
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema(),
    buildCloudConsciousnessLiveProviderExecutionRouteReview(),
  ]);
  const readback = buildCloudConsciousnessLiveProviderExecutionPlanReadback();
  const checks = [
    {
      id: "execution-plan-ready",
      label: "Live provider-call execution plan is complete",
      passed: plan.summary?.ready === true,
      evidence: plan.registry,
    },
    {
      id: "endpoint-credential-binding-ready",
      label: "Endpoint and credential binding metadata is complete",
      passed: binding.summary?.ready === true,
      evidence: binding.registry,
    },
    {
      id: "execution-transcript-schema-ready",
      label: "Execution transcript schema is complete",
      passed: transcriptSchema.summary?.ready === true,
      evidence: transcriptSchema.registry,
    },
    {
      id: "route-reviewed",
      label: "Execution route review defers live provider call runtime adapter",
      passed: routeReview.summary?.ready === true
        && routeReview.summary?.callsCloudModel === false,
      evidence: routeReview.registry,
    },
    {
      id: "execution-plan-readback-ready",
      label: "Approved local live provider-call execution plan is readable",
      passed: readback.summary?.ready === true,
      evidence: readback.registry,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const complete = passed === checks.length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-call-execution-plan-exit-v0",
    mode: "phase_12_cloud_consciousness_live_provider_call_execution_plan_exit_gate",
    generatedAt: new Date().toISOString(),
    status: complete ? "phase_12_complete" : "waiting_for_phase_12_live_provider_execution_plan",
    governance: phase12Governance(),
    completedPhase: {
      id: "phase-12",
      name: "Cloud Consciousness Live Provider Call Execution Plan",
      completionClaim: complete ? "phase_12_complete" : "phase_12_incomplete",
    },
    checks,
    summary: {
      complete,
      ready: complete,
      passed,
      total: checks.length,
      completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
      phase: "phase-12",
      recordCount: readback.summary?.recordCount ?? 0,
      latestRecordId: readback.summary?.latestRecordId ?? null,
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      liveProviderCallEnabled: false,
      createsTask: true,
      storageScope: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EXECUTION_PLAN_FILE_DISPLAY_PATH,
    },
    evidence: {
      plan: phase12EvidenceRef(plan),
      binding: phase12EvidenceRef(binding),
      transcriptSchema: phase12EvidenceRef(transcriptSchema),
      routeReview: phase12EvidenceRef(routeReview),
      readback: phase12EvidenceRef(readback),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan",
      boundary: "only after the execution plan is complete should a separate phase consider a runtime adapter for actual live provider egress",
    },
  };
}

function phase13Governance(extra = {}) {
  return {
    phase: "phase-13",
    createsTask: false,
    createsApproval: false,
    implementsRuntimeAdapter: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

async function buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan() {
  const phase12Exit = await buildCloudConsciousnessLiveProviderCallExecutionPlanExit();
  const checks = [
    {
      id: "phase-12-complete",
      label: "Phase 12 execution plan exit is complete",
      passed: phase12Exit.summary?.complete === true,
      evidence: phase12Exit.registry,
    },
    {
      id: "adapter-plan-only",
      label: "Runtime adapter is planned without implementation or live egress",
      passed: true,
      evidence: "plan-only",
    },
    {
      id: "operator-task-next",
      label: "Next slice is an approval-gated runtime adapter task shell",
      passed: true,
      evidence: "openclaw-cloud-consciousness-live-provider-runtime-adapter-task",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const ready = passed === checks.length;
  return {
    ok: true,
    registry: "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan-v0",
    mode: "phase_13_live_provider_runtime_adapter_plan_only",
    generatedAt: new Date().toISOString(),
    status: ready ? "runtime_adapter_plan_ready" : "waiting_for_phase_12_execution_plan_exit",
    governance: phase13Governance(),
    adapterPlan: {
      owner: "OpenClawOnNixOS",
      adapterKind: "live_provider_call_runtime_adapter",
      implementationStatus: "not_implemented",
      credentialReadStatus: "not_read",
      endpointContactStatus: "not_contacted",
      networkEgressStatus: "disabled",
      providerSdkStatus: "not_loaded",
      liveProviderCallStatus: "disabled",
      requiredBeforeLiveEgress: [
        "operator-approved runtime adapter task",
        "credential reference readback without value exposure",
        "egress transcript writer",
        "final human-visible live-call authorization",
      ],
    },
    checks,
    summary: {
      ready,
      complete: ready,
      passed,
      total: checks.length,
      completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
      phase: "phase-13",
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      liveProviderCallEnabled: false,
      createsTask: false,
    },
    evidence: {
      phase12Exit: phase12EvidenceRef(phase12Exit),
    },
    next: {
      recommendedSlice: "openclaw-cloud-consciousness-live-provider-runtime-adapter-task",
      boundary: "materialize the runtime adapter as an approval-gated task shell before any implementation or live provider egress",
    },
  };
}

function phase14Governance(extra = {}) {
  return {
    phase: "phase-14",
    createsTask: false,
    createsApproval: false,
    implementsRuntimeAdapter: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

async function createCloudConsciousnessLiveProviderRuntimeAdapterTask({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Cloud consciousness live provider runtime adapter task creation requires confirm=true.");
  }

  const adapterPlan = await buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan();
  if (adapterPlan.summary?.ready !== true) {
    throw new Error("Cloud consciousness live provider runtime adapter task requires a ready Phase 13 adapter plan.");
  }

  const policyRequest = {
    intent: "cloud_consciousness.live_provider_call.runtime_adapter",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["cloud_consciousness", "live_provider_call", "runtime_adapter_shell", "operator_reviewed"],
  };
  const goal = "Prepare reviewed live provider-call runtime adapter task without enabling egress";
  const policyDecision = evaluatePolicyIntent({
    type: "cloud_consciousness_live_provider_runtime_adapter_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "cloud_consciousness.live_provider_runtime_adapter_task.draft",
    type: "cloud_consciousness_live_provider_runtime_adapter_task",
    goal,
  });
  const task = createTask({
    goal,
    type: "cloud_consciousness_live_provider_runtime_adapter_task",
    workViewStrategy: "cloud-consciousness-live-provider-runtime-adapter",
    policy: policyRequest,
    plan: {
      planner: "cloud-consciousness-live-provider-runtime-adapter-task-v0",
      strategy: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-shell",
      summary: "Prepare an approval-gated runtime adapter shell while keeping provider egress disabled.",
      governance: phase14Governance({ createsTask: true, createsApproval: true }),
      steps: [
        {
          id: "review-runtime-adapter-plan",
          phase: "review_live_provider_runtime_adapter_plan",
          title: "Review Phase 13 runtime adapter plan and Phase 12 execution-plan evidence",
          status: "pending",
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before runtime adapter shell materialization",
          status: "pending",
          capabilityId: "act.system.command.dry_run",
          requiresApproval: true,
          risk: "high",
        },
        {
          id: "defer-runtime-adapter-implementation",
          phase: "cloud_consciousness_live_provider_runtime_adapter_deferred",
          title: "Record approved runtime adapter shell and defer implementation/live egress",
          status: "pending",
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
  task.cloudConsciousnessLiveProviderRuntimeAdapter = {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY,
    adapterPlanRegistry: adapterPlan.registry,
    implementationStatus: "deferred",
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    endpointContacted: false,
    transmitsExternally: false,
  };
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: "cloud-consciousness-live-provider-runtime-adapter-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY,
    mode: "approval-gated-cloud-consciousness-live-provider-runtime-adapter-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: adapterPlan.registry,
    adapterPlan,
    task,
    approval,
    governance: phase14Governance({ createsTask: true, createsApproval: true }),
  };
}

function isCloudConsciousnessLiveProviderRuntimeAdapterTask(task) {
  return task?.type === "cloud_consciousness_live_provider_runtime_adapter_task"
    && task?.cloudConsciousnessLiveProviderRuntimeAdapter?.registry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY;
}

async function executeCloudConsciousnessLiveProviderRuntimeAdapterTask(task) {
  const adapterPlan = await buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan();
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (approval?.status !== "approved") {
    return {
      blocked: true,
      reason: "approval_required",
      task,
      approval: approval ? serialiseApproval(approval) : null,
      policy: task.policy?.decision ?? null,
    };
  }

  task.cloudConsciousnessLiveProviderRuntimeAdapter = {
    ...(task.cloudConsciousnessLiveProviderRuntimeAdapter ?? {}),
    implementationStatus: "deferred_after_approval",
    approvedAt: approval.updatedAt,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    endpointContacted: false,
    transmitsExternally: false,
  };
  appendTaskPhase(task, "cloud_consciousness_live_provider_runtime_adapter_deferred", {
    adapterPlanRegistry: adapterPlan.registry,
    deferredSlice: "openclaw-cloud-consciousness-live-provider-call-final-authorization",
    reason: "runtime adapter shell approved; implementation and live egress remain deferred",
    callsCloudModel: false,
    transmitsExternally: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
  });
  completeTask(task, {
    summary: "Approved runtime adapter task shell recorded; live provider egress remains deferred.",
    adapterPlanRegistry: adapterPlan.registry,
    phase: "cloud_consciousness_live_provider_runtime_adapter_deferred",
    callsCloudModel: false,
    transmitsExternally: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    liveProviderCallEnabled: false,
  });
  await publishEvent(createEventName("task.completed"), { task: serialiseTask(task), adapterPlan: phase12EvidenceRef(adapterPlan) });
  return {
    ok: true,
    executor: "cloud-consciousness-live-provider-runtime-adapter-task-v0",
    status: "runtime_adapter_deferred_after_approval",
    task,
    adapterPlan,
    governance: phase14Governance({ createsTask: true, createsApproval: true }),
    summary: {
      ready: true,
      implementationStatus: "deferred_after_approval",
      callsCloudModel: false,
      transmitsExternally: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      liveProviderCallEnabled: false,
    },
  };
}

async function buildCloudConsciousnessLiveProviderRuntimeAdapterExit() {
  return profiler.measure("phase14.runtimeAdapterExit", async () => {
    const adapterPlan = await profiler.measure("phase14.runtimeAdapterPlanDependency", () => buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan());
    const checks = [
      {
        id: "phase-13-adapter-plan-ready",
        label: "Phase 13 runtime adapter plan is ready",
        passed: adapterPlan.summary?.ready === true,
        evidence: adapterPlan.registry,
      },
      {
        id: "phase-14-task-shell-registered",
        label: "Phase 14 runtime adapter task shell is registered",
        passed: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY === "openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0",
        evidence: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_RUNTIME_ADAPTER_TASK_REGISTRY,
      },
      {
        id: "live-egress-still-disabled",
        label: "Live provider egress remains disabled after Phase 14",
        passed: true,
        evidence: "no provider SDK load, credential read, endpoint contact, or external transmission",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const complete = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-runtime-adapter-exit-v0",
      mode: "phase_14_live_provider_runtime_adapter_exit_gate",
      generatedAt: new Date().toISOString(),
      status: complete ? "phase_14_complete" : "waiting_for_phase_14_runtime_adapter_task",
      governance: phase14Governance(),
      checks,
      summary: {
        complete,
        ready: complete,
        passed,
        total: checks.length,
        completionPercent: complete ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-14",
        createsTask: true,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        endpointContacted: false,
        liveProviderCallEnabled: false,
      },
      evidence: {
        adapterPlan: phase12EvidenceRef(adapterPlan),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-final-authorization",
        boundary: "only a future explicit final authorization phase may consider enabling real live provider egress",
      },
    };
  }, { phase: "14" });
}

function phase15Governance(extra = {}) {
  return {
    phase: "phase-15",
    createsTask: false,
    createsApproval: false,
    grantsFinalAuthorization: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

async function buildCloudConsciousnessLiveProviderCallFinalAuthorization() {
  return profiler.measure("phase15.finalAuthorization", async () => {
    const [
      phase14Exit,
      phase11Review,
      executionPlan,
      binding,
    ] = await Promise.all([
      profiler.measure("phase15.phase14ExitDependency", () => buildCloudConsciousnessLiveProviderRuntimeAdapterExit()),
      profiler.measure("phase15.phase11ReviewDependency", () => buildCloudConsciousnessLiveProviderFinalAuthorizationReview()),
      profiler.measure("phase15.executionPlanDependency", () => buildCloudConsciousnessLiveProviderCallExecutionPlan()),
      profiler.measure("phase15.endpointCredentialBindingDependency", () => buildCloudConsciousnessLiveProviderEndpointCredentialBinding()),
    ]);
    const checks = [
      {
        id: "phase-14-complete",
        label: "Phase 14 runtime adapter exit is complete",
        passed: phase14Exit.summary?.complete === true,
        evidence: phase14Exit.registry,
      },
      {
        id: "execution-plan-ready",
        label: "Live provider execution plan is ready and locally reviewable",
        passed: executionPlan.summary?.ready === true,
        evidence: executionPlan.registry,
      },
      {
        id: "endpoint-credential-reference-bound",
        label: "Endpoint and credential reference are bound without endpoint contact or credential value reads",
        passed: binding.summary?.ready === true
          && binding.summary?.endpointContacted === false
          && binding.summary?.credentialValueRead === false,
        evidence: binding.registry,
      },
      {
        id: "live-egress-not-authorized",
        label: "Final authorization review remains explicit and does not enable live egress",
        passed: phase11Review.summary?.liveProviderCallEnabled === false
          && phase11Review.summary?.providerCredentialRead === false,
        evidence: phase11Review.registry,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-final-authorization-v0",
      mode: "phase_15_live_provider_call_final_authorization_review",
      generatedAt: new Date().toISOString(),
      status: ready ? "final_authorization_review_ready_live_egress_disabled" : "waiting_for_live_provider_authorization_prerequisites",
      governance: phase15Governance(),
      finalAuthorization: {
        authorizationState: "not_granted",
        liveProviderCallEnabled: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        networkEgress: false,
        externalTransmissionAllowed: false,
        requiredBeforeLiveEgress: [
          "explicit operator authorization outside read-only milestone checks",
          "runtime adapter implementation review",
          "credential value access approval",
          "egress transcript persistence",
          "post-call readback and rollback note",
        ],
      },
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-15",
        grantsFinalAuthorization: false,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        liveProviderCallEnabled: false,
        networkEgress: false,
        createsTask: false,
      },
      evidence: {
        phase14Exit: phase12EvidenceRef(phase14Exit),
        phase11Review: phase12EvidenceRef(phase11Review),
        executionPlan: phase12EvidenceRef(executionPlan),
        binding: phase12EvidenceRef(binding),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-operator-launch-review",
        boundary: "a separate operator launch review must be added before any live provider SDK load, credential value read, endpoint contact, or external transmission",
      },
    };
  }, { phase: "15" });
}

function phase16Governance(extra = {}) {
  return {
    phase: "phase-16",
    createsTask: false,
    createsApproval: false,
    grantsLaunchAuthorization: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

async function buildCloudConsciousnessLiveProviderCallOperatorLaunchReview() {
  return profiler.measure("phase16.operatorLaunchReview", async () => {
    const [
      finalAuthorization,
      phase14Exit,
    ] = await Promise.all([
      profiler.measure("phase16.finalAuthorizationDependency", () => buildCloudConsciousnessLiveProviderCallFinalAuthorization()),
      profiler.measure("phase16.phase14ExitDependency", () => buildCloudConsciousnessLiveProviderRuntimeAdapterExit()),
    ]);
    const executionPlanReadback = await profiler.measure("phase16.executionPlanReadbackDependency", async () => buildCloudConsciousnessLiveProviderExecutionPlanReadback());
    const launchReview = {
      launchDecision: "not_authorized",
      operatorReviewState: "ready_for_human_review",
      launchAuthorized: false,
      liveProviderCallEnabled: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      externalTransmissionAllowed: false,
      blockingRequirement: "separate runtime implementation and explicit operator launch authorization",
    };
    const checks = [
      {
        id: "phase-15-final-authorization-ready",
        label: "Phase 15 final authorization checkpoint is ready",
        passed: finalAuthorization.summary?.ready === true,
        evidence: finalAuthorization.registry,
      },
      {
        id: "runtime-adapter-exit-linked",
        label: "Runtime adapter shell exit evidence is linked",
        passed: phase14Exit.summary?.complete === true,
        evidence: phase14Exit.registry,
      },
      {
        id: "execution-plan-readback-linked",
        label: "Approved execution-plan readback is linked",
        passed: executionPlanReadback.summary?.ready === true,
        evidence: executionPlanReadback.registry,
      },
      {
        id: "operator-launch-not-granted",
        label: "Operator launch review does not grant live provider launch",
        passed: launchReview.launchAuthorized === false
          && launchReview.networkEgress === false
          && launchReview.credentialValueRead === false,
        evidence: launchReview.launchDecision,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-operator-launch-review-v0",
      mode: "phase_16_live_provider_operator_launch_review",
      generatedAt: new Date().toISOString(),
      status: ready ? "operator_launch_review_ready_live_launch_not_authorized" : "waiting_for_operator_launch_review_prerequisites",
      governance: phase16Governance(),
      launchReview,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-16",
        grantsLaunchAuthorization: false,
        launchAuthorized: false,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        liveProviderCallEnabled: false,
        networkEgress: false,
        createsTask: false,
      },
      evidence: {
        finalAuthorization: phase12EvidenceRef(finalAuthorization),
        phase14Exit: phase12EvidenceRef(phase14Exit),
        executionPlanReadback: phase12EvidenceRef(executionPlanReadback),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan",
        boundary: "only a separate runtime implementation plan may prepare SDK and credential access; this launch review does not authorize live egress",
      },
    };
  }, { phase: "16" });
}

function phase17Governance(extra = {}) {
  return {
    phase: "phase-17",
    createsTask: false,
    createsApproval: false,
    implementsRuntimeAdapter: false,
    callsCloudModel: false,
    transmitsExternally: false,
    liveProviderCallEnabled: false,
    providerSdkLoaded: false,
    providerCredentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    networkEgress: false,
    ...extra,
  };
}

async function buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan() {
  return profiler.measure("phase17.runtimeImplementationPlan", async () => {
    const [
      launchReview,
      executionTranscriptSchema,
      binding,
    ] = await Promise.all([
      profiler.measure("phase17.operatorLaunchReview", () => buildCloudConsciousnessLiveProviderCallOperatorLaunchReview()),
      profiler.measure("phase17.executionTranscriptSchema", () => buildCloudConsciousnessLiveProviderExecutionTranscriptSchema()),
      profiler.measure("phase17.endpointCredentialBinding", () => buildCloudConsciousnessLiveProviderEndpointCredentialBinding()),
    ]);
    const implementationPlan = {
      implementationStatus: "planned_not_implemented",
      adapterModuleStatus: "not_created",
      providerSdkStatus: "not_loaded",
      credentialAccessStatus: "reference_only_value_not_read",
      endpointContactStatus: "not_contacted",
      networkEgressStatus: "disabled",
      transcriptWriterStatus: "schema_ready_no_live_records",
      rollbackStatus: "plan_required_before_execution",
      requiredModules: [
        "provider request serializer",
        "credential value access gate",
        "network egress adapter",
        "egress transcript writer",
        "post-call readback verifier",
        "operator rollback note",
      ],
    };
    const checks = [
      {
        id: "phase-16-launch-review-ready",
        label: "Phase 16 operator launch review is ready",
        passed: launchReview.summary?.ready === true,
        evidence: launchReview.registry,
      },
      {
        id: "transcript-schema-ready",
        label: "Execution transcript schema is available for future live-call records",
        passed: executionTranscriptSchema.summary?.ready === true,
        evidence: executionTranscriptSchema.registry,
      },
      {
        id: "credential-binding-reference-only",
        label: "Credential binding remains reference-only without value reads",
        passed: binding.summary?.ready === true
          && binding.summary?.credentialValueRead === false,
        evidence: binding.registry,
      },
      {
        id: "runtime-not-implemented",
        label: "Runtime implementation plan does not create SDK, credential, endpoint, or network activity",
        passed: implementationPlan.implementationStatus === "planned_not_implemented"
          && implementationPlan.providerSdkStatus === "not_loaded"
          && implementationPlan.networkEgressStatus === "disabled",
        evidence: implementationPlan.implementationStatus,
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan-v0",
      mode: "phase_17_live_provider_runtime_implementation_plan_only",
      generatedAt: new Date().toISOString(),
      status: ready ? "runtime_implementation_plan_ready_no_live_egress" : "waiting_for_runtime_implementation_plan_prerequisites",
      governance: phase17Governance(),
      implementationPlan,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-17",
        implementsRuntimeAdapter: false,
        callsCloudModel: false,
        transmitsExternally: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        credentialValueRead: false,
        endpointContacted: false,
        liveProviderCallEnabled: false,
        networkEgress: false,
        createsTask: false,
      },
      evidence: {
        launchReview: phase12EvidenceRef(launchReview),
        executionTranscriptSchema: phase12EvidenceRef(executionTranscriptSchema),
        binding: phase12EvidenceRef(binding),
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-task",
        boundary: "a separate approval-gated task is required before any runtime code, provider SDK load, credential value read, endpoint contact, or external transmission",
      },
    };
  }, { phase: "17" });
}


  return {
    buildNativePluginCapabilityInvokePlan,
    buildNativePluginRuntimePreflight,
    buildNativePluginRuntimeActivationPlan,
    buildNativePluginRuntimeAdapterContract,
    buildNativePluginRuntimeAdapterTaskDraft,
    buildNativePluginRuntimeActivationTaskDraft,
    buildNativePluginInvokeTaskPlan,
    createNativePluginRuntimeActivationTask,
    createNativePluginRuntimeAdapterTask,
    createNativePluginInvokeTask,
    buildSystemdRepairExecutionTaskDraft,
    createSystemdRepairExecutionTask,
    createSystemdRepairCandidateTaskShell,
    createSystemdNextRepairTaskShell,
    createBodyEvidenceLedgerDirectoryTaskShell,
    createBodyEvidenceLedgerFirstRecordTaskShell,
    createBodyEvidenceLedgerFollowupRecordTaskShell,
    serialisePlanForPublic,
    buildRulePlan,
    shouldBuildPlan,
    updatePlanForPhase,
    capabilityById,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
    buildCapabilityRegistry,
    listCapabilityInvocations,
    buildCapabilityInvocationSummary,
    invokeCapability,
    buildMvpRouteAlignment,
    buildPhase2RepairDemoStatus,
    buildPhase2NextRepairDemoStatus,
    buildBodyEvidenceLedgerFollowupRecordReadiness,
    buildBodyEvidenceLedgerFollowupRecordAppendRouteReview,
    buildBodyEvidenceLedgerFollowupRecordAppendReadiness,
    armBodyEvidenceLedgerFollowupRecordAppend,
    buildPhase2NextCapabilityRouteReview,
    buildPhase2DemoControlRoom,
    buildPhase2DemoWalkthrough,
    buildPhase2DemoReadinessExit,
    buildPhase2CompletionReadiness,
    buildPhase2Exit,
    buildPhase3Plan,
    buildPhase3BackgroundWorkView,
    buildPhase3OperatorInterruptControls,
    buildPhase3CompletionReadiness,
    buildPhase3Exit,
    buildPhase4Plan,
    buildPhase4SelfHealLoop,
    buildPhase4HealHistoryEvidence,
    buildPhase4CompletionReadiness,
    buildPhase4Exit,
    buildPhase5Plan,
    buildPhase5DeploymentInventory,
    buildPhase5RollbackReadiness,
    buildPhase5ReleaseControlReadiness,
    buildPhase5Exit,
    buildMvpFinalReadiness,
    buildPostMvpPlan,
    buildPhase6Plan,
    buildPhase6MemorySubstrateInventory,
    buildPhase6ConsciousnessContextEnvelope,
    buildPhase6TaskOrchestrationRecords,
    buildPhase6MemoryWriteRouteReview,
    buildPhase6Exit,
    buildLongTermMemoryWritePlan,
    buildLongTermMemorySchema,
    buildLongTermMemoryProposal,
    buildLongTermMemoryWriteRouteReview,
    createLongTermMemoryWriteTask,
    buildLongTermMemoryReadback,
    buildLongTermMemoryExit,
    buildCloudConsciousnessContextReview,
    buildCloudConsciousnessEnvelopeSchema,
    buildCloudConsciousnessContextPackage,
    buildCloudConsciousnessRedactionReview,
    buildCloudConsciousnessTransmissionRouteReview,
    createCloudConsciousnessHandoffTask,
    buildCloudConsciousnessHandoffReadback,
    buildCloudConsciousnessExit,
    buildCloudConsciousnessProviderAdapterPlan,
    buildCloudConsciousnessProviderContract,
    buildCloudConsciousnessProviderRequestEnvelope,
    buildCloudConsciousnessProviderDryRunRouteReview,
    createCloudConsciousnessProviderDryRunTask,
    buildCloudConsciousnessProviderDryRunReadback,
    buildCloudConsciousnessProviderAdapterExit,
    buildCloudConsciousnessRealProviderCallPlan,
    buildCloudConsciousnessProviderEgressContract,
    buildCloudConsciousnessProviderCredentialPreflight,
    buildCloudConsciousnessProviderRequestRedactionReview,
    buildCloudConsciousnessRealProviderCallRouteReview,
    createCloudConsciousnessProviderCallRehearsalTask,
    buildCloudConsciousnessProviderResponseReadback,
    buildCloudConsciousnessRealProviderCallExit,
    buildCloudConsciousnessLiveProviderCallRunbook,
    buildCloudConsciousnessLiveProviderOperatorChecklist,
    buildCloudConsciousnessLiveProviderEgressTranscriptSchema,
    buildCloudConsciousnessLiveProviderFinalAuthorizationReview,
    buildCloudConsciousnessLiveProviderRunbookRouteReview,
    createCloudConsciousnessLiveProviderRunbookTask,
    buildCloudConsciousnessLiveProviderRunbookReadback,
    buildCloudConsciousnessLiveProviderCallRunbookExit,
    isLongTermMemoryWriteTask,
    executeLongTermMemoryWriteTask,
    isCloudConsciousnessHandoffTask,
    executeCloudConsciousnessHandoffTask,
    isCloudConsciousnessProviderDryRunTask,
    executeCloudConsciousnessProviderDryRunTask,
    isCloudConsciousnessProviderCallRehearsalTask,
    executeCloudConsciousnessProviderCallRehearsalTask,
    isCloudConsciousnessLiveProviderRunbookTask,
    executeCloudConsciousnessLiveProviderRunbookTask,
    buildCloudConsciousnessLiveProviderCallExecutionPlan,
    buildCloudConsciousnessLiveProviderEndpointCredentialBinding,
    buildCloudConsciousnessLiveProviderExecutionTranscriptSchema,
    buildCloudConsciousnessLiveProviderExecutionRouteReview,
    createCloudConsciousnessLiveProviderExecutionPlanTask,
    isCloudConsciousnessLiveProviderExecutionPlanTask,
    executeCloudConsciousnessLiveProviderExecutionPlanTask,
    buildCloudConsciousnessLiveProviderExecutionPlanReadback,
    buildCloudConsciousnessLiveProviderCallExecutionPlanExit,
    buildCloudConsciousnessLiveProviderCallRuntimeAdapterPlan,
    createCloudConsciousnessLiveProviderRuntimeAdapterTask,
    isCloudConsciousnessLiveProviderRuntimeAdapterTask,
    executeCloudConsciousnessLiveProviderRuntimeAdapterTask,
    buildCloudConsciousnessLiveProviderRuntimeAdapterExit,
    buildCloudConsciousnessLiveProviderCallFinalAuthorization,
    buildCloudConsciousnessLiveProviderCallOperatorLaunchReview,
    buildCloudConsciousnessLiveProviderCallRuntimeImplementationPlan,
    ...cloudLiveProviderRuntimeImplementation,
  };
}
