import { createOpenClawNativePluginRegistryGenerationStore } from "../../../packages/plugin-runtime/src/plugin-registry-generation-store.mjs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { randomUUID } from "node:crypto";
import { buildNativePluginRuntimeRefreshEvidence as buildNativePluginRuntimeRefreshEvidenceEnvelope } from "./native-plugin-runtime-refresh-evidence-builders.mjs";
import { createNativePluginRuntimeRefreshTaskBuilders } from "./native-plugin-runtime-refresh-task-builders.mjs";

export function createNativePluginPlanBuilders(deps) {
  const {
    nativePluginRegistryStore = createOpenClawNativePluginRegistryGenerationStore(),
    buildNativePluginManifestProfile,
    autonomyMode,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
  } = deps;

function buildNativePluginCapabilityInvokePlan({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const manifestProfile = buildNativePluginManifestProfile({ packagePath });
  const activeGeneration = nativePluginRegistryStore.getActiveGeneration();
  const nativeRegistry = activeGeneration.registry;
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
    registryGeneration: {
      id: activeGeneration.id,
      sequence: activeGeneration.sequence,
      hash: activeGeneration.hash,
    },
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

function buildNativePluginRuntimeRefreshEvidence({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const activeGeneration = nativePluginRegistryStore.getActiveGeneration();
  return buildNativePluginRuntimeRefreshEvidenceEnvelope({
    activationPlan: buildNativePluginRuntimeActivationPlan({ packagePath, capabilityId }),
    nativeRegistry: activeGeneration.registry,
    registryGeneration: activeGeneration,
  });
}

function refreshNativePluginRuntimeRegistry() {
  return nativePluginRegistryStore.refresh();
}

const nativePluginRuntimeRefreshTaskBuilders = createNativePluginRuntimeRefreshTaskBuilders({
  buildNativePluginRuntimeRefreshEvidence,
  autonomyMode,
  createTask,
  createApprovalRequestForTask,
  supersedeOtherActiveTasks,
  reconcileRuntimeState,
  persistState,
  publishEvent,
  publishTaskApprovalIfPending,
  serialiseTask,
  serialisePlanForPublic,
});
const {
  buildNativePluginRuntimeRefreshTaskDraft,
  createNativePluginRuntimeRefreshTask,
} = nativePluginRuntimeRefreshTaskBuilders;

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

  return {
    refreshNativePluginRuntimeRegistry,
    buildNativePluginCapabilityInvokePlan,
    buildNativePluginRuntimePreflight,
    buildNativePluginRuntimeActivationPlan,
    buildNativePluginRuntimeRefreshEvidence,
    buildNativePluginRuntimeRefreshTaskDraft,
    buildNativePluginRuntimeAdapterContract,
    buildNativePluginRuntimeAdapterTaskDraft,
    buildNativePluginRuntimeActivationTaskDraft,
    buildNativePluginInvokeTaskPlan,
    createNativePluginRuntimeActivationTask,
    createNativePluginRuntimeAdapterTask,
    createNativePluginRuntimeRefreshTask,
    createNativePluginInvokeTask,
  };
}
