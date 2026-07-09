import { createPluginReviewManifestCapability } from "./plugin-review-manifest-capability.mjs";
import { createPluginReviewWorkspaceIntelligence } from "./plugin-review-workspace-intelligence.mjs";
import { createPluginReviewSdkContracts } from "./plugin-review-sdk-contracts.mjs";
import { createPluginReviewSearchWebPlans } from "./plugin-review-search-web-plans.mjs";
import { createPluginReviewSearchWebTasks } from "./plugin-review-search-web-tasks.mjs";
import { createPluginReviewSourceCommandProposals } from "./plugin-review-source-command-proposals.mjs";
import { createPluginReviewSourceMigration } from "./plugin-review-source-migration.mjs";
import { createNativeEngineeringToolSurfaceBuilders } from "./native-engineering-tool-surface-builders.mjs";
import { createNativeEngineeringReadSearchBuilders } from "./native-engineering-read-search-builders.mjs";
import { createNativeEngineeringEditProposalBuilders } from "./native-engineering-edit-proposal-builders.mjs";
import { createNativeEngineeringWriteProposalBuilders } from "./native-engineering-write-proposal-builders.mjs";
import { createNativeEngineeringLspEvidenceBuilders } from "./native-engineering-lsp-evidence-builders.mjs";
import { createNativeEngineeringLspLifecycleStateBuilders } from "./native-engineering-lsp-lifecycle-state.mjs";
import { createNativeEngineeringLspSourceTransferProposalBuilders } from "./native-engineering-lsp-source-transfer-proposal-builders.mjs";
import { createNativeEngineeringLspSymbolRequestProposalBuilders } from "./native-engineering-lsp-symbol-request-proposal-builders.mjs";
import {
  createPluginReviewWorkspaceDiscovery,
  safeStat,
} from "./plugin-review-workspace-discovery.mjs";

const PLUGIN_REVIEW_IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", ".turbo", ".cache"]);

export function createPluginReview(deps) {
  const { client, state, taskManager, approvalEngine, serialisePlanForPublic, publishEvent } = deps;
  const { fetchJson, readJsonFileIfPresent } = client;
  const { workspaceRoots, tasks, persistState, autonomyMode, nativeEngineeringLspLifecycleRecords } = state;
  const {
    createTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    serialiseTask,
  } = taskManager;
  const {
    createApprovalRequestForTask,
    publishTaskApprovalIfPending,
  } = approvalEngine;

  const {
    detectWorkspacePackageManager,
    detectWorkspace,
    buildWorkspaceRegistry,
    buildWorkspaceCommandProposals,
    truncatePatchMetadata,
  } = createPluginReviewWorkspaceDiscovery({
    workspaceRoots,
    readJsonFileIfPresent,
  });
  const {
    buildOpenClawMigrationMap,
    buildOpenClawMigrationPlan,
  } = createPluginReviewSourceMigration({
    buildWorkspaceRegistry,
  });
  const {
    buildOpenClawPluginSdkSourceReviewScope,
    buildOpenClawPluginSdkSourceContentReview,
    buildOpenClawPluginSdkNativeContractTests,
    buildOpenClawNativePluginSdkContractImplementation,
    buildOpenClawPluginSdkContractReview,
    buildOpenClawNativePluginContractRegistry,
    buildOpenClawNativePluginRegistryResponse,
    selectReviewedPluginSdkPackage,
  } = createPluginReviewSdkContracts({
    buildOpenClawMigrationPlan,
    readJsonFileIfPresent,
  });
  const {
    normalisePositiveLimit,
    selectOpenClawToolCatalogWorkspace,
    buildOpenClawToolCatalog,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawPromptSemanticsProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
  } = createPluginReviewWorkspaceIntelligence({
    buildOpenClawNativePluginSdkContractImplementation,
    buildWorkspaceRegistry,
    safeStat,
  });
  const {
    buildOpenClawSourceCommandProposals,
  } = createPluginReviewSourceCommandProposals({
    buildWorkspaceCommandProposals,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawPromptSemanticsProfile,
    normalisePositiveLimit,
    truncatePatchMetadata,
  });
  const {
    buildNativePluginManifestProfile,
    buildOpenClawPluginManifestMap,
    buildOpenClawPluginCapabilityPlan,
    buildOpenClawPluginCandidateContractTests,
  } = createPluginReviewManifestCapability({
    buildOpenClawNativePluginSdkContractImplementation,
    normalisePositiveLimit,
    readJsonFileIfPresent,
    selectOpenClawToolCatalogWorkspace,
    selectReviewedPluginSdkPackage,
    toolCatalogIgnoredDirectories: PLUGIN_REVIEW_IGNORED_DIRECTORIES,
  });
  const {
    buildNativeEngineeringToolSurfaceInventory,
  } = createNativeEngineeringToolSurfaceBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildNativeEngineeringReadFile,
    buildNativeEngineeringGlob,
    buildNativeEngineeringGrep,
  } = createNativeEngineeringReadSearchBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildNativeEngineeringEditProposal,
  } = createNativeEngineeringEditProposalBuilders({
    buildNativeEngineeringReadFile,
  });
  const {
    buildNativeEngineeringWriteProposal,
  } = createNativeEngineeringWriteProposalBuilders({
    buildNativeEngineeringReadFile,
    safeStat,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildNativeEngineeringLspEvidence,
    buildNativeEngineeringLspLifecycleDraft,
  } = createNativeEngineeringLspEvidenceBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildNativeEngineeringLspLifecycleState,
  } = createNativeEngineeringLspLifecycleStateBuilders({
    records: nativeEngineeringLspLifecycleRecords,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildNativeEngineeringLspSourceTransferProposal,
  } = createNativeEngineeringLspSourceTransferProposalBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildNativeEngineeringLspSymbolRequestProposal,
  } = createNativeEngineeringLspSymbolRequestProposalBuilders({
    records: nativeEngineeringLspLifecycleRecords,
    selectOpenClawToolCatalogWorkspace,
  });
  const {
    buildOpenClawPluginSearchWebAdapterContract,
    buildOpenClawPluginSearchWebAdapterTaskDraft,
    buildOpenClawPluginSearchWebAdapterRuntimePreflight,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan,
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft,
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft,
  } = createPluginReviewSearchWebPlans({
    autonomyMode,
    buildOpenClawPluginCandidateContractTests,
  });
  const {
    createOpenClawPluginSearchWebAdapterTask,
    createOpenClawPluginSearchWebAdapterRuntimeActivationTask,
    createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask,
  } = createPluginReviewSearchWebTasks({
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft,
    buildOpenClawPluginSearchWebAdapterTaskDraft,
    createApprovalRequestForTask,
    createTask,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    reconcileRuntimeState,
    serialisePlanForPublic,
    serialiseTask,
    supersedeOtherActiveTasks,
  });

function buildOpenClawFormalIntegrationReadiness() {
  const nativeRegistry = buildOpenClawNativePluginRegistryResponse();
  const migrationPlan = buildOpenClawMigrationPlan();
  const pluginSdkReview = buildOpenClawPluginSdkContractReview();
  const firstWavePluginSdk = migrationPlan.items.find((item) => item.capability === "plugin_sdk") ?? null;
  const pluginSdkReviewItem = pluginSdkReview.items.find((item) => item.capability === "plugin_sdk") ?? null;
  const registryGovernance = nativeRegistry.governance ?? {};
  const gates = [
    {
      id: "native_registry_valid",
      label: "Native plugin registry validates",
      required: true,
      status: nativeRegistry.validation.ok ? "passed" : "blocked",
      evidence: `issues=${nativeRegistry.validation.issues.length}`,
    },
    {
      id: "runtime_owner_locked",
      label: "Runtime owner remains OpenClawOnNixOS",
      required: true,
      status: nativeRegistry.runtimeOwner === "openclaw_on_nixos" ? "passed" : "blocked",
      evidence: `runtimeOwner=${nativeRegistry.runtimeOwner}`,
    },
    {
      id: "source_migration_plan_selected",
      label: "Plugin SDK is selected in first-wave migration plan",
      required: true,
      status: firstWavePluginSdk ? "passed" : "blocked",
      evidence: firstWavePluginSdk ? `status=${firstWavePluginSdk.status}` : "missing plugin_sdk first-wave item",
    },
    {
      id: "sdk_contract_review_complete",
      label: "Plugin SDK contract review exists without source import",
      required: true,
      status: pluginSdkReviewItem?.governance?.canReadSourceFileContent === false ? "passed" : "blocked",
      evidence: pluginSdkReviewItem ? `verdict=${pluginSdkReviewItem.verdict}` : "missing plugin SDK review item",
    },
    {
      id: "external_runtime_dependency_blocked",
      label: "External runtime dependency remains blocked",
      required: true,
      status: registryGovernance.externalRuntimeDependencyAllowed === false ? "passed" : "blocked",
      evidence: `externalRuntimeDependencyAllowed=${Boolean(registryGovernance.externalRuntimeDependencyAllowed)}`,
    },
    {
      id: "registration_execution_blocked",
      label: "Registration cannot execute plugin code",
      required: true,
      status: registryGovernance.canExecuteDuringRegistration === false ? "passed" : "blocked",
      evidence: `canExecuteDuringRegistration=${Boolean(registryGovernance.canExecuteDuringRegistration)}`,
    },
    {
      id: "adapter_implementation_pending",
      label: "Native adapter implementation is the next manual engineering step",
      required: false,
      status: "pending",
      evidence: "no runtime adapter is activated by readiness checks",
    },
  ];
  const requiredGates = gates.filter((gate) => gate.required);
  const passedRequired = requiredGates.filter((gate) => gate.status === "passed").length;
  const readyForFormalIntegration = passedRequired === requiredGates.length;

  return {
    registry: "openclaw-formal-integration-readiness-v0",
    mode: "readiness-only",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      nativeRegistry.registry,
      migrationPlan.registry,
      pluginSdkReview.registry,
    ],
    status: readyForFormalIntegration ? "ready_for_native_adapter_implementation" : "blocked",
    readyForFormalIntegration,
    gates,
    summary: {
      totalGates: gates.length,
      requiredGates: requiredGates.length,
      passedRequired,
      blockedRequired: requiredGates.length - passedRequired,
      pendingOptional: gates.filter((gate) => gate.status === "pending").length,
      readyForFormalIntegration,
      canImportSourceContent: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement a native adapter shell inside OpenClawOnNixOS",
        "map reviewed SDK concepts into native capability contracts",
        "add adapter tests before any runtime activation",
      ],
      forbiddenWork: [
        "do not wholesale copy old OpenClaw source",
        "do not make old OpenClaw a runtime dependency",
        "do not execute old repository commands",
        "do not import source contents without explicit review",
      ],
    },
  };
}

function buildOpenClawNativePluginAdapterStatus() {
  const registry = buildOpenClawNativePluginRegistryResponse();
  return {
    registry: "openclaw-native-plugin-adapter-v0",
    mode: "native-adapter-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: registry.registry,
    runtimeOwner: "openclaw_on_nixos",
    status: "read_only_and_approval_gated_mutation_adapters_ready",
    implementedCapabilities: [
      "sense.plugin.manifest_profile",
      "sense.openclaw.tool_catalog",
      "sense.openclaw.workspace_semantic_index",
      "sense.openclaw.workspace_symbol_lookup",
      "sense.openclaw.workspace_edit_target_select",
      "sense.openclaw.engineering_tool_surface_inventory",
      "sense.openclaw.engineering_tool.read",
      "sense.openclaw.engineering_tool.glob",
      "sense.openclaw.engineering_tool.grep",
      "act.openclaw.engineering_tool.edit_proposal",
      "act.openclaw.engineering_tool.edit_proposal_task",
      "sense.openclaw.engineering_tool.edit_execution_evidence",
      "act.openclaw.engineering_tool.write_proposal",
      "sense.openclaw.engineering_tool.write_execution_evidence",
      "sense.openclaw.engineering_tool.lsp_evidence",
      "plan.openclaw.engineering_tool.lsp_lifecycle",
      "act.openclaw.engineering_tool.lsp_lifecycle_task",
      "sense.openclaw.engineering_tool.lsp_lifecycle_state",
      "plan.openclaw.engineering_tool.lsp_source_transfer",
      "act.openclaw.engineering_tool.lsp_source_transfer_task",
      "plan.openclaw.engineering_tool.lsp_symbol_request",
      "act.openclaw.engineering_tool.lsp_symbol_request_task",
      "sense.openclaw.engineering_tool.verify_evidence",
      "sense.openclaw.engineering_tool.recovery_evidence",
      "sense.openclaw.engineering_context.microcompact_evidence",
      "sense.openclaw.engineering_context.plan_todo_evidence",
      "sense.openclaw.plugin_runtime.refresh_evidence",
      "sense.openclaw.prompt_pack",
      "sense.openclaw.plugin_manifest_map",
      "plan.openclaw.plugin_capability",
      "plan.openclaw.plugin_search_web_adapter_contract",
      "plan.openclaw.plugin_search_web_runtime_preflight",
      "plan.openclaw.plugin_search_web_runtime_activation",
      "act.openclaw.workspace_text_write",
      "act.openclaw.workspace_patch_apply",
      "plan.plugin.runtime_preflight",
      "plan.plugin.runtime_adapter_contract",
    ],
    pendingCapabilities: ["act.plugin.capability.invoke"],
    summary: {
      implemented: 37,
      pending: 1,
      canReadManifestMetadata: true,
      canReadToolCatalogMetadata: true,
      canReadEngineeringToolSurfaceMetadata: true,
      canReadBoundedEngineeringFiles: true,
      canRunBoundedEngineeringGlob: true,
      canRunBoundedEngineeringGrep: true,
      canBuildSurgicalEngineeringEditProposals: true,
      canCreateApprovalGatedEngineeringEditProposalTasks: true,
      canReadEngineeringEditExecutionEvidence: true,
      canBuildEngineeringWriteProposals: true,
      canReadEngineeringWriteExecutionEvidence: true,
      canReadEngineeringLspEvidence: true,
      canDraftEngineeringLspLifecycleAction: true,
      canCreateApprovalGatedEngineeringLspLifecycleTasks: true,
      canReadEngineeringLspLifecycleState: true,
      canDraftEngineeringLspSourceTransferProposal: true,
      canCreateApprovalGatedEngineeringLspSourceTransferTasks: true,
      canDraftEngineeringLspSymbolRequestProposal: true,
      canCreateApprovalGatedEngineeringLspSymbolRequestTasks: true,
      canReadEngineeringVerificationEvidence: true,
      canReadEngineeringRecoveryEvidence: true,
      canReadEngineeringMicrocompactEvidence: true,
      canReadEngineeringPlanTodoEvidence: true,
      canReadPluginRuntimeRefreshEvidence: true,
      canReadPluginManifestMapMetadata: true,
      canPlanPluginCapabilityAbsorption: true,
      canPlanSearchWebAdapterContract: true,
      canPlanSearchWebRuntimePreflight: true,
      canPlanSearchWebRuntimeActivation: true,
      canPlanNativeRuntimeAdapterContract: true,
      canReadWorkspaceSemanticMetadata: true,
      canExecuteWorkspaceSymbolLookup: true,
      canSelectWorkspaceEditTargets: true,
      canReadPromptSemantics: true,
      canCreateApprovalGatedWorkspaceTextWriteTasks: true,
      canCreateApprovalGatedWorkspacePatchTasks: true,
      canReadSourceFileContent: false,
      canMutate: true,
      canExecutePluginCode: false,
      canExecuteToolCode: false,
      canActivateRuntime: false,
      createsTask: true,
      createsApproval: true,
      requiresPolicyInvocation: true,
    },
    guardrails: [
      "adapter shell is native to OpenClawOnNixOS",
      "manifest profile reads only bounded package metadata from reviewed plugin SDK paths",
      "tool catalog adapter reads only bounded enhanced OpenClaw tool metadata and never imports legacy tools",
      "plugin manifest map reads only bounded extension manifest metadata and never exposes manifest bodies, auth env var names, or config schema bodies",
      "plugin capability planning derives governance gates from manifest metadata only and never imports, executes, or activates plugins",
      "search/web adapter contract shell maps selected manifest-derived candidates into native contracts without network access or runtime activation",
      "search/web runtime preflight builds a governed provider execution envelope while keeping network/provider activation disabled",
      "search/web runtime activation planning records the remaining gates before any provider/network execution can be enabled",
      "native plugin runtime adapter contract defines the sandbox loader boundary before any plugin module can be loaded",
      "workspace semantic index emits derived counts only and never exposes file contents",
      "engineering tool surface inventory maps cc-tools contracts without importing, executing, mutating, starting LSP, or exposing source file bodies",
      "engineering read/search runs only bounded workspace read, glob, and grep operations with traversal, size, result, binary, hidden, generated, and cache boundaries",
      "engineering edit proposals create exact-match diff previews only; the edit proposal task bridge creates approval-gated workspace patch tasks without approving, executing, or writing",
      "engineering edit execution evidence reads approved workspace patch task and filesystem ledger outcomes without creating tasks, approvals, writes, or operator steps",
      "engineering write proposals create redacted create/overwrite diff metadata only; workspace text write, task creation, and approval creation remain separate approval-gated paths",
      "engineering write execution evidence reads approved workspace text write task and filesystem ledger outcomes without creating tasks, approvals, writes, or operator steps",
      "engineering LSP evidence maps definition, references, hover, and server-check contracts without checking binaries, starting servers, opening files, or sending JSON-RPC",
      "engineering LSP lifecycle draft maps a future workspace-scoped server lifecycle action without checking binaries, starting processes, creating tasks, approvals, state, or JSON-RPC",
      "engineering LSP lifecycle tasks create approval-gated binary-gate tasks; approved execution may check server binary availability but still does not start processes or send JSON-RPC",
      "engineering LSP source-transfer proposals read one bounded workspace source file, report the future didOpen payload metadata and hash, and do not send didOpen or transfer content into a server process",
      "engineering LSP source-transfer tasks require approval, re-read and hash-check the bounded workspace file after approval, send initialize plus didOpen to a short-lived user-space process, and keep symbol requests and long-lived pools disabled",
      "engineering LSP symbol request proposals read approved didOpen lifecycle state and draft definition/references/hover JSON-RPC metadata without sending operational requests",
      "engineering LSP symbol request tasks require approval, rebuild didOpen in a short-lived process, send one selected definition/references/hover request, and keep long-lived pools disabled",
      "engineering recovery evidence reads failed verification/task outcomes and recommends governed recovery review without creating tasks, approvals, retries, mutations, or provider calls",
      "engineering microcompact evidence calculates context-budget savings from historical command transcripts without returning raw output or mutating runtime messages or persisted logs",
      "engineering plan/todo evidence reads visible task/workbench planning state without hidden agent mode switches or .openclaw/cc-todo.md writes",
      "native plugin runtime refresh evidence recomputes registry read-model state and reports cache/activation boundaries without importing modules or activating runtime",
      "runtime preflight builds a governed execution envelope without loading plugin modules",
      "source contents, README text, script bodies, dependency versions, plugin code execution, and runtime activation remain blocked",
      "mutating plugin invocation remains pending explicit adapter design and approval gates",
    ],
  };
}




  return {
    detectWorkspacePackageManager,
    detectWorkspace,
    buildWorkspaceRegistry,
    buildWorkspaceCommandProposals,
    buildOpenClawSourceCommandProposals,
    buildOpenClawMigrationMap,
    buildOpenClawMigrationPlan,
    buildOpenClawPluginSdkSourceReviewScope,
    buildOpenClawPluginSdkSourceContentReview,
    buildOpenClawPluginSdkNativeContractTests,
    buildOpenClawNativePluginSdkContractImplementation,
    buildOpenClawPluginSdkContractReview,
    buildOpenClawNativePluginContractRegistry,
    buildOpenClawNativePluginRegistryResponse,
    buildOpenClawFormalIntegrationReadiness,
    buildOpenClawNativePluginAdapterStatus,
    buildNativePluginManifestProfile,
    buildOpenClawToolCatalog,
    buildOpenClawPluginCapabilityPlan,
    buildOpenClawPluginCandidateContractTests,
    buildOpenClawPluginSearchWebAdapterContract,
    buildOpenClawPluginSearchWebAdapterTaskDraft,
    buildOpenClawPluginSearchWebAdapterRuntimePreflight,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan,
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox,
    buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft,
    buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft,
    createOpenClawPluginSearchWebAdapterTask,
    createOpenClawPluginSearchWebAdapterRuntimeActivationTask,
    createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask,
    selectReviewedPluginSdkPackage,
    selectOpenClawToolCatalogWorkspace,
    buildNativeOpenClawToolCatalogProfile,
    buildOpenClawPluginManifestMap,
    buildNativeOpenClawPromptSemanticsProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
    buildNativeEngineeringToolSurfaceInventory,
    buildNativeEngineeringReadFile,
    buildNativeEngineeringGlob,
    buildNativeEngineeringGrep,
    buildNativeEngineeringEditProposal,
    buildNativeEngineeringWriteProposal,
    buildNativeEngineeringLspEvidence,
    buildNativeEngineeringLspLifecycleDraft,
    buildNativeEngineeringLspLifecycleState,
    buildNativeEngineeringLspSourceTransferProposal,
    buildNativeEngineeringLspSymbolRequestProposal,
  };
}
