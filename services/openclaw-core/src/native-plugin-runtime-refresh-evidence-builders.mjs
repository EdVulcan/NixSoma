import {
  createOpenClawNativePluginRegistry,
  summariseOpenClawNativePluginRegistry,
} from "../../../packages/plugin-runtime/src/plugin-registry.mjs";

export const NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_REGISTRY = "openclaw-native-plugin-runtime-refresh-evidence-v0";

function buildLifecycleActions({ registrySummary, activationPlan }) {
  const validationOk = registrySummary.validationOk === true;
  return [
    {
      id: "recompute_native_contract_registry",
      label: "Recompute native plugin contract registry read model",
      status: validationOk ? "passed" : "blocked",
      evidence: `validationOk=${validationOk} totalPlugins=${registrySummary.totalPlugins ?? 0}`,
      mutatesRuntime: false,
      importsModule: false,
      activatesRuntime: false,
    },
    {
      id: "report_runtime_activation_gates",
      label: "Report runtime activation gates",
      status: activationPlan?.activationReady === true ? "ready" : "blocked",
      evidence: `activationReady=${Boolean(activationPlan?.activationReady)} blockedRequired=${activationPlan?.summary?.blockedRequired ?? "unknown"}`,
      mutatesRuntime: false,
      importsModule: false,
      activatesRuntime: false,
    },
    {
      id: "defer_module_cache_invalidation",
      label: "Defer module cache invalidation until a loader exists",
      status: "deferred",
      evidence: "OpenClaw_On_NixOS has no approved live plugin module loader in this slice",
      mutatesRuntime: false,
      importsModule: false,
      activatesRuntime: false,
    },
    {
      id: "block_plugin_module_load",
      label: "Block plugin module loading",
      status: "blocked",
      evidence: "canImportModule=false",
      mutatesRuntime: false,
      importsModule: false,
      activatesRuntime: false,
    },
    {
      id: "block_runtime_activation",
      label: "Block runtime activation",
      status: "blocked",
      evidence: "canActivateRuntime=false",
      mutatesRuntime: false,
      importsModule: false,
      activatesRuntime: false,
    },
  ];
}

function buildGovernance() {
  return {
    mode: "native_plugin_runtime_refresh_evidence_only",
    runtimeOwner: "openclaw_on_nixos",
    canRefreshReadModel: true,
    canInvalidateDiscoveryCache: false,
    canInvalidateModuleCache: false,
    canImportModule: false,
    canExecutePluginCode: false,
    canActivateRuntime: false,
    canMutatePluginInstallState: false,
    canCreateTask: false,
    canCreateApproval: false,
    canCallProvider: false,
    observerVisible: true,
  };
}

export function buildNativePluginRuntimeRefreshEvidence({
  activationPlan = null,
  nativeRegistry = createOpenClawNativePluginRegistry(),
  registryGeneration = null,
} = {}) {
  const registrySummary = summariseOpenClawNativePluginRegistry(nativeRegistry);
  const generatedAt = new Date().toISOString();
  const lifecycleActions = buildLifecycleActions({ registrySummary, activationPlan });
  const blockedActions = lifecycleActions.filter((action) => action.status === "blocked").length;
  const deferredActions = lifecycleActions.filter((action) => action.status === "deferred").length;

  return {
    ok: true,
    registry: NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_REGISTRY,
    mode: "governed-runtime-refresh-evidence-only",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "live plugin runtime refresh",
      intendedNativeCapabilityId: "sense.openclaw.plugin_runtime.refresh_evidence",
      migrationMode: "read_model_refresh_evidence_before_loader_activation",
    },
    capability: {
      id: "sense.openclaw.plugin_runtime.refresh_evidence",
      sourceToolName: "live plugin runtime refresh",
      risk: "medium",
      approvalRequired: false,
    },
    sourceRegistries: [
      nativeRegistry.registry,
      activationPlan?.registry ?? "openclaw-native-plugin-runtime-activation-plan-v0",
    ],
    runtimeState: {
      activeGenerationId: registryGeneration?.id ?? null,
      activeGenerationSequence: registryGeneration?.sequence ?? null,
      activeGenerationHash: registryGeneration?.hash ?? null,
      runtimeOwner: nativeRegistry.runtimeOwner,
      registryMode: nativeRegistry.mode,
      activationMode: nativeRegistry.activationMode,
      validationOk: registrySummary.validationOk,
      totalPlugins: registrySummary.totalPlugins,
      totalCapabilities: registrySummary.totalCapabilities,
      activeLoader: false,
      loadedPluginModules: 0,
      moduleCacheInvalidated: false,
      readModelRefreshed: true,
    },
    refreshIntent: {
      action: "recompute_native_plugin_runtime_read_model",
      cacheInvalidationIntent: "deferred_until_governed_loader_exists",
      setupOnlyChannelPluginRefresh: false,
      installEnableDisableRefresh: "evidence_only",
      noModuleLoad: true,
      noRuntimeActivation: true,
    },
    activationPlan: activationPlan
      ? {
          registry: activationPlan.registry,
          status: activationPlan.status,
          activationReady: activationPlan.activationReady === true,
          summary: activationPlan.summary,
        }
      : null,
    lifecycleActions,
    summary: {
      readModelRefreshed: true,
      validationOk: registrySummary.validationOk,
      refreshEvidenceReady: registrySummary.validationOk === true,
      blockedActions,
      deferredActions,
      activationReady: false,
      canInvalidateRuntimeCache: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutatePluginInstallState: false,
      createsTask: false,
      createsApproval: false,
    },
    governance: buildGovernance(),
    auditEvidence: {
      operation: "plugin_runtime_refresh_evidence",
      capabilityId: "sense.openclaw.plugin_runtime.refresh_evidence",
      generatedAt,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no plugin module import",
      "no plugin code execution",
      "no runtime activation",
      "no discovery cache invalidation",
      "no module cache invalidation",
      "no install or enable state mutation",
      "no task creation",
      "no approval creation",
      "no provider call",
    ],
  };
}
