export const observerClientWorkspaceSourceRefreshersScript = `async function refreshWorkspaceRegistry() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces\`);
    renderWorkspaceRegistry(data);
  } catch {
    workspaceRegistry.textContent = "offline";
    workspaceDetected.textContent = "0";
    workspaceMissing.textContent = "unknown";
    workspaceNode.textContent = "0";
    workspaceMode.textContent = "unknown";
    workspaceJson.textContent = "Unable to read OpenClaw workspace registry.";
  }
}

async function refreshWorkspaceCommandProposals() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals\`);
    renderWorkspaceCommandProposals(data);
  } catch {
    workspaceCommandRegistry.textContent = "offline";
    workspaceCommandTotal.textContent = "0";
    workspaceCommandValidation.textContent = "0";
    workspaceCommandBuild.textContent = "0";
    workspaceCommandRuntime.textContent = "0";
    workspaceCommandMode.textContent = "unknown";
    workspaceCommandJson.textContent = "Unable to read workspace command proposals.";
  }
}

async function refreshSourceCommandProposals() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals?query=command&limit=12\`);
    renderSourceCommandProposals(data);
  } catch {
    sourceCommandRegistry.textContent = "offline";
    sourceCommandTotal.textContent = "0";
    sourceCommandTools.textContent = "0";
    sourceCommandPrompts.textContent = "0";
    sourceCommandMode.textContent = "unknown";
    sourceCommandJson.textContent = "Unable to read source-derived command proposals.";
  }
}

async function refreshSourceCommandPlanDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals/plan?proposalId=openclaw:typecheck&query=command\`);
    renderSourceCommandPlanDraft(data);
  } catch {
    sourceCommandPlanRegistry.textContent = "offline";
    sourceCommandPlanProposal.textContent = "none";
    sourceCommandPlanDecision.textContent = "unknown";
    sourceCommandPlanTask.textContent = "false";
    sourceCommandPlanMode.textContent = "unknown";
    sourceCommandPlanJson.textContent = "Unable to read source-derived command plan draft.";
  }
}

async function refreshWorkspaceMigrationMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-migration-map\`);
    renderWorkspaceMigrationMap(data);
  } catch {
    workspaceMigrationRegistry.textContent = "offline";
    workspaceMigrationTotal.textContent = "0";
    workspaceMigrationCapabilities.textContent = "0";
    workspaceMigrationHigh.textContent = "0";
    workspaceMigrationMode.textContent = "unknown";
    workspaceMigrationJson.textContent = "Unable to read OpenClaw source migration map.";
  }
}

async function refreshWorkspaceMigrationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-migration-plan\`);
    renderWorkspaceMigrationPlan(data);
  } catch {
    workspaceMigrationPlanRegistry.textContent = "offline";
    workspaceMigrationPlanTotal.textContent = "0";
    workspaceMigrationPlanCandidates.textContent = "0";
    workspaceMigrationPlanBacklog.textContent = "0";
    workspaceMigrationPlanMode.textContent = "unknown";
    workspaceMigrationPlanJson.textContent = "Unable to read OpenClaw source migration plan.";
  }
}

async function refreshPluginSdkContractReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-contract-review\`);
    renderPluginSdkContractReview(data);
  } catch {
    pluginSdkReviewRegistry.textContent = "offline";
    pluginSdkReviewTotal.textContent = "0";
    pluginSdkReviewManifest.textContent = "0";
    pluginSdkReviewTypes.textContent = "0";
    pluginSdkReviewExports.textContent = "0";
    pluginSdkReviewMode.textContent = "unknown";
    pluginSdkReviewJson.textContent = "Unable to read plugin SDK contract review.";
  }
}

async function refreshPluginSdkSourceReviewScope() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-source-review-scope\`);
    renderPluginSdkSourceReviewScope(data);
  } catch {
    pluginSdkSourceScopeRegistry.textContent = "offline";
    pluginSdkSourceScopeTotal.textContent = "0";
    pluginSdkSourceScopeContent.textContent = "unknown";
    pluginSdkSourceScopeApproval.textContent = "unknown";
    pluginSdkSourceScopeMode.textContent = "unknown";
    pluginSdkSourceScopeJson.textContent = "Unable to read plugin SDK source review scope.";
  }
}

async function refreshPluginSdkSourceContentReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-source-content-review\`);
    renderPluginSdkSourceContentReview(data);
  } catch {
    pluginSdkSourceContentRegistry.textContent = "offline";
    pluginSdkSourceContentRead.textContent = "0";
    pluginSdkSourceContentExports.textContent = "0";
    pluginSdkSourceContentRaw.textContent = "unknown";
    pluginSdkSourceContentMode.textContent = "unknown";
    pluginSdkSourceContentJson.textContent = "Unable to read plugin SDK source content review.";
  }
}

async function refreshPluginSdkNativeContractTests() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-native-contract-tests\`);
    renderPluginSdkNativeContractTests(data);
  } catch {
    pluginSdkNativeTestsRegistry.textContent = "offline";
    pluginSdkNativeTestsRequired.textContent = "0/0";
    pluginSdkNativeTestsSource.textContent = "0";
    pluginSdkNativeTestsCaps.textContent = "0";
    pluginSdkNativeTestsMode.textContent = "unknown";
    pluginSdkNativeTestsJson.textContent = "Unable to read plugin SDK native contract tests.";
  }
}

async function refreshNativeSdkContractImplementation() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-sdk-contract-implementation\`);
    renderNativeSdkContractImplementation(data);
  } catch {
    nativeSdkImplementationRegistry.textContent = "offline";
    nativeSdkImplementationSlots.textContent = "0/0";
    nativeSdkImplementationReadOnly.textContent = "0";
    nativeSdkImplementationExecutable.textContent = "0";
    nativeSdkImplementationMode.textContent = "unknown";
    nativeSdkImplementationJson.textContent = "Unable to read native SDK contract implementation.";
  }
}

async function refreshOpenClawToolCatalog() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-tool-catalog\`);
    renderOpenClawToolCatalog(data);
  } catch {
    openclawToolCatalogRegistry.textContent = "offline";
    openclawToolCatalogTools.textContent = "0";
    openclawToolCatalogDocs.textContent = "0";
    openclawToolCatalogCategories.textContent = "0";
    openclawToolCatalogMode.textContent = "unknown";
    openclawToolCatalogJson.textContent = "Unable to read OpenClaw tool catalog.";
  }
}

async function refreshPluginManifestMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-plugin-manifest-map\`);
    renderPluginManifestMap(data);
  } catch {
    pluginManifestMapRegistry.textContent = "offline";
    pluginManifestMapManifests.textContent = "0";
    pluginManifestMapCategories.textContent = "0";
    pluginManifestMapAuth.textContent = "0";
    pluginManifestMapMode.textContent = "unknown";
    pluginManifestMapJson.textContent = "Unable to read OpenClaw plugin manifest map.";
  }
}

async function refreshPluginCapabilityPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-capability-plan?limit=40\`);
    renderPluginCapabilityPlan(data);
  } catch {
    pluginCapabilityPlanRegistry.textContent = "offline";
    pluginCapabilityPlanCandidates.textContent = "0";
    pluginCapabilityPlanBlocked.textContent = "0";
    pluginCapabilityPlanApproval.textContent = "0";
    pluginCapabilityPlanRuntime.textContent = "unknown";
    pluginCapabilityPlanJson.textContent = "Unable to read OpenClaw plugin capability plan.";
  }
}

async function refreshPluginCandidateContractTests() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-candidate-contract-tests?category=search_and_web&limit=8\`);
    renderPluginCandidateContractTests(data);
  } catch {
    pluginCandidateContractTestsRegistry.textContent = "offline";
    pluginCandidateContractTestsCategory.textContent = "unknown";
    pluginCandidateContractTestsRequired.textContent = "0/0";
    pluginCandidateContractTestsContracts.textContent = "0";
    pluginCandidateContractTestsRuntime.textContent = "unknown";
    pluginCandidateContractTestsJson.textContent = "Unable to read OpenClaw plugin candidate contract tests.";
  }
}

async function refreshPluginSearchWebAdapterContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-contract?limit=8\`);
    renderPluginSearchWebAdapterContract(data);
  } catch {
    pluginSearchWebContractRegistry.textContent = "offline";
    pluginSearchWebContractProviders.textContent = "0";
    pluginSearchWebContractRequired.textContent = "0/0";
    pluginSearchWebContractNetwork.textContent = "unknown";
    pluginSearchWebContractRuntime.textContent = "unknown";
    pluginSearchWebContractJson.textContent = "Unable to read OpenClaw search/web adapter contract.";
  }
}

async function refreshPluginSearchWebRuntimePreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight?providerContractId=openclaw.web-search&limit=8\`);
    renderPluginSearchWebRuntimePreflight(data);
  } catch {
    pluginSearchWebPreflightRegistry.textContent = "offline";
    pluginSearchWebPreflightEnvelope.textContent = "missing";
    pluginSearchWebPreflightApproval.textContent = "unknown";
    pluginSearchWebPreflightNetwork.textContent = "unknown";
    pluginSearchWebPreflightRuntime.textContent = "unknown";
    pluginSearchWebPreflightJson.textContent = "Unable to read OpenClaw search/web runtime preflight.";
  }
}

async function refreshPluginSearchWebRuntimeActivationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-plan?providerContractId=openclaw.web-search&limit=8\`);
    renderPluginSearchWebRuntimeActivationPlan(data);
  } catch {
    pluginSearchWebActivationRegistry.textContent = "offline";
    pluginSearchWebActivationStatus.textContent = "unknown";
    pluginSearchWebActivationRequired.textContent = "0/0";
    pluginSearchWebActivationNetwork.textContent = "unknown";
    pluginSearchWebActivationRuntime.textContent = "unknown";
    pluginSearchWebActivationJson.textContent = "Unable to read OpenClaw search/web runtime activation plan.";
  }
}

async function refreshPluginSearchWebProviderRuntimeSandbox() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox?providerContractId=openclaw.web-search&limit=8\`);
    renderPluginSearchWebProviderRuntimeSandbox(data);
  } catch {
    pluginSearchWebSandboxRegistry.textContent = "offline";
    pluginSearchWebSandboxStatus.textContent = "unknown";
    pluginSearchWebSandboxRequired.textContent = "0/0";
    pluginSearchWebSandboxNetwork.textContent = "unknown";
    pluginSearchWebSandboxRuntime.textContent = "unknown";
    pluginSearchWebSandboxJson.textContent = "Unable to read OpenClaw search/web provider runtime sandbox contract.";
  }
}

async function refreshToolCatalogAdapter() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/tool-catalog\`);
    renderToolCatalogAdapter(data);
  } catch {
    toolCatalogAdapterRegistry.textContent = "offline";
    toolCatalogAdapterMatches.textContent = "0";
    toolCatalogAdapterCategories.textContent = "0";
    toolCatalogAdapterExecution.textContent = "unknown";
    toolCatalogAdapterMode.textContent = "unknown";
    toolCatalogAdapterJson.textContent = "Unable to read native tool catalog adapter.";
  }
}

async function refreshEngineeringToolSurface() {
  try {
    const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "sense.openclaw.engineering_tool_surface_inventory",
        intent: "engineering.tool_surface_inventory",
        params: {},
      }),
    });
    if (response.invoked !== true) {
      throw new Error("Engineering tool surface inventory capability was not invoked.");
    }
    renderEngineeringToolSurface(response.result ?? {});
  } catch {
    engineeringToolSurfaceRegistry.textContent = "offline";
    engineeringToolSurfaceTools.textContent = "0";
    engineeringToolSurfaceDeferred.textContent = "0";
    engineeringToolSurfaceExecution.textContent = "unknown";
    engineeringToolSurfaceMode.textContent = "unknown";
    engineeringToolSurfaceJson.textContent = "Unable to read native engineering tool surface inventory.";
  }
}

async function refreshEngineeringReadSearch() {
  try {
    const invoke = (body) => fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const [readResponse, globResponse, grepResponse] = await Promise.all([
      invoke({
        capabilityId: "sense.openclaw.engineering_tool.read",
        intent: "engineering.read",
        params: { relativePath: "package.json", maxOutputChars: 2000 },
      }),
      invoke({
        capabilityId: "sense.openclaw.engineering_tool.glob",
        intent: "engineering.glob",
        params: { pattern: "**/*.ts", limit: 20 },
      }),
      invoke({
        capabilityId: "sense.openclaw.engineering_tool.grep",
        intent: "engineering.grep",
        params: { query: "openclaw", literal: true, include: "**/*", limit: 10, maxOutputChars: 4000 },
      }),
    ]);
    if ([readResponse, globResponse, grepResponse].some((response) => response.invoked !== true)) {
      throw new Error("Engineering read/search capability was not invoked.");
    }
    renderEngineeringReadSearch({
      read: readResponse.result ?? {},
      glob: globResponse.result ?? {},
      grep: grepResponse.result ?? {},
    });
  } catch {
    engineeringReadSearchRegistry.textContent = "offline";
    engineeringReadSearchRead.textContent = "0";
    engineeringReadSearchGlob.textContent = "0";
    engineeringReadSearchGrep.textContent = "0";
    engineeringReadSearchBounds.textContent = "unknown";
    engineeringReadSearchJson.textContent = "Unable to read native engineering read/search evidence.";
  }
}

async function refreshEngineeringLspEvidence() {
  try {
    const [evidence, lifecycleDraft, sourceTransferProposal, symbolRequestProposal] = await Promise.all([
      fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/evidence?action=check&language=typescript&limit=200\`),
      fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/lifecycle-draft?language=typescript&lifecycleAction=start&limit=200\`),
      fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/source-transfer-proposal?language=typescript&relativePath=src/app.ts&maxPreviewChars=1200\`),
      fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-lsp/symbol-request-proposal?language=typescript&action=definition&relativePath=src/app.ts&line=2&character=14\`),
    ]);
    renderEngineeringLspEvidence({ evidence, lifecycleDraft, sourceTransferProposal, symbolRequestProposal });
  } catch {
    engineeringLspRegistry.textContent = "offline";
    engineeringLspLanguages.textContent = "none";
    engineeringLspServer.textContent = "unknown";
    engineeringLspRuntime.textContent = "unknown";
    engineeringLspMode.textContent = "unknown";
    engineeringLspJson.textContent = "Unable to read native engineering LSP evidence.";
  }
}

async function refreshEngineeringEditProposal() {
  try {
    const response = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "act.openclaw.engineering_tool.edit_proposal",
        intent: "engineering.edit_proposal",
        params: {
          relativePath: "package.json",
          oldString: "OpenClaw on NixOS monorepo skeleton",
          newString: "OpenClaw on NixOS native agent body skeleton",
          contextLines: 1,
          maxOutputChars: 8000,
        },
      }),
    });
    if (response.invoked !== true) {
      throw new Error("Engineering edit proposal capability was not invoked.");
    }
    renderEngineeringEditProposal(response.result ?? {});
  } catch {
    engineeringEditProposalRegistry.textContent = "offline";
    engineeringEditProposalTarget.textContent = "none";
    engineeringEditProposalPreview.textContent = "0 lines";
    engineeringEditProposalApply.textContent = "unknown";
    engineeringEditProposalAudit.textContent = "missing";
    engineeringEditProposalJson.textContent = "Unable to read native engineering edit proposal evidence.";
  }
}

async function refreshEngineeringWriteProposal() {
  try {
    const content = encodeURIComponent("OpenClaw engineering write proposal preview\\n");
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-write-proposal/draft?relativePath=scratch/engineering-write-proposal.txt&content=\${content}&overwrite=false&contextLines=1\`);
    renderEngineeringWriteProposal(data);
  } catch {
    engineeringWriteProposalRegistry.textContent = "offline";
    engineeringWriteProposalKind.textContent = "unknown";
    engineeringWriteProposalTarget.textContent = "none";
    engineeringWriteProposalBytes.textContent = "0";
    engineeringWriteProposalMutation.textContent = "unknown";
    engineeringWriteProposalMode.textContent = "unknown";
    engineeringWriteProposalJson.textContent = "Unable to read native engineering write proposal evidence.";
  }
}

async function refreshEngineeringWriteExecutionEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/engineering-write-execution/evidence?limit=10\`);
    renderEngineeringWriteExecutionEvidence(data);
  } catch {
    engineeringWriteExecutionRegistry.textContent = "offline";
    engineeringWriteExecutionTotal.textContent = "0";
    engineeringWriteExecutionPassed.textContent = "0";
    engineeringWriteExecutionProposal.textContent = "0";
    engineeringWriteExecutionMutation.textContent = "unknown";
    engineeringWriteExecutionMode.textContent = "unknown";
    engineeringWriteExecutionJson.textContent = "Unable to read native engineering write execution evidence.";
  }
}

async function refreshSemanticIndex() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-semantic-index?scope=tools&limit=24\`);
    renderSemanticIndex(data);
  } catch {
    semanticIndexRegistry.textContent = "offline";
    semanticIndexFiles.textContent = "0";
    semanticIndexExports.textContent = "0";
    semanticIndexSource.textContent = "unknown";
    semanticIndexMode.textContent = "unknown";
    semanticIndexJson.textContent = "Unable to read native workspace semantic index.";
  }
}

async function refreshSymbolLookup() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-symbol-lookup?scope=tools&query=tool&limit=16\`);
    renderSymbolLookup(data);
  } catch {
    symbolLookupRegistry.textContent = "offline";
    symbolLookupMatches.textContent = "0";
    symbolLookupFiles.textContent = "0";
    symbolLookupExecution.textContent = "unknown";
    symbolLookupMode.textContent = "unknown";
    symbolLookupJson.textContent = "Unable to run native workspace symbol lookup.";
  }
}

async function refreshEditTargetSelection() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-edit-target-selection?scope=tools&query=edit&limit=8\`);
    renderEditTargetSelection(data);
  } catch {
    editTargetSelectionRegistry.textContent = "offline";
    editTargetSelectionCandidates.textContent = "0";
    editTargetSelectionSelected.textContent = "none";
    editTargetSelectionSource.textContent = "unknown";
    editTargetSelectionMode.textContent = "unknown";
    editTargetSelectionJson.textContent = "Unable to select native OpenClaw workspace edit targets.";
  }
}

async function refreshPromptSemantics() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/prompt-semantics?query=edit&limit=24\`);
    renderPromptSemantics(data);
  } catch {
    promptSemanticsRegistry.textContent = "offline";
    promptSemanticsFiles.textContent = "0";
    promptSemanticsChecks.textContent = "0";
    promptSemanticsContent.textContent = "unknown";
    promptSemanticsMode.textContent = "unknown";
    promptSemanticsJson.textContent = "Unable to read native OpenClaw prompt semantics.";
  }
}

async function refreshWorkspaceTextWriteDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-text-write/draft?relativePath=scratch/observer-native-write.txt\`);
    renderWorkspaceTextWriteDraft(data);
  } catch {
    workspaceTextWriteRegistry.textContent = "offline";
    workspaceTextWriteCapability.textContent = "unknown";
    workspaceTextWriteApproval.textContent = "unknown";
    workspaceTextWriteContent.textContent = "unknown";
    workspaceTextWriteMode.textContent = "unknown";
    workspaceTextWriteJson.textContent = "Unable to read native workspace text write draft.";
  }
}

async function refreshWorkspacePatchApplyDraft() {
  try {
    const edits = encodeURIComponent(JSON.stringify([
      { search: "before", replacement: "after", occurrence: 1 },
      { search: "omega", replacement: "zeta", occurrence: 1 },
    ]));
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-patch-apply/draft?relativePath=scratch/observer-native-edit.txt&edits=\${edits}&contextLines=0\`);
    renderWorkspacePatchApplyDraft(data);
  } catch {
    workspacePatchApplyRegistry.textContent = "offline";
    workspacePatchApplyCapability.textContent = "unknown";
    workspacePatchApplyApproval.textContent = "unknown";
    workspacePatchApplyPreview.textContent = "unknown";
    workspacePatchApplyMode.textContent = "unknown";
    workspacePatchApplyJson.textContent = "Unable to read native workspace patch apply draft.";
  }
}

async function refreshNativePluginContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-contract\`);
    renderNativePluginContract(data);
  } catch {
    nativePluginContractRegistry.textContent = "offline";
    nativePluginContractOwner.textContent = "unknown";
    nativePluginContractTotal.textContent = "0";
    nativePluginContractApproval.textContent = "0";
    nativePluginContractMutation.textContent = "0";
    nativePluginContractValidation.textContent = "unknown";
    nativePluginContractJson.textContent = "Unable to read native plugin contract.";
  }
}

async function refreshNativePluginRegistry() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-registry\`);
    renderNativePluginRegistry(data);
  } catch {
    nativePluginRegistryId.textContent = "offline";
    nativePluginRegistryTotal.textContent = "0";
    nativePluginRegistryCapabilities.textContent = "0";
    nativePluginRegistryActivation.textContent = "unknown";
    nativePluginRegistryValidation.textContent = "unknown";
    nativePluginRegistryJson.textContent = "Unable to read native plugin registry.";
  }
}

async function refreshFormalIntegrationReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-formal-integration-readiness\`);
    renderFormalIntegrationReadiness(data);
  } catch {
    integrationReadinessRegistry.textContent = "offline";
    integrationReadinessStatus.textContent = "unknown";
    integrationReadinessRequired.textContent = "0/0";
    integrationReadinessRuntime.textContent = "unknown";
    integrationReadinessMode.textContent = "unknown";
    integrationReadinessJson.textContent = "Unable to read formal integration readiness.";
  }
}

async function refreshNativePluginAdapter() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-adapter\`);
    renderNativePluginAdapter(data);
  } catch {
    nativePluginAdapterRegistry.textContent = "offline";
    nativePluginAdapterStatus.textContent = "unknown";
    nativePluginAdapterImplemented.textContent = "0";
    nativePluginAdapterRuntime.textContent = "unknown";
    nativePluginAdapterMode.textContent = "unknown";
    nativePluginAdapterJson.textContent = "Unable to read native plugin adapter.";
  }
}

async function refreshNativePluginPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-preflight\`);
    renderNativePluginPreflight(data);
  } catch {
    nativePluginPreflightRegistry.textContent = "offline";
    nativePluginPreflightEnvelope.textContent = "unknown";
    nativePluginPreflightApproval.textContent = "unknown";
    nativePluginPreflightRuntime.textContent = "unknown";
    nativePluginPreflightMode.textContent = "unknown";
    nativePluginPreflightJson.textContent = "Unable to read native plugin runtime preflight.";
  }
}

async function refreshNativePluginActivationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-activation-plan\`);
    renderNativePluginActivationPlan(data);
  } catch {
    nativePluginActivationRegistry.textContent = "offline";
    nativePluginActivationStatus.textContent = "unknown";
    nativePluginActivationRequired.textContent = "0/0";
    nativePluginActivationRuntime.textContent = "unknown";
    nativePluginActivationMode.textContent = "unknown";
    nativePluginActivationJson.textContent = "Unable to read native plugin runtime activation plan.";
  }
}

async function refreshNativePluginRuntimeRefreshEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-refresh-evidence\`);
    renderNativePluginRuntimeRefreshEvidence(data);
  } catch {
    nativePluginRuntimeRefreshRegistry.textContent = "offline";
    nativePluginRuntimeRefreshState.textContent = "unknown";
    nativePluginRuntimeRefreshBlocked.textContent = "0";
    nativePluginRuntimeRefreshRuntime.textContent = "unknown";
    nativePluginRuntimeRefreshMode.textContent = "unknown";
    nativePluginRuntimeRefreshJson.textContent = "Unable to read native plugin runtime refresh evidence.";
  }
}

async function refreshAcpxCodexBridgeCompatibility() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-compatibility\`);
    const selectedSessionKey = data?.persistence?.records?.[0]?.sessionKey ?? data?.persistence?.selectedSessionKey ?? null;
    const draftUrl = selectedSessionKey
      ? \`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-draft?sessionKey=\${encodeURIComponent(selectedSessionKey)}\`
      : \`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-draft\`;
    const wrapperDraft = await fetchJson(draftUrl);
    const writeProposalUrl = selectedSessionKey
      ? \`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal?sessionKey=\${encodeURIComponent(selectedSessionKey)}\`
      : \`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal\`;
    const wrapperWriteProposal = await fetchJson(writeProposalUrl);
    const wrapperWriteExecutionEvidence = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-wrapper-write-execution/evidence?limit=5\`);
    const processSpawnProposal = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-process-spawn-proposal?limit=5\`);
    const liveExecutionBoundaryReview = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/acpx-codex-bridge-live-execution-boundary-review\`);
    renderAcpxCodexBridgeCompatibility({ ...data, wrapperDraft, wrapperWriteProposal, wrapperWriteExecutionEvidence, processSpawnProposal, liveExecutionBoundaryReview });
  } catch {
    acpxCodexBridgeRegistry.textContent = "offline";
    acpxCodexBridgeSessions.textContent = "0";
    acpxCodexBridgeSelected.textContent = "unknown";
    acpxCodexBridgeDraft.textContent = "unknown";
    acpxCodexBridgeAuth.textContent = "unknown";
    acpxCodexBridgeRuntime.textContent = "unknown";
    acpxCodexBridgeWriteEvidence.textContent = "unknown";
    acpxCodexBridgeRecovery.textContent = "unknown";
    acpxCodexBridgeSpawnProposal.textContent = "unknown";
    acpxCodexBridgeLiveBoundary.textContent = "unknown";
    acpxCodexBridgeMode.textContent = "unknown";
    acpxCodexBridgeJson.textContent = "Unable to read ACPX/Codex bridge compatibility evidence.";
  }
}

async function refreshNativePluginRuntimeAdapterContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-adapter-contract\`);
    renderNativePluginRuntimeAdapterContract(data);
  } catch {
    nativePluginRuntimeContractRegistry.textContent = "offline";
    nativePluginRuntimeContractStatus.textContent = "unknown";
    nativePluginRuntimeContractRequired.textContent = "0/0";
    nativePluginRuntimeContractRuntime.textContent = "unknown";
    nativePluginRuntimeContractMode.textContent = "unknown";
    nativePluginRuntimeContractJson.textContent = "Unable to read native plugin runtime adapter contract.";
  }
}

async function refreshNativePluginInvokePlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/invoke-plan\`);
    renderNativePluginInvokePlan(data);
  } catch {
    nativePluginInvokePlanRegistry.textContent = "offline";
    nativePluginInvokePlanCapability.textContent = "unknown";
    nativePluginInvokePlanDecision.textContent = "unknown";
    nativePluginInvokePlanRuntime.textContent = "unknown";
    nativePluginInvokePlanMode.textContent = "unknown";
    nativePluginInvokePlanJson.textContent = "Unable to read native plugin invoke plan.";
  }
}

async function refreshWorkspaceCommandPlanDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals/plan?proposalId=openclaw:typecheck\`);
    renderWorkspaceCommandPlanDraft(data);
  } catch {
    workspaceCommandPlanRegistry.textContent = "offline";
    workspaceCommandPlanProposal.textContent = "unknown";
    workspaceCommandPlanDecision.textContent = "unknown";
    workspaceCommandPlanApproval.textContent = "unknown";
    workspaceCommandPlanTask.textContent = "false";
    workspaceCommandPlanMode.textContent = "unknown";
    workspaceCommandPlanJson.textContent = "Unable to read workspace command plan draft.";
  }
}

`;
