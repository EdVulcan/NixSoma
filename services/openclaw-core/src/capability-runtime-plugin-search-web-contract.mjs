const CAPABILITY_ID = "plan.openclaw.plugin_search_web_adapter_contract";

function requireBuilder(builder) {
  if (typeof builder !== "function") {
    throw new Error("Native search/web adapter contract builder is not configured.");
  }
  return builder;
}

export function createPluginSearchWebContractCapabilityHandlers({
  buildOpenClawPluginSearchWebAdapterContract,
} = {}) {
  function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    return {
      handled: true,
      result: requireBuilder(buildOpenClawPluginSearchWebAdapterContract)({
        workspacePath: request.params?.workspacePath,
        query: request.params?.query ?? request.params?.q,
        limit: request.params?.limit,
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const adapter = result?.adapter ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "plugin.search_web_adapter_contract",
      ok: result?.ok === true,
      registry: result?.registry ?? null,
      providerContractCount: summary.providerContractCount ?? 0,
      operationCount: summary.operationCount ?? 0,
      requiredChecks: summary.requiredChecks ?? 0,
      passedRequired: summary.passedRequired ?? 0,
      failedRequired: summary.failedRequired ?? 0,
      adapterContractReady: summary.adapterContractReady === true,
      runtimeAdapterImplemented: summary.runtimeAdapterImplemented === true,
      noNetwork: summary.canUseNetwork === false
        && adapter.canUseNetwork === false
        && governance.canUseNetwork === false,
      noModuleImport: summary.canImportModule === false
        && adapter.canImportModule === false
        && governance.canImportModule === false,
      noPluginExecution: summary.canExecutePluginCode === false
        && adapter.canExecutePluginCode === false
        && governance.canExecutePluginCode === false,
      noRuntimeActivation: summary.canActivateRuntime === false
        && adapter.canActivateRuntime === false
        && governance.canActivateRuntime === false,
      noTaskCreation: summary.createsTask === false
        && adapter.createsTask === false
        && governance.createsTask === false,
      noApprovalCreation: summary.createsApproval === false
        && adapter.createsApproval === false
        && governance.createsApproval === false,
      noManifestBodyExposure: governance.exposesManifestBodies === false,
      noAuthEnvVarNameExposure: governance.exposesAuthEnvVarNames === false,
      noEndpointHostExposure: governance.exposesEndpointHosts === false,
      noConfigSchemaExposure: governance.exposesConfigSchemaBodies === false,
      noSourceContentExposure: governance.exposesSourceFileContent === false,
      requiresExplicitApprovalBeforeNetworkUse: governance.requiresExplicitApprovalBeforeNetworkUse === true,
    };
  }

  return { callBackend, summariseResult };
}
