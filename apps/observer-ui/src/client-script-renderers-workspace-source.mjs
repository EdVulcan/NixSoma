export const observerClientWorkspaceSourceRenderersScript = `function renderWorkspaceRegistry(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  workspaceRegistry.textContent = data?.registry ?? "workspace-detect-v0";
  workspaceDetected.textContent = String(summary.detected ?? 0);
  workspaceMissing.textContent = String(summary.missing ?? 0);
  workspaceNode.textContent = String(summary.nodeWorkspaces ?? 0);
  workspaceMode.textContent = data?.mode ?? "read-only";

  workspaceJson.textContent = [
    "Read-only detection: no file contents, mutations, or command execution.",
    \`Registry: \${data?.registry ?? "workspace-detect-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only"}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Detected: \${summary.detected ?? 0}\`,
    \`Missing: \${summary.missing ?? 0}\`,
    \`Node Workspaces: \${summary.nodeWorkspaces ?? 0}\`,
    \`By Package Manager: \${Object.entries(summary.byPackageManager ?? {}).map(([manager, count]) => \`\${manager}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const scripts = Array.isArray(entry.scripts) ? entry.scripts.join(",") : "none";
      const markers = Array.isArray(entry.markers) ? entry.markers.join(",") : "none";
      const governance = entry.governance ?? {};
      return \`[\${entry.kind ?? "workspace"}] \${entry.name ?? entry.id ?? "unknown"} path=\${entry.path ?? "unknown"} packageManager=\${entry.packageManager ?? "unknown"} scripts=\${scripts} markers=\${markers} readContent=\${Boolean(governance.canReadFileContent)} mutate=\${Boolean(governance.canMutate)} execute=\${Boolean(governance.canExecute)}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceMigrationMap(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  workspaceMigrationRegistry.textContent = data?.registry ?? "openclaw-source-migration-map-v0";
  workspaceMigrationTotal.textContent = String(summary.total ?? data?.count ?? 0);
  workspaceMigrationCapabilities.textContent = String(summary.byTargetArea?.capability_registry ?? 0);
  workspaceMigrationHigh.textContent = String(summary.byPriority?.high ?? 0);
  workspaceMigrationMode.textContent = data?.mode ?? "read-only";

  workspaceMigrationJson.textContent = [
    "Read-only migration map: candidates are visible, source file contents stay hidden.",
    "Candidate status is not an import, execution, or mutation grant.",
    \`Registry: \${data?.registry ?? "openclaw-source-migration-map-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "workspace-detect-v0"}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Workspaces: \${summary.workspaces ?? 0}\`,
    \`By Target: \${Object.entries(summary.byTargetArea ?? {}).map(([target, count]) => \`\${target}=\${count}\`).join(", ") || "none"}\`,
    \`By Migration Kind: \${Object.entries(summary.byMigrationKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`By Priority: \${Object.entries(summary.byPriority ?? {}).map(([priority, count]) => \`\${priority}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const governance = entry.governance ?? {};
      return \`[\${entry.priority ?? "unknown"}/\${entry.risk ?? "unknown"}] \${entry.capability ?? "capability"} from=\${entry.sourceDomain ?? "unknown"} target=\${entry.targetArea ?? "unknown"} kind=\${entry.migrationKind ?? "unknown"} status=\${entry.readiness ?? "unknown"} readContent=\${Boolean(governance.canReadFileContent)} mutate=\${Boolean(governance.canMutate)} execute=\${Boolean(governance.canExecute)} review=\${Boolean(governance.requiresHumanReview)}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceMigrationPlan(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const backlog = Array.isArray(data?.backlog) ? data.backlog : [];
  workspaceMigrationPlanRegistry.textContent = data?.registry ?? "openclaw-source-migration-plan-v0";
  workspaceMigrationPlanTotal.textContent = String(summary.total ?? data?.count ?? 0);
  workspaceMigrationPlanCandidates.textContent = String(summary.candidateCount ?? data?.candidateCount ?? 0);
  workspaceMigrationPlanBacklog.textContent = String(summary.backlog ?? backlog.length);
  workspaceMigrationPlanMode.textContent = data?.mode ?? "plan-only";

  workspaceMigrationPlanJson.textContent = [
    "Plan-only migration draft: no task, approval, import, execution, or source read is created.",
    "First wave is a review order, not permission to absorb code.",
    \`Registry: \${data?.registry ?? "openclaw-source-migration-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-source-migration-map-v0"}\`,
    \`First Wave: \${summary.total ?? data?.count ?? 0}\`,
    \`Candidates: \${summary.candidateCount ?? data?.candidateCount ?? 0}\`,
    \`Backlog: \${summary.backlog ?? backlog.length}\`,
    \`By Target: \${Object.entries(summary.byTargetArea ?? {}).map(([target, count]) => \`\${target}=\${count}\`).join(", ") || "none"}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`By Priority: \${Object.entries(summary.byPriority ?? {}).map(([priority, count]) => \`\${priority}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const governance = entry.governance ?? {};
      const blockers = Array.isArray(entry.blockers) ? entry.blockers.join("; ") : "none";
      return \`#\${entry.sequence ?? "?"} [\${entry.priority ?? "unknown"}/\${entry.risk ?? "unknown"}] \${entry.capability ?? "capability"} target=\${entry.targetArea ?? "unknown"} kind=\${entry.migrationKind ?? "unknown"} status=\${entry.status ?? "unknown"} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} execute=\${Boolean(governance.canExecute)} blockers=\${blockers}\`;
    }),
    "",
    \`Backlog: \${backlog.map((entry) => \`\${entry.capability}(\${entry.priority}/\${entry.risk})\`).join(", ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSdkContractReview(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  pluginSdkReviewRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-contract-review-v0";
  pluginSdkReviewTotal.textContent = String(summary.total ?? data?.count ?? 0);
  pluginSdkReviewManifest.textContent = String(summary.withManifest ?? 0);
  pluginSdkReviewTypes.textContent = String(summary.withTypes ?? 0);
  pluginSdkReviewExports.textContent = String(summary.withExports ?? 0);
  pluginSdkReviewMode.textContent = data?.mode ?? "read-only";

  pluginSdkReviewJson.textContent = [
    "Read-only contract review: manifest shape and directory markers only.",
    "Source contents, README text, script bodies, dependency versions, tasks, approvals, and executions stay hidden.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-contract-review-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-source-migration-plan-v0"}\`,
    \`Reviews: \${summary.total ?? data?.count ?? 0}\`,
    \`With Manifest: \${summary.withManifest ?? 0}\`,
    \`With Types: \${summary.withTypes ?? 0}\`,
    \`With Exports: \${summary.withExports ?? 0}\`,
    \`By Verdict: \${Object.entries(summary.byVerdict ?? {}).map(([verdict, count]) => \`\${verdict}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const manifest = entry.packageManifest ?? {};
      const structure = entry.structure ?? {};
      const governance = entry.governance ?? {};
      const surfaces = Array.isArray(entry.contractSurfaces) ? entry.contractSurfaces.join(",") : "none";
      const blockers = Array.isArray(entry.blockers) ? entry.blockers.join("; ") : "none";
      return \`[\${entry.verdict ?? "unknown"}] \${manifest.name ?? "unknown"} surfaces=\${surfaces} markers=\${(structure.markers ?? []).join(",") || "none"} scripts=\${(manifest.scriptNames ?? []).join(",") || "none"} readSource=\${Boolean(governance.canReadSourceFileContent)} mutate=\${Boolean(governance.canMutate)} execute=\${Boolean(governance.canExecute)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} blockers=\${blockers}\`;
    }),
  ].join("\\n");
}

function renderPluginSdkSourceReviewScope(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  pluginSdkSourceScopeRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-source-review-scope-v0";
  pluginSdkSourceScopeTotal.textContent = String(summary.totalFiles ?? files.length);
  pluginSdkSourceScopeContent.textContent = summary.canReadSourceFileContent ? "allowed" : "blocked";
  pluginSdkSourceScopeApproval.textContent = summary.requiresApprovalBeforeContentRead ? "required" : "not required";
  pluginSdkSourceScopeMode.textContent = data?.mode ?? "scope-plan-only";

  pluginSdkSourceScopeJson.textContent = [
    "Source review scope: file metadata only. Source contents are not read, displayed, imported, or executed.",
    "This is the checklist for a future explicit content-read approval, not the content review itself.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-source-review-scope-v0"}\`,
    \`Mode: \${data?.mode ?? "scope-plan-only"}\`,
    \`Package: \${data?.package?.name ?? "unknown"}\`,
    \`Files: \${summary.totalFiles ?? files.length}\`,
    \`By Kind: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    ...files.slice(0, 16).map((file) => \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} size=\${file.sizeBytes ?? "unknown"} contentRead=\${Boolean(file.contentRead)}\`),
  ].join("\\n");
}

function renderPluginSdkSourceContentReview(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  pluginSdkSourceContentRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-source-content-review-v0";
  pluginSdkSourceContentRead.textContent = String(summary.contentRead ?? 0);
  pluginSdkSourceContentExports.textContent = String(summary.exportStatements ?? 0);
  pluginSdkSourceContentRaw.textContent = summary.exposesSourceFileContent ? "exposed" : "hidden";
  pluginSdkSourceContentMode.textContent = data?.mode ?? "content-review-derived-signals";

  pluginSdkSourceContentJson.textContent = [
    "Source content review: scoped files are read, but only derived signals are shown.",
    "Raw source text, README contents, script bodies, dependency versions, imports, execution, and runtime activation remain blocked.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-source-content-review-v0"}\`,
    \`Mode: \${data?.mode ?? "content-review-derived-signals"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-plugin-sdk-source-review-scope-v0"}\`,
    \`Files: total=\${summary.totalFiles ?? files.length} read=\${summary.contentRead ?? 0} skipped=\${summary.skipped ?? 0}\`,
    \`Signals: exports=\${summary.exportStatements ?? 0} imports=\${summary.importStatements ?? 0} interfaces=\${summary.interfaceDeclarations ?? 0} types=\${summary.typeDeclarations ?? 0} functions=\${summary.functionDeclarations ?? 0} classes=\${summary.classDeclarations ?? 0}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...findings.map((finding) => \`[\${finding.status ?? "unknown"}] \${finding.id ?? "finding"} :: \${finding.summary ?? "no summary"}\`),
    "",
    ...files.slice(0, 16).map((file) => {
      const signals = file.signals ?? {};
      return \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} read=\${Boolean(file.contentRead)} exposed=\${Boolean(file.contentExposed)} exports=\${signals.exportStatements ?? 0} interfaces=\${signals.interfaceDeclarations ?? 0} types=\${signals.typeDeclarations ?? 0} recommendation=\${file.recommendedAbsorption ?? "none"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSdkNativeContractTests(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const tests = Array.isArray(data?.tests) ? data.tests : [];
  const mappings = Array.isArray(data?.mappings) ? data.mappings : [];
  const capabilities = Array.isArray(data?.contract?.capabilities) ? data.contract.capabilities : [];
  const sourceSummary = data?.enhancedSource?.summary ?? {};
  pluginSdkNativeTestsRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-native-contract-tests-v0";
  pluginSdkNativeTestsRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0}\`;
  pluginSdkNativeTestsSource.textContent = String(summary.enhancedSourceFilesRead ?? 0);
  pluginSdkNativeTestsCaps.textContent = String(summary.nativeCapabilities ?? capabilities.length);
  pluginSdkNativeTestsMode.textContent = data?.mode ?? "native-contract-tests";

  pluginSdkNativeTestsJson.textContent = [
    "Native contract tests: derived SDK source signals are checked against OpenClawOnNixOS-owned plugin/capability contracts.",
    "This is a test mapping layer, not runtime activation: old OpenClaw modules are not imported or executed.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-native-contract-tests-v0"}\`,
    \`Mode: \${data?.mode ?? "native-contract-tests"}\`,
    \`Source Registries: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Enhanced Source Root: \${data?.enhancedSource?.root ?? "unknown"}\`,
    \`Tests: required=\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0} failed=\${summary.failedRequired ?? 0}\`,
    \`Signals: packageFiles=\${summary.sourcePackageFilesRead ?? 0} enhancedFiles=\${summary.enhancedSourceFilesRead ?? 0} exports=\${summary.exportStatements ?? 0} interfaces=\${summary.interfaceDeclarations ?? 0} types=\${summary.typeDeclarations ?? 0} functions=\${summary.functionDeclarations ?? 0} vocabFiles=\${summary.capabilityVocabularyFiles ?? sourceSummary.capabilityVocabularyFiles ?? 0}\`,
    \`Contract: nativeCapabilities=\${summary.nativeCapabilities ?? capabilities.length} implementationReady=\${Boolean(summary.nativeContractReadyForImplementation)}\`,
    \`Governance: exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...tests.map((test) => \`[\${test.status ?? "unknown"}] \${test.id ?? "test"} :: \${test.evidence ?? "no evidence"}\`),
    "",
    ...mappings.map((mapping) => \`\${mapping.sourceSignal ?? "source"} -> \${(mapping.nativeContractFields ?? []).join(", ")} [\${mapping.status ?? "unknown"}]\`),
    "",
    ...capabilities.map((capability) => \`\${capability.id ?? "unknown"} kind=\${capability.kind ?? "unknown"} risk=\${capability.risk ?? "unknown"} domains=\${(capability.domains ?? []).join(",")} approval=\${Boolean(capability.approval?.required)} runtimeOwner=\${capability.runtimeOwner ?? "unknown"}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativeSdkContractImplementation(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const slots = Array.isArray(data?.implementationSlots) ? data.implementationSlots : [];
  const capabilities = Array.isArray(data?.contract?.capabilities) ? data.contract.capabilities : [];
  nativeSdkImplementationRegistry.textContent = data?.registry ?? "openclaw-native-plugin-sdk-contract-implementation-v0";
  nativeSdkImplementationSlots.textContent = \`\${summary.implementedSlots ?? 0}/\${summary.totalSlots ?? slots.length}\`;
  nativeSdkImplementationReadOnly.textContent = String(summary.readOnlySlots ?? 0);
  nativeSdkImplementationExecutable.textContent = String(summary.executableSlots ?? 0);
  nativeSdkImplementationMode.textContent = data?.mode ?? "native-sdk-contract-implementation";

  nativeSdkImplementationJson.textContent = [
    "Native SDK contract implementation: stable OpenClawOnNixOS-owned absorption slots for enhanced OpenClaw tools, prompts, manifests, and governed execution.",
    "Read-only slots are contract-ready for adapter implementation; executable slots remain approval-gated and inactive.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-sdk-contract-implementation-v0"}\`,
    \`Mode: \${data?.mode ?? "native-sdk-contract-implementation"}\`,
    \`Runtime Owner: \${data?.runtimeOwner ?? "unknown"}\`,
    \`Source Registries: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Slots: implemented=\${summary.implementedSlots ?? 0}/\${summary.totalSlots ?? slots.length} missing=\${summary.missingSlots ?? 0}\`,
    \`Capabilities: native=\${summary.nativeCapabilities ?? capabilities.length} readOnly=\${summary.readOnlySlots ?? 0} executable=\${summary.executableSlots ?? 0}\`,
    \`Ready For First Read-only Absorption: \${Boolean(summary.readyForFirstReadOnlyAbsorption)}\`,
    \`Governance: externalRuntime=\${Boolean(governance.externalRuntimeDependencyAllowed)} sourceImported=\${Boolean(governance.sourceContentImported)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...slots.map((slot) => \`\${slot.id ?? "unknown"} status=\${slot.status ?? "unknown"} kind=\${slot.kind ?? "unknown"} risk=\${slot.risk ?? "unknown"} approval=\${Boolean(slot.approvalRequired)} adapter=\${slot.adapterState ?? "unknown"} owner=\${slot.runtimeOwner ?? "unknown"}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderOpenClawToolCatalog(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const tools = Array.isArray(data?.catalog?.tools) ? data.catalog.tools : [];
  const docs = Array.isArray(data?.catalog?.documentation) ? data.catalog.documentation : [];
  const categories = Array.isArray(data?.catalog?.categories) ? data.catalog.categories : [];
  const mappings = Array.isArray(data?.catalog?.nativeSlotMapping) ? data.catalog.nativeSlotMapping : [];
  openclawToolCatalogRegistry.textContent = data?.registry ?? "openclaw-tool-catalog-v0";
  openclawToolCatalogTools.textContent = String(summary.toolImplementationFiles ?? tools.length);
  openclawToolCatalogDocs.textContent = String(summary.toolDocumentationFiles ?? docs.length);
  openclawToolCatalogCategories.textContent = String(summary.categoryCount ?? categories.length);
  openclawToolCatalogMode.textContent = data?.mode ?? "read-only-native-absorption";

  openclawToolCatalogJson.textContent = [
    "First real read-only absorption: enhanced OpenClaw tool files and docs are visible as metadata catalog entries.",
    "Source text, documentation bodies, old module imports, old tool execution, runtime activation, tasks, and approvals remain blocked.",
    \`Registry: \${data?.registry ?? "openclaw-tool-catalog-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only-native-absorption"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.tool_catalog"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Roots: tools=\${data?.roots?.tools ?? "unknown"} docs=\${data?.roots?.docs ?? "unknown"} sdk=\${data?.roots?.pluginSdkVocabulary ?? "unknown"}\`,
    \`Counts: sourceFiles=\${summary.sourceToolFiles ?? 0} implementations=\${summary.toolImplementationFiles ?? tools.length} tests=\${summary.toolTestFiles ?? 0} docs=\${summary.toolDocumentationFiles ?? docs.length} documented=\${summary.documentedImplementations ?? 0} sdkVocabulary=\${summary.pluginSdkVocabularyFiles ?? 0}\`,
    \`Categories: \${Object.entries(summary.byCategory ?? {}).map(([category, count]) => \`\${category}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: metadata=\${Boolean(governance.canReadMetadata)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposeDocs=\${Boolean(governance.exposesDocumentationContent)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...categories.map((entry) => \`\${entry.category ?? "unknown"} count=\${entry.count ?? 0} tools=\${entry.implementationFiles ?? 0} docs=\${entry.documentationFiles ?? 0} slot=\${entry.recommendedNativeSlot ?? "none"}\`),
    "",
    ...mappings.map((mapping) => \`\${mapping.capabilityId ?? "capability"} status=\${mapping.status ?? "unknown"} roots=\${(mapping.sourceRoots ?? []).join(",")} executeSource=\${Boolean(mapping.canExecuteSourceTool)} owner=\${mapping.runtimeOwner ?? "unknown"}\`),
    "",
    ...tools.slice(0, 20).map((tool) => \`\${tool.relativePath ?? "unknown"} category=\${tool.category ?? "unknown"} documented=\${Boolean(tool.documented)} size=\${tool.sizeBytes ?? "n/a"} slot=\${tool.nativeSlot ?? "none"} contentRead=\${Boolean(tool.contentRead)}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginManifestMap(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const manifests = Array.isArray(data?.manifests) ? data.manifests : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  pluginManifestMapRegistry.textContent = data?.registry ?? "openclaw-plugin-manifest-map-v0";
  pluginManifestMapManifests.textContent = String(summary.manifestCount ?? manifests.length);
  pluginManifestMapCategories.textContent = String(summary.categoryCount ?? categories.length);
  pluginManifestMapAuth.textContent = String(summary.authReferenceCount ?? 0);
  pluginManifestMapMode.textContent = data?.mode ?? "read-only-plugin-manifest-absorption";

  pluginManifestMapJson.textContent = [
    "Read-only absorption of enhanced OpenClaw extension manifests as native plugin metadata candidates.",
    "Manifest bodies, auth env var names, endpoint hosts, config schema bodies, module imports, plugin execution, runtime activation, tasks, and approvals remain blocked.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-manifest-map-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only-plugin-manifest-absorption"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.plugin_manifest_map"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Roots: extensions=\${data?.roots?.extensions ?? "extensions"}\`,
    \`Counts: manifests=\${summary.manifestCount ?? manifests.length} categories=\${summary.categoryCount ?? categories.length} enabled=\${summary.enabledByDefaultCount ?? 0} providers=\${summary.providerCount ?? 0} endpoints=\${summary.providerEndpointCount ?? 0} channels=\${summary.channelCount ?? 0} tools=\${summary.toolContractCount ?? 0} authRefs=\${summary.authReferenceCount ?? 0} schemas=\${summary.configSchemaCount ?? 0}\`,
    \`Governance: metadata=\${Boolean(governance.canReadManifestMetadata)} exposeBodies=\${Boolean(governance.exposesManifestBodies)} exposeAuthNames=\${Boolean(governance.exposesAuthEnvVarNames)} exposeSchemas=\${Boolean(governance.exposesConfigSchemaBodies)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...categories.map((entry) => \`\${entry.category ?? "unknown"} count=\${entry.count ?? 0}\`),
    "",
    ...manifests.slice(0, 30).map((manifest) => \`\${manifest.relativePath ?? "unknown"} id=\${manifest.id ?? "unknown"} category=\${manifest.category ?? "unknown"} contracts=\${(manifest.contractKeys ?? []).join(",") || "none"} providers=\${manifest.providerCount ?? 0} endpoints=\${manifest.providerEndpointCount ?? 0} channels=\${manifest.channelCount ?? 0} authRefs=\${(manifest.providerAuthEnvVarCount ?? 0) + (manifest.channelEnvVarCount ?? 0) + (manifest.syntheticAuthRefCount ?? 0)} schemaProps=\${manifest.configSchemaPropertyCount ?? 0} contentExposed=\${Boolean(manifest.contentExposed)}\`),
  ].join("\\n");
}

function renderPluginCapabilityPlan(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  pluginCapabilityPlanRegistry.textContent = data?.registry ?? "openclaw-plugin-capability-plan-v0";
  pluginCapabilityPlanCandidates.textContent = String(summary.candidateCount ?? candidates.length);
  pluginCapabilityPlanBlocked.textContent = String(summary.blockedCandidates ?? 0);
  pluginCapabilityPlanApproval.textContent = String(summary.requiresApproval ?? 0);
  pluginCapabilityPlanRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginCapabilityPlanJson.textContent = [
    "Manifest-derived plugin capability plan: enhanced OpenClaw extension manifests become native capability candidates and governance gates.",
    "This remains plan-only: no plugin modules are imported, no plugin code is executed, no runtime is activated, and no task or approval is created.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-capability-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "manifest-derived-plan-only"}\`,
    \`Capability: \${data?.capability?.id ?? "plan.openclaw.plugin_capability"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Counts: candidates=\${summary.candidateCount ?? candidates.length} blocked=\${summary.blockedCandidates ?? 0} metadataOnly=\${summary.metadataOnlyCandidates ?? 0} approval=\${summary.requiresApproval ?? 0} runtimeAdapter=\${summary.requiresRuntimeAdapter ?? 0}\`,
    \`Risks: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`Kinds: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: metadata=\${Boolean(governance.canReadManifestMetadata)} exposeBodies=\${Boolean(governance.exposesManifestBodies)} exposeAuthNames=\${Boolean(governance.exposesAuthEnvVarNames)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...candidates.slice(0, 30).map((candidate) => \`\${candidate.id ?? "candidate"} manifest=\${candidate.manifestId ?? "unknown"} kind=\${candidate.proposedCapability?.kind ?? "unknown"} risk=\${candidate.proposedCapability?.risk ?? "unknown"} approval=\${Boolean(candidate.proposedCapability?.approvalRequired)} status=\${candidate.status ?? "unknown"} gates=\${(candidate.gates ?? []).map((gate) => \`\${gate.id}:\${gate.status}\`).join(",")}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginCandidateContractTests(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const contracts = Array.isArray(data?.adapterContracts) ? data.adapterContracts : [];
  const tests = Array.isArray(data?.tests) ? data.tests : [];
  pluginCandidateContractTestsRegistry.textContent = data?.registry ?? "openclaw-plugin-candidate-contract-tests-v0";
  pluginCandidateContractTestsCategory.textContent = summary.selectedCategory ?? data?.filter?.category ?? "search_and_web";
  pluginCandidateContractTestsRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0}\`;
  pluginCandidateContractTestsContracts.textContent = String(summary.adapterContractCount ?? contracts.length);
  pluginCandidateContractTestsRuntime.textContent = summary.runtimeAdapterImplemented ? "implemented" : "pending";

  pluginCandidateContractTestsJson.textContent = [
    "Candidate-native adapter contract tests: the selected enhanced OpenClaw plugin category is now checked against native OpenClawOnNixOS adapter expectations.",
    "This is still read-only: it tests the contract boundary without importing old modules, executing plugin code, activating runtime, creating tasks, or creating approvals.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-candidate-contract-tests-v0"}\`,
    \`Mode: \${data?.mode ?? "candidate-native-adapter-contract-tests"}\`,
    \`Source Registries: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Category: \${summary.selectedCategory ?? data?.filter?.category ?? "search_and_web"}\`,
    \`Counts: candidates=\${summary.candidateCount ?? candidates.length} contracts=\${summary.adapterContractCount ?? contracts.length} tests=\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0} approval=\${summary.requiresApproval ?? 0} crossBoundary=\${summary.crossBoundaryCandidates ?? 0}\`,
    \`Governance: metadata=\${Boolean(governance.canReadManifestMetadata)} exposeBodies=\${Boolean(governance.exposesManifestBodies)} exposeAuthNames=\${Boolean(governance.exposesAuthEnvVarNames)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...contracts.slice(0, 20).map((contract) => \`\${contract.candidateId ?? "candidate"} manifest=\${contract.manifestId ?? "unknown"} capability=\${contract.proposedCapabilityId ?? "unknown"} approval=\${Boolean(contract.approvalRequired)} status=\${contract.implementationStatus ?? "unknown"} surfaces=\${(contract.expectedNativeSurfaces ?? []).join(",")}\`),
    "",
    ...tests.slice(0, 36).map((test) => \`\${test.id ?? "test"} status=\${test.status ?? "unknown"} required=\${Boolean(test.required)} evidence=\${test.evidence ?? ""}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSearchWebAdapterContract(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const adapter = data?.adapter ?? {};
  const providerContracts = Array.isArray(data?.providerContracts) ? data.providerContracts : [];
  const checks = Array.isArray(data?.contractChecks) ? data.contractChecks : [];
  pluginSearchWebContractRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-contract-v0";
  pluginSearchWebContractProviders.textContent = String(summary.providerContractCount ?? providerContracts.length);
  pluginSearchWebContractRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0}\`;
  pluginSearchWebContractNetwork.textContent = summary.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebContractRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebContractJson.textContent = [
    "Search/Web adapter contract shell: selected enhanced OpenClaw search/web providers are mapped to native OpenClawOnNixOS adapter contracts.",
    "No network access, old module import, plugin execution, runtime activation, task creation, or approval creation is available at this layer.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-contract-v0"}\`,
    \`Mode: \${data?.mode ?? "native-search-web-adapter-contract-shell"}\`,
    \`Adapter: \${adapter.id ?? "openclaw.search_web.native-adapter"} status=\${adapter.status ?? "unknown"} owner=\${adapter.runtimeOwner ?? "unknown"}\`,
    \`Sources: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Counts: providers=\${summary.providerContractCount ?? providerContracts.length} operations=\${summary.operationCount ?? 0} checks=\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0} approval=\${summary.requiresApproval ?? 0} crossBoundary=\${summary.crossBoundaryContracts ?? 0}\`,
    \`Boundaries: network=\${Boolean(summary.canUseNetwork)} import=\${Boolean(summary.canImportModule)} executePlugin=\${Boolean(summary.canExecutePluginCode)} activateRuntime=\${Boolean(summary.canActivateRuntime)} task=\${Boolean(summary.createsTask)} approval=\${Boolean(summary.createsApproval)}\`,
    \`Privacy: manifestBodies=\${Boolean(governance.exposesManifestBodies)} authNames=\${Boolean(governance.exposesAuthEnvVarNames)} endpoints=\${Boolean(governance.exposesEndpointHosts)} schemaBodies=\${Boolean(governance.exposesConfigSchemaBodies)} source=\${Boolean(governance.exposesSourceFileContent)}\`,
    "",
    ...providerContracts.slice(0, 24).map((contract) => \`\${contract.id ?? "provider"} manifest=\${contract.manifestId ?? "unknown"} capability=\${contract.proposedCapabilityId ?? "unknown"} operations=\${(contract.operations ?? []).join(",") || "none"} risk=\${contract.policy?.risk ?? "unknown"} approval=\${Boolean(contract.policy?.requiresApproval)} network=\${Boolean(contract.runtime?.canUseNetwork)} runtime=\${contract.runtime?.implementationState ?? "unknown"}\`),
    "",
    ...checks.slice(0, 32).map((check) => \`\${check.id ?? "check"} status=\${check.status ?? "unknown"} required=\${Boolean(check.required)} evidence=\${check.evidence ?? ""}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSearchWebRuntimePreflight(data) {
  const envelope = data?.executionEnvelope ?? {};
  const constraints = envelope.constraints ?? {};
  const provider = data?.provider ?? {};
  const governance = data?.governance ?? {};
  pluginSearchWebPreflightRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-preflight-v0";
  pluginSearchWebPreflightEnvelope.textContent = envelope.envelopeVersion ?? "missing";
  pluginSearchWebPreflightApproval.textContent = envelope.approval?.required ? "required" : "not-required";
  pluginSearchWebPreflightNetwork.textContent = constraints.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebPreflightRuntime.textContent = constraints.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebPreflightJson.textContent = [
    "Search/Web runtime preflight: builds a governed provider execution envelope before any network or provider runtime can be activated.",
    "This layer is preflight-only: it creates no task, approval, network call, capability invocation, or plugin/provider execution.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-preflight-v0"}\`,
    \`Mode: \${data?.mode ?? "preflight-only"}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "missing"} state=\${envelope.state ?? "unknown"}\`,
    \`Provider: \${provider.id ?? "unknown"} manifest=\${provider.manifestId ?? "unknown"} operations=\${(provider.operations ?? []).join(",") || "none"}\`,
    \`Query: present=\${Boolean(data?.query?.present)} length=\${data?.query?.length ?? 0} digest=\${data?.query?.digest ?? "none"} contentExposed=\${Boolean(data?.query?.contentExposed)}\`,
    \`Policy: decision=\${envelope.policyDecision?.decision ?? "unknown"} domain=\${envelope.policyDecision?.domain ?? "unknown"} risk=\${envelope.policyDecision?.risk ?? "unknown"} approved=\${Boolean(envelope.policyDecision?.approved)}\`,
    \`Approval: required=\${Boolean(envelope.approval?.required)} collected=\${Boolean(envelope.approval?.collected)}\`,
    \`Audit: required=\${Boolean(envelope.audit?.required)} ledger=\${envelope.audit?.ledger ?? "unknown"}\`,
    \`Constraints: network=\${Boolean(constraints.canUseNetwork)} import=\${Boolean(constraints.canImportModule)} executePlugin=\${Boolean(constraints.canExecutePluginCode)} activateRuntime=\${Boolean(constraints.canActivateRuntime)} task=\${Boolean(constraints.canCreateTask)} approval=\${Boolean(constraints.canCreateApproval)}\`,
    \`Privacy: query=\${Boolean(governance.exposesQueryContent)} manifestBodies=\${Boolean(governance.exposesManifestBodies)} authNames=\${Boolean(governance.exposesAuthEnvVarNames)} endpoints=\${Boolean(governance.exposesEndpointHosts)} source=\${Boolean(governance.exposesSourceFileContent)}\`,
  ].join("\\n");
}

function renderPluginSearchWebRuntimeActivationPlan(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  const envelope = data?.executionEnvelope ?? {};
  pluginSearchWebActivationRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0";
  pluginSearchWebActivationStatus.textContent = data?.status ?? "unknown";
  pluginSearchWebActivationRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`;
  pluginSearchWebActivationNetwork.textContent = summary.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebActivationRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebActivationJson.textContent = [
    "Search/Web runtime activation plan: records the remaining gates before native provider/network execution can be enabled.",
    "This plan creates no task by itself; the activation task button materializes a separate approval-gated shell that still defers network/provider runtime.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "activation-plan-only"}\`,
    \`Status: \${data?.status ?? "unknown"} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Gates: \${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "unknown"} state=\${envelope.state ?? "unknown"}\`,
    \`Provider: \${data?.provider?.id ?? "unknown"} manifest=\${data?.provider?.manifestId ?? "unknown"} operation=\${envelope.operation ?? "unknown"}\`,
    \`Network Activation: \${summary.canUseNetwork ? "enabled" : "disabled"} importModule=\${Boolean(summary.canImportModule)} executePlugin=\${Boolean(summary.canExecutePluginCode)} activateRuntime=\${Boolean(summary.canActivateRuntime)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} query=\${Boolean(governance.exposesQueryContent)} endpoints=\${Boolean(governance.exposesEndpointHosts)} authNames=\${Boolean(governance.exposesAuthEnvVarNames)}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSearchWebProviderRuntimeSandbox(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const sandbox = data?.sandbox ?? {};
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  pluginSearchWebSandboxRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0";
  pluginSearchWebSandboxStatus.textContent = data?.status ?? "unknown";
  pluginSearchWebSandboxRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0}\`;
  pluginSearchWebSandboxNetwork.textContent = summary.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebSandboxRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebSandboxJson.textContent = [
    "Search/Web provider runtime sandbox contract: defines the native provider boundary before any live network runtime is enabled.",
    "This is contract-only: it creates no task, approval, network call, capability invocation, provider import, or provider execution.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0"}\`,
    \`Mode: \${data?.mode ?? "provider-runtime-sandbox-contract"}\`,
    \`Status: \${data?.status ?? "unknown"} sandboxApproved=\${Boolean(summary.sandboxApproved)} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Checks: \${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Provider: \${data?.provider?.id ?? "unknown"} manifest=\${data?.provider?.manifestId ?? "unknown"} operations=\${(data?.provider?.operations ?? []).join(",") || "none"}\`,
    \`Sandbox: \${sandbox.contractVersion ?? "unknown"} state=\${sandbox.state ?? "unknown"} approvalRequired=\${Boolean(sandbox.approval?.required)} collected=\${Boolean(sandbox.approval?.collected)}\`,
    \`Isolation: process=\${Boolean(sandbox.isolation?.processIsolationRequired)} oldModuleImport=\${Boolean(sandbox.isolation?.oldOpenClawModuleImportAllowed)} secretsMounted=\${Boolean(sandbox.isolation?.secretsMounted)}\`,
    \`Egress: default=\${sandbox.egress?.networkEgressDefault ?? "unknown"} network=\${Boolean(sandbox.egress?.canUseNetwork)} allowlist=\${(sandbox.egress?.allowlist ?? []).length} dns=\${Boolean(sandbox.egress?.dnsResolutionAllowed)}\`,
    \`Execution: import=\${Boolean(sandbox.execution?.canImportModule)} providerCode=\${Boolean(sandbox.execution?.canExecuteProviderCode)} activateRuntime=\${Boolean(sandbox.execution?.canActivateRuntime)} mutate=\${Boolean(sandbox.execution?.canMutate)}\`,
    \`Privacy: query=\${Boolean(sandbox.privacy?.queryContentExposed)} manifestBodies=\${Boolean(sandbox.privacy?.manifestBodiesExposed)} authNames=\${Boolean(sandbox.privacy?.authEnvVarNamesExposed)} endpoints=\${Boolean(sandbox.privacy?.endpointHostsExposed)} source=\${Boolean(sandbox.privacy?.sourceFileContentExposed)}\`,
    \`Governance: task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} network=\${Boolean(governance.canUseNetwork)} import=\${Boolean(governance.canImportModule)} execute=\${Boolean(governance.canExecutePluginCode)} runtime=\${Boolean(governance.canActivateRuntime)}\`,
    "",
    ...checks.map((check) => {
      const required = check.required ? "required" : "optional";
      return \`[\${check.status ?? "unknown"}/\${required}] \${check.id ?? "check"} :: \${check.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderToolCatalogAdapter(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const tools = Array.isArray(data?.tools) ? data.tools : [];
  const docs = Array.isArray(data?.documentation) ? data.documentation : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  toolCatalogAdapterRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  toolCatalogAdapterMatches.textContent = String(summary.matchedTools ?? tools.length);
  toolCatalogAdapterCategories.textContent = String(summary.categoryCount ?? categories.length);
  toolCatalogAdapterExecution.textContent = governance.canExecuteToolCode ? "enabled" : "blocked";
  toolCatalogAdapterMode.textContent = data?.mode ?? "tool-catalog-profile-only";

  toolCatalogAdapterJson.textContent = [
    "Native adapter invocation surface for the absorbed enhanced OpenClaw tool catalog.",
    "This adapter can be invoked through capability history; it still does not import, execute, mutate, activate runtime, or expose source/doc bodies.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "tool-catalog-profile-only"}\`,
    \`Adapter Status: \${data?.adapterStatus ?? "unknown"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-tool-catalog-v0"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.tool_catalog"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Filter: category=\${data?.filter?.category ?? "none"} query=\${data?.filter?.query ?? "none"} limit=\${data?.filter?.limit ?? "n/a"}\`,
    \`Counts: matched=\${summary.matchedTools ?? tools.length}/\${summary.totalTools ?? 0} docs=\${summary.matchedDocumentation ?? docs.length}/\${summary.totalDocumentation ?? 0} categories=\${summary.categoryCount ?? categories.length} filterApplied=\${Boolean(summary.filterApplied)}\`,
    \`Governance: metadata=\${Boolean(governance.canReadMetadata)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposeDocs=\${Boolean(governance.exposesDocumentationContent)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...tools.slice(0, 16).map((tool) => \`\${tool.relativePath ?? "unknown"} category=\${tool.category ?? "unknown"} documented=\${Boolean(tool.documented)} slot=\${tool.nativeSlot ?? "none"} contentRead=\${Boolean(tool.contentRead)}\`),
  ].join("\\n");
}

function renderSemanticIndex(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  semanticIndexRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  semanticIndexFiles.textContent = String(summary.totalFiles ?? files.length);
  semanticIndexExports.textContent = String(summary.exportStatements ?? 0);
  semanticIndexSource.textContent = governance.exposesSourceFileContent ? "exposed" : "hidden";
  semanticIndexMode.textContent = data?.mode ?? "workspace-semantic-index-only";

  semanticIndexJson.textContent = [
    "Native read-only semantic tool: derived signals from enhanced OpenClaw files, with raw source and docs hidden.",
    "This reads bounded content to count semantics, but does not expose text, import modules, execute tools, mutate files, or activate runtime.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "workspace-semantic-index-only"}\`,
    \`Adapter Status: \${data?.adapterStatus ?? "unknown"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.workspace_semantic_index"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Scope: \${data?.scope?.id ?? "tools"} root=\${data?.scope?.relativeRoot ?? "unknown"} query=\${data?.scope?.query ?? "none"} limit=\${data?.scope?.limit ?? "n/a"}\`,
    \`Files: total=\${summary.totalFiles ?? files.length} read=\${summary.contentRead ?? 0} skipped=\${summary.skipped ?? 0} lines=\${summary.lineCount ?? 0}\`,
    \`Signals: exports=\${summary.exportStatements ?? 0} imports=\${summary.importStatements ?? 0} interfaces=\${summary.interfaceDeclarations ?? 0} types=\${summary.typeDeclarations ?? 0} functions=\${summary.functionDeclarations ?? 0} classes=\${summary.classDeclarations ?? 0} semanticFiles=\${summary.semanticVocabularyFiles ?? 0}\`,
    \`By Kind: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`By Category: \${Object.entries(summary.byCategory ?? {}).map(([category, count]) => \`\${category}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposeDocs=\${Boolean(governance.exposesDocumentationContent)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...files.slice(0, 16).map((file) => {
      const signals = file.signals ?? {};
      return \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} category=\${file.category ?? "unknown"} read=\${Boolean(file.contentRead)} exposed=\${Boolean(file.contentExposed)} exports=\${signals.exportStatements ?? 0} functions=\${signals.functionDeclarations ?? 0} terms=\${signals.semanticTermCount ?? 0}\`;
    }),
  ].join("\\n");
}

function renderSymbolLookup(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  symbolLookupRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  symbolLookupMatches.textContent = String(summary.matchedSymbols ?? matches.length);
  symbolLookupFiles.textContent = String(summary.filesScanned ?? 0);
  symbolLookupExecution.textContent = governance.canExecuteQuery ? "query-only" : "blocked";
  symbolLookupMode.textContent = data?.mode ?? "workspace-symbol-lookup-executable-read-only";

  symbolLookupJson.textContent = [
    "Native governed executable adapter: bounded read-only symbol lookup over enhanced OpenClaw files.",
    "This executes a local query and returns declaration symbols only; no old module imports, tool execution, function bodies, mutations, tasks, or approvals.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "workspace-symbol-lookup-executable-read-only"}\`,
    \`Adapter Status: \${data?.adapterStatus ?? "unknown"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.workspace_symbol_lookup"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Query: text=\${data?.query?.text ?? "tool"} scope=\${data?.query?.scope ?? "tools"} root=\${data?.query?.relativeRoot ?? "unknown"} limit=\${data?.query?.limit ?? "n/a"}\`,
    \`Counts: matches=\${summary.matchedSymbols ?? matches.length} files=\${summary.filesScanned ?? 0} declarations=\${summary.declarationsScanned ?? 0} contentRead=\${summary.contentRead ?? 0}\`,
    \`Governance: executeQuery=\${Boolean(governance.canExecuteQuery)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposePreview=\${Boolean(governance.exposesDeclarationPreview)} exposeBodies=\${Boolean(governance.exposesFunctionBodies)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...matches.slice(0, 16).map((match) => \`\${match.relativePath ?? "unknown"}:\${match.lineNumber ?? "?"} \${match.declarationKind ?? "symbol"} \${match.symbolName ?? "unknown"} exported=\${Boolean(match.exported)} preview=\${match.declarationPreview ?? ""}\`),
  ].join("\\n");
}

function renderEditTargetSelection(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const selectedTarget = data?.selectedTarget ?? null;
  editTargetSelectionRegistry.textContent = data?.registry ?? "openclaw-native-workspace-edit-target-selection-v0";
  editTargetSelectionCandidates.textContent = String(summary.candidateCount ?? candidates.length);
  editTargetSelectionSelected.textContent = selectedTarget?.relativePath ?? "none";
  editTargetSelectionSource.textContent = governance.exposesSourceFileContent ? "exposed" : "hidden";
  editTargetSelectionMode.textContent = data?.mode ?? "source-derived-bounded-target-selection";

  editTargetSelectionJson.textContent = [
    "Native source-derived edit target selection: bounded real OpenClaw workspace target metadata for later approval-gated patch proposals.",
    "This selects file paths from derived metadata only; source bodies remain hidden, no legacy modules are imported, and no task or mutation is created.",
    "Patch bridge flag: selectTargetFromSource=true",
    \`Registry: \${data?.registry ?? "openclaw-native-workspace-edit-target-selection-v0"}\`,
    \`Mode: \${data?.mode ?? "source-derived-bounded-target-selection"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.workspace_edit_target_select"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Query: text=\${data?.query?.text ?? "edit"} scope=\${data?.query?.scope ?? "tools"} root=\${data?.query?.relativeRoot ?? "unknown"} limit=\${data?.query?.limit ?? "n/a"}\`,
    \`Selected: \${selectedTarget?.relativePath ?? "none"} score=\${selectedTarget?.score ?? 0} kind=\${selectedTarget?.kind ?? "unknown"} symbol=\${selectedTarget?.primarySymbol?.symbolName ?? "none"} eligible=\${Boolean(selectedTarget?.eligibleForPatchProposal)}\`,
    \`Counts: candidates=\${summary.candidateCount ?? candidates.length} semanticFiles=\${summary.semanticFilesMatched ?? 0} symbols=\${summary.symbolMatches ?? 0} toolCatalog=\${summary.toolCatalogMatches ?? 0} canFeedPatch=\${Boolean(summary.canFeedPatchProposal)}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposePreview=\${Boolean(governance.exposesDeclarationPreview)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...candidates.slice(0, 12).map((candidate) => \`\${candidate.relativePath ?? "unknown"} score=\${candidate.score ?? 0} kind=\${candidate.kind ?? "unknown"} category=\${candidate.category ?? "unknown"} symbol=\${candidate.primarySymbol?.symbolName ?? "none"} exposed=\${Boolean(candidate.contentExposed)} eligible=\${Boolean(candidate.eligibleForPatchProposal)}\`),
  ].join("\\n");
}

function renderPromptSemantics(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  const expectedChecks = data?.derivedPlanSemantics?.expectedChecks ?? summary.expectedChecks ?? [];
  const editIntent = data?.derivedPlanSemantics?.editIntent ?? {};
  promptSemanticsRegistry.textContent = data?.registry ?? "openclaw-native-prompt-semantics-v0";
  promptSemanticsFiles.textContent = String(summary.totalFiles ?? files.length);
  promptSemanticsChecks.textContent = String(expectedChecks.length);
  promptSemanticsContent.textContent = governance.exposesPromptContent ? "exposed" : "hidden";
  promptSemanticsMode.textContent = data?.mode ?? "prompt-tool-semantics-profile-only";

  promptSemanticsJson.textContent = [
    "Native prompt/tool semantics profile: derives edit intent and expected checks from enhanced OpenClaw prompt/tool surfaces.",
    "Prompt and source bodies remain hidden; no legacy modules are imported, no prompt code is executed, and no mutation/task is created.",
    \`Registry: \${data?.registry ?? "openclaw-native-prompt-semantics-v0"}\`,
    \`Mode: \${data?.mode ?? "prompt-tool-semantics-profile-only"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.prompt_pack"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Intent: kind=\${editIntent.kind ?? "source_derived_workspace_edit"} planning=\${editIntent.planningStyle ?? "unknown"} safety=\${editIntent.targetSafety ?? "unknown"} verification=\${(editIntent.verificationStyle ?? []).join(",") || "none"}\`,
    \`Expected Checks: \${expectedChecks.join(",") || "none"}\`,
    \`Counts: files=\${summary.totalFiles ?? files.length} read=\${summary.contentRead ?? 0} editFiles=\${summary.editVocabularyFiles ?? 0} verificationFiles=\${summary.verificationVocabularyFiles ?? 0} governanceFiles=\${summary.governanceVocabularyFiles ?? 0}\`,
    \`Governance: readPrompt=\${Boolean(governance.canReadPromptContent)} exposePrompt=\${Boolean(governance.exposesPromptContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePrompt=\${Boolean(governance.canExecutePromptCode)} executeTool=\${Boolean(governance.canExecuteToolCode)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...files.slice(0, 12).map((file) => {
      const signals = file.signals ?? {};
      return \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} read=\${Boolean(file.contentRead)} exposed=\${Boolean(file.contentExposed)} edit=\${Boolean(signals.hasEditVocabulary)} verify=\${Boolean(signals.hasVerificationVocabulary)} governance=\${Boolean(signals.hasGovernanceVocabulary)}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceTextWriteDraft(data) {
  const target = data?.target ?? {};
  const governance = data?.draft?.governance ?? data?.governance ?? {};
  workspaceTextWriteRegistry.textContent = data?.registry ?? "openclaw-native-workspace-text-write-draft-v0";
  workspaceTextWriteCapability.textContent = data?.capability?.id ?? "act.openclaw.workspace_text_write";
  workspaceTextWriteApproval.textContent = data?.capability?.approvalRequired === false ? "not required" : "required";
  workspaceTextWriteContent.textContent = target.contentExposed === true ? "exposed" : "redacted";
  workspaceTextWriteMode.textContent = data?.mode ?? "approval-gated-draft";

  workspaceTextWriteJson.textContent = [
    "Native approval-gated mutation adapter: creates a task for bounded enhanced OpenClaw workspace text writes.",
    "Content is represented by byte count and sha256 only; execution reuses act.filesystem.write_text after approval so filesystem ledger/history remain authoritative.",
    \`Registry: \${data?.registry ?? "openclaw-native-workspace-text-write-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "approval-gated-draft"}\`,
    \`Capability: \${data?.capability?.id ?? "act.openclaw.workspace_text_write"} risk=\${data?.capability?.risk ?? "high"} approval=\${Boolean(data?.capability?.approvalRequired ?? true)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.name ?? "unknown"} \${data?.workspace?.path ?? ""}\`,
    \`Target: \${target.relativePath ?? "scratch/native-write.txt"} bytes=\${target.contentBytes ?? 0} sha256=\${target.contentSha256 ?? "unknown"} overwrite=\${Boolean(target.overwrite)} exposed=\${Boolean(target.contentExposed)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executeWithoutApproval=\${Boolean(governance.canExecuteWithoutApproval)} filesystemWrite=\${Boolean(governance.usesFilesystemWriteCapability)} exposesContent=\${Boolean(governance.exposesContent)}\`,
  ].join("\\n");
}

function renderWorkspacePatchApplyDraft(data) {
  const target = data?.target ?? {};
  const governance = data?.draft?.governance ?? data?.governance ?? {};
  const validation = data?.validation ?? {};
  const proposal = data?.proposal ?? {};
  const proposalSourceSignals = data?.proposalSourceSignals ?? null;
  const targetSelection = data?.targetSelection ?? null;
  const sourceAuthoredEdit = data?.sourceAuthoredEdit ?? null;
  const editIntent = proposal.editIntent ?? {};
  const expectedChecks = Array.isArray(proposal.expectedChecks) ? proposal.expectedChecks : [];
  const semanticPlan = proposal.semanticPlan ?? null;
  const rationaleBundle = proposal.rationaleBundle ?? null;
  const checkBundle = proposal.checkBundle ?? null;
  const riskNotes = proposal.riskNotes ?? null;
  const structuredValidationEngine = validation.structuredPatch?.engine ?? "openclaw-native-workspace-patch-validation-v0";
  const previewValidationEngine = validation.preview?.engine ?? "openclaw-native-workspace-patch-preview-validation-v0";
  const diffPreview = data?.diffPreview ?? {};
  const lines = Array.isArray(diffPreview.lines) ? diffPreview.lines : [];
  workspacePatchApplyRegistry.textContent = data?.registry ?? "openclaw-native-workspace-patch-apply-draft-v0";
  workspacePatchApplyCapability.textContent = data?.capability?.id ?? "act.openclaw.workspace_patch_apply";
  workspacePatchApplyApproval.textContent = data?.capability?.approvalRequired === false ? "not required" : "required";
  workspacePatchApplyPreview.textContent = target.diffPreviewExposed === false ? "hidden" : \`\${diffPreview.previewLineCount ?? lines.length} lines\`;
  workspacePatchApplyMode.textContent = data?.mode ?? "diff-preview-approval-gated-draft";

  workspacePatchApplyJson.textContent = [
    "Native approval-gated patch adapter: reads a bounded file, creates small single or multi-hunk diff previews, and applies only after approval.",
    "The task stores the full patched content internally for act.filesystem.write_text, but public task/Observer output uses redacted params plus hashes.",
    \`Registry: \${data?.registry ?? "openclaw-native-workspace-patch-apply-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "diff-preview-approval-gated-draft"}\`,
    \`Capability: \${data?.capability?.id ?? "act.openclaw.workspace_patch_apply"} risk=\${data?.capability?.risk ?? "high"} approval=\${Boolean(data?.capability?.approvalRequired ?? true)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.name ?? "unknown"} \${data?.workspace?.path ?? ""}\`,
    \`Target: \${target.relativePath ?? "scratch/observer-native-edit.txt"} edits=\${target.editCount ?? 1} changedAt=\${(target.changedAtLines ?? [target.changedAtLine]).filter(Boolean).join(",") || "unknown"} oldBytes=\${target.originalBytes ?? 0} newBytes=\${target.nextBytes ?? 0} oldSha256=\${target.originalSha256 ?? "unknown"} newSha256=\${target.nextSha256 ?? "unknown"} contentExposed=\${Boolean(target.contentExposed)} diffPreview=\${Boolean(target.diffPreviewExposed)}\`,
    \`Source-Authored Edit: registry=\${sourceAuthoredEdit?.registry ?? "openclaw-source-authored-edit-v0"} mode=\${sourceAuthoredEdit?.mode ?? "none"} entrypoint=\${sourceAuthoredEdit?.entrypoint ?? "/plugins/native-adapter/source-authored-edit-tasks"} proposal=\${sourceAuthoredEdit?.proposalRegistry ?? "none"} rationale=\${sourceAuthoredEdit?.rationaleBundleRegistry ?? "none"} checks=\${sourceAuthoredEdit?.checkBundleRegistry ?? "none"} contentExposed=\${Boolean(sourceAuthoredEdit?.contentExposed)}\`,
    "Source-Derived Compatibility: deriveProposalFromSource=true supersededBy=/plugins/native-adapter/source-authored-edit/draft",
    \`Target Selection: registry=\${targetSelection?.registry ?? "none"} selected=\${targetSelection?.selectedTarget?.relativePath ?? "none"} candidates=\${targetSelection?.summary?.candidateCount ?? 0} canFeedPatch=\${Boolean(targetSelection?.summary?.canFeedPatchProposal)} exposesSource=\${Boolean(targetSelection?.governance?.exposesSourceFileContent)}\`,
    \`Proposal Envelope: registry=\${proposal.registry ?? "openclaw-native-workspace-edit-proposal-v0"} title=\${proposal.title ?? "unknown"} dryRun=\${Boolean(proposal.dryRun?.ok)} contentExposed=\${Boolean(proposal.dryRun?.contentExposed)} rationale=\${proposal.rationale ?? "unknown"}\`,
    \`Edit Intent: kind=\${editIntent.kind ?? "none"} objective=\${editIntent.objective ?? "none"} planning=\${editIntent.planningStyle ?? "none"} safety=\${editIntent.targetSafety ?? "none"}\`,
    \`Expected Checks: \${expectedChecks.join(",") || "none"} semanticPlan=\${semanticPlan?.registry ?? "none"} promptFiles=\${semanticPlan?.promptFiles ?? 0} contentExposed=\${Boolean(semanticPlan?.contentExposed)}\`,
    \`Rationale Bundle: registry=\${rationaleBundle?.registry ?? "openclaw-rationale-check-bundle-v0"} reasons=\${rationaleBundle?.reasons?.length ?? 0} matchedTools=\${rationaleBundle?.sourceSignals?.matchedTools ?? 0} matchedSemanticFiles=\${rationaleBundle?.sourceSignals?.matchedSemanticFiles ?? 0} promptFiles=\${rationaleBundle?.sourceSignals?.promptSemanticFiles ?? 0} contentExposed=\${Boolean(rationaleBundle?.contentExposed)}\`,
    \`Check Bundle: registry=\${checkBundle?.registry ?? "openclaw-rationale-check-bundle-v0"} required=\${(checkBundle?.required ?? []).join(",") || "none"} recommended=\${(checkBundle?.recommended ?? []).join(",") || "none"} blockedUntilApproval=\${(checkBundle?.blockedUntilApproval ?? []).join(",") || "none"} contentExposed=\${Boolean(checkBundle?.contentExposed)}\`,
    \`Risk Notes: registry=\${riskNotes?.registry ?? "openclaw-rationale-check-bundle-v0"} risk=\${riskNotes?.risk ?? "none"} approvalRequired=\${Boolean(riskNotes?.approvalRequired)} notes=\${(riskNotes?.notes ?? []).join(";") || "none"} contentExposed=\${Boolean(riskNotes?.contentExposed)}\`,
    \`Proposal Source Signals: registry=\${proposalSourceSignals?.registry ?? "none"} knownRegistry=\${SOURCE_DERIVED_EDIT_PROPOSAL_REGISTRY} matchedTools=\${proposalSourceSignals?.toolSignals?.matchedTools ?? 0} matchedSemanticFiles=\${proposalSourceSignals?.semanticSignals?.matchedFiles ?? 0} exposesSource=\${Boolean(proposalSourceSignals?.governance?.exposesSourceFileContent)} executesTool=\${Boolean(proposalSourceSignals?.governance?.canExecuteToolCode)}\`,
    \`Structured Edits: supportedKinds=replace_text,replace_lines observedKinds=\${(data?.edits ?? []).map((edit) => edit.kind ?? "replace_text").join(",") || "none"}\`,
    \`Validation: ok=\${Boolean(validation.ok)} structured=\${structuredValidationEngine} preview=\${previewValidationEngine} appliesAgainstOriginal=\${Boolean(validation.structuredPatch?.checks?.appliesAgainstOriginalContent)} structuredLineRangesResolved=\${Boolean(validation.structuredPatch?.checks?.structuredLineRangesResolved)}\`,
    \`Diff: format=\${diffPreview.format ?? "unknown"} hunks=\${diffPreview.hunkCount ?? 1} oldStart=\${diffPreview.oldStartLine ?? "?"} newStart=\${diffPreview.newStartLine ?? "?"} lines=\${diffPreview.previewLineCount ?? lines.length} truncated=\${Boolean(diffPreview.truncated)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executeWithoutApproval=\${Boolean(governance.canExecuteWithoutApproval)} filesystemWrite=\${Boolean(governance.usesFilesystemWriteCapability)} exposesFullContent=\${Boolean(governance.exposesFullContent)} exposesDiffPreview=\${Boolean(governance.exposesDiffPreview)}\`,
    "",
    ...lines.map((line) => {
      const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
      const number = line.type === "add" ? line.newLine : line.oldLine;
      const hunk = line.hunk ? \`h\${line.hunk} \` : "";
      return \`\${hunk}\${prefix}\${number ?? "?"}: \${line.text ?? ""}\`;
    }),
  ].join("\\n");
}

`;
