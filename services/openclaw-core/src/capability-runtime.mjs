import { randomUUID } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildBaseCapabilities } from "./capability-descriptors.mjs";
import { createEngineeringToolSurfaceCapabilityHandlers } from "./capability-runtime-engineering-tool-surface.mjs";
import { createEngineeringReadSearchCapabilityHandlers } from "./capability-runtime-engineering-read-search.mjs";
import { createEngineeringLspCapabilityHandlers } from "./capability-runtime-engineering-lsp.mjs";
import { createEngineeringVerificationCapabilityHandlers } from "./capability-runtime-engineering-verification.mjs";
import { createEngineeringRecoveryCapabilityHandlers } from "./capability-runtime-engineering-recovery.mjs";
import { createEngineeringMicrocompactCapabilityHandlers } from "./capability-runtime-engineering-microcompact.mjs";
import { createEngineeringProposalCapabilityHandlers } from "./capability-runtime-engineering-proposals.mjs";
import { createEngineeringExecutionEvidenceCapabilityHandlers } from "./capability-runtime-engineering-execution-evidence.mjs";
import { createEngineeringContextCapabilityHandlers } from "./capability-runtime-engineering-context.mjs";
import { createEngineeringPlanTodoCapabilityHandlers } from "./capability-runtime-engineering-plan-todo.mjs";
import { createEngineeringWorkViewCapabilityHandlers } from "./capability-runtime-work-view.mjs";
import { createPluginRuntimeRefreshCapabilityHandlers } from "./capability-runtime-plugin-refresh.mjs";
import { createEngineeringProviderHandoffCapabilityHandlers } from "./capability-runtime-engineering-provider-handoff.mjs";
import { createAcpxCodexCompatibilityCapabilityHandlers } from "./capability-runtime-acpx-codex.mjs";
import { createPluginSearchWebContractCapabilityHandlers } from "./capability-runtime-plugin-search-web-contract.mjs";
import { createPromptPackCapabilityHandlers } from "./capability-runtime-prompt-pack.mjs";
import { createWorkspaceEditTargetCapabilityHandlers } from "./capability-runtime-workspace-edit-target.mjs";
import { createWorkspaceMutationCapabilityHandlers } from "./capability-runtime-workspace-mutations.mjs";
import { createScreenObservationCapabilityHandlers } from "./capability-runtime-screen.mjs";
import { createBrowserActionCapabilityHandlers } from "./capability-runtime-browser-actions.mjs";
import { createScreenActionCapabilityHandlers } from "./capability-runtime-screen-actions.mjs";
import { createDeclarativeEvolutionCapabilityHandlers } from "./capability-runtime-declarative-evolution.mjs";
import { validateCapabilityExecutionApproval } from "./capability-runtime-approval-binding.mjs";

export function createCapabilityRuntime(deps) {
  const {
    host,
    port,
    client,
    state,
    pluginReview = {},
    taskManager = {},
    policyEvaluator,
    publishEvent = async () => {},
    fetchImpl = globalThis.fetch,
    createId = randomUUID,
    now = () => new Date().toISOString(),
    readWorkViewState,
    listCommandTranscriptRecords = () => [],
    listFilesystemChangeRecords = () => [],
    buildExperienceMemoryReadModel = () => null,
    pluginRuntime = {},
    providerRuntime = {},
    declarativeEvolution = {},
    workspaceOps = {},
    serialiseTask,
    serialiseApproval,
  } = deps;
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
    capabilityInvocationLog = [],
    MAX_CAPABILITY_INVOCATION_ENTRIES = 100,
    CAPABILITY_HEALTH_TIMEOUT_MS = 1000,
    CROSS_BOUNDARY_INTENTS = [],
    persistState = () => {},
  } = state;
  const tasks = state.tasks ?? new Map();
  const approvals = state.approvals ?? new Map();
  const {
    evaluatePolicyIntent,
    recordPolicyDecision,
    isPolicyExecutionAllowed,
  } = policyEvaluator;
  const {
    buildNativePluginManifestProfile,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
    buildNativeEngineeringToolSurfaceInventory,
    buildOpenClawPluginManifestMap,
    buildOpenClawPluginCapabilityPlan,
    buildOpenClawPluginSearchWebAdapterContract,
    buildNativeDeclarativeEvolutionCandidate,
    buildNativeDeclarativeEvolutionHealthGate,
  } = pluginReview;
  const engineeringReadSearchHandlers = createEngineeringReadSearchCapabilityHandlers({
    buildNativeEngineeringReadFile: pluginReview.buildNativeEngineeringReadFile,
    buildNativeEngineeringGlob: pluginReview.buildNativeEngineeringGlob,
    buildNativeEngineeringGrep: pluginReview.buildNativeEngineeringGrep,
  });
  const engineeringToolSurfaceHandlers = createEngineeringToolSurfaceCapabilityHandlers({
    buildNativeEngineeringToolSurfaceInventory,
  });
  const engineeringLspHandlers = createEngineeringLspCapabilityHandlers({
    buildNativeEngineeringLspEvidence: pluginReview.buildNativeEngineeringLspEvidence,
    buildNativeEngineeringLspLifecycleDraft: pluginReview.buildNativeEngineeringLspLifecycleDraft,
    buildNativeEngineeringLspSourceTransferProposal: pluginReview.buildNativeEngineeringLspSourceTransferProposal,
    buildNativeEngineeringLspSymbolRequestProposal: pluginReview.buildNativeEngineeringLspSymbolRequestProposal,
    buildNativeEngineeringLspSelectedTargetReadBridge: pluginReview.buildNativeEngineeringLspSelectedTargetReadBridge,
  });
  const engineeringVerificationHandlers = createEngineeringVerificationCapabilityHandlers({
    listCommandTranscriptRecords,
    listCapabilityInvocations: (options) => listCapabilityInvocations(options),
    tasks: state.tasks ?? new Map(),
  });
  const engineeringRecoveryHandlers = createEngineeringRecoveryCapabilityHandlers({
    listCommandTranscriptRecords,
    listCapabilityInvocations: (options) => listCapabilityInvocations(options),
    tasks: state.tasks ?? new Map(),
  });
  const engineeringMicrocompactHandlers = createEngineeringMicrocompactCapabilityHandlers({
    listCommandTranscriptRecords,
    listCapabilityInvocations: (options) => listCapabilityInvocations(options),
    tasks: state.tasks ?? new Map(),
    publishEvent,
  });
  const engineeringProposalHandlers = createEngineeringProposalCapabilityHandlers({
    buildNativeEngineeringEditProposal: pluginReview.buildNativeEngineeringEditProposal,
    buildNativeEngineeringWriteProposal: pluginReview.buildNativeEngineeringWriteProposal,
  });
  const engineeringExecutionEvidenceHandlers = createEngineeringExecutionEvidenceCapabilityHandlers({
    buildNativeEngineeringEditExecutionEvidence: pluginReview.buildNativeEngineeringEditExecutionEvidence,
    buildNativeEngineeringWriteExecutionEvidence: pluginReview.buildNativeEngineeringWriteExecutionEvidence,
    listFilesystemChangeRecords,
    tasks: state.tasks ?? new Map(),
  });
  const engineeringContextHandlers = createEngineeringContextCapabilityHandlers({
    tasks: state.tasks ?? new Map(),
    runtimeState: state.runtimeState ?? {},
    workbenchRecords: state.nativeEngineeringPlanTodoWorkbenchRecords ?? [],
    listCommandTranscriptRecords,
    listCapabilityInvocations: (options) => listCapabilityInvocations(options),
    buildExperienceMemoryReadModel,
    sessionManagerUrl,
    fetchImpl,
    publishEvent,
  });
  const engineeringPlanTodoHandlers = createEngineeringPlanTodoCapabilityHandlers({
    tasks: state.tasks ?? new Map(),
    taskManager,
    runtimeState: state.runtimeState ?? {},
    workbenchRecords: state.nativeEngineeringPlanTodoWorkbenchRecords ?? new Map(),
    persistState,
    publishEvent,
    now,
  });
  const engineeringWorkViewHandlers = createEngineeringWorkViewCapabilityHandlers({
    tasks: state.tasks ?? new Map(),
    taskManager,
    sessionManagerUrl,
    fetchImpl,
    postJson,
    readWorkViewState,
    publishEvent,
  });
  const pluginRuntimeRefreshHandlers = createPluginRuntimeRefreshCapabilityHandlers(pluginRuntime);
  const engineeringProviderHandoffHandlers = createEngineeringProviderHandoffCapabilityHandlers(providerRuntime);
  const acpxCodexCompatibilityHandlers = createAcpxCodexCompatibilityCapabilityHandlers({
    buildNativeAcpxCodexBridgeCompatibility: pluginReview.buildNativeAcpxCodexBridgeCompatibility,
  });
  const pluginSearchWebContractHandlers = createPluginSearchWebContractCapabilityHandlers({
    buildOpenClawPluginSearchWebAdapterContract,
  });
  const promptPackHandlers = createPromptPackCapabilityHandlers({
    buildNativeOpenClawPromptSemanticsProfile: pluginReview.buildNativeOpenClawPromptSemanticsProfile,
  });
  const workspaceEditTargetHandlers = createWorkspaceEditTargetCapabilityHandlers({
    buildNativeOpenClawWorkspaceEditTargetSelection: buildNativeOpenClawWorkspaceEditTargetSelection,
  });
  const workspaceMutationHandlers = createWorkspaceMutationCapabilityHandlers({
    workspaceOps,
    serialiseTask,
    serialiseApproval,
  });
  const screenObservationHandlers = createScreenObservationCapabilityHandlers({
    screenSenseUrl,
    fetchJson,
  });
  const browserActionHandlers = createBrowserActionCapabilityHandlers({
    screenActUrl,
    postJson,
  });
  const screenActionHandlers = createScreenActionCapabilityHandlers({
    screenActUrl,
    postJson,
  });
  const declarativeEvolutionHandlers = createDeclarativeEvolutionCapabilityHandlers({
    buildNativeDeclarativeEvolutionCandidate,
    buildNativeDeclarativeEvolutionHealthGate,
    createNativeDeclarativeEvolutionStagingTask: declarativeEvolution.createNativeDeclarativeEvolutionStagingTask,
  });

  function baseCapabilities() {
    return buildBaseCapabilities({
      host,
      port,
      eventHubUrl,
      sessionManagerUrl,
      browserRuntimeUrl,
      screenSenseUrl,
      screenActUrl,
      systemSenseUrl,
      systemHealUrl,
      CROSS_BOUNDARY_INTENTS,
    });
  }

  function capabilityById(capabilityId) {
    return baseCapabilities().find((capability) => capability.id === capabilityId) ?? null;
  }

  function capabilityByIntent(intent) {
    return baseCapabilities().find((capability) => capability.intents?.includes(intent)) ?? null;
  }

  function capabilityRequestIntent(capability, request) {
    if (capability.id === "act.work_view.control") {
      return request.operation
        ?? request.intent
        ?? request.params?.operation
        ?? request.params?.action
        ?? capability.intents?.[0]
        ?? "capability.invoke";
    }
    if (capability.id === "act.browser.open") {
      return request.operation
        ?? request.params?.operation
        ?? request.intent
        ?? capability.intents?.[0]
        ?? "capability.invoke";
    }
    if (capability.id === "act.screen.pointer_keyboard") {
      return request.operation
        ?? request.params?.operation
        ?? request.intent
        ?? capability.intents?.[0]
        ?? "capability.invoke";
    }
    if (capability.id === "act.system.heal") {
      return request.operation
        ?? request.params?.operation
        ?? request.intent
        ?? capability.intents?.[0]
        ?? "capability.invoke";
    }
    return request.intent ?? capability.intents?.[0] ?? "capability.invoke";
  }

  function serviceHealthUrl(service) {
    const urls = {
      "openclaw-core": `http://${host}:${port}/health`,
      "openclaw-event-hub": `${eventHubUrl}/health`,
      "openclaw-session-manager": `${sessionManagerUrl}/health`,
      "openclaw-browser-runtime": `${browserRuntimeUrl}/health`,
      "openclaw-screen-sense": `${screenSenseUrl}/health`,
      "openclaw-screen-act": `${screenActUrl}/health`,
      "openclaw-system-sense": `${systemSenseUrl}/health`,
      "openclaw-system-heal": `${systemHealUrl}/health`,
    };
    return urls[service] ?? null;
  }

  async function probeServiceHealth(service) {
    if (service === "openclaw-core") {
      return {
        ok: true,
        status: "online",
        detail: "local-core",
        latencyMs: 0,
        checkedAt: now(),
      };
    }

    const url = serviceHealthUrl(service);
    if (!url) {
      return {
        ok: false,
        status: "unknown",
        detail: "no-health-url",
        latencyMs: null,
        checkedAt: now(),
      };
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPABILITY_HEALTH_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok && data?.ok !== false,
        status: response.ok && data?.ok !== false ? "online" : "degraded",
        detail: data?.service ?? data?.stage ?? response.statusText,
        latencyMs: Date.now() - startedAt,
        checkedAt: now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      return {
        ok: false,
        status: "offline",
        detail: message,
        latencyMs: Date.now() - startedAt,
        checkedAt: now(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function summariseCapabilities(capabilities) {
    return capabilities.reduce((summary, capability) => {
      summary.total += 1;
      summary[capability.status] = (summary[capability.status] ?? 0) + 1;
      summary.byKind[capability.kind] = (summary.byKind[capability.kind] ?? 0) + 1;
      summary.byRisk[capability.risk] = (summary.byRisk[capability.risk] ?? 0) + 1;
      summary.byGovernance[capability.governance] = (summary.byGovernance[capability.governance] ?? 0) + 1;
      if (capability.requiresApproval) {
        summary.requiresApproval += 1;
      }
      return summary;
    }, {
      total: 0,
      online: 0,
      degraded: 0,
      offline: 0,
      unknown: 0,
      requiresApproval: 0,
      byKind: {},
      byRisk: {},
      byGovernance: {},
    });
  }

  function normaliseCapabilityInvokeRequest(body = {}) {
    const capabilityId =
      typeof body.capabilityId === "string" && body.capabilityId.trim()
        ? body.capabilityId.trim()
        : typeof body.id === "string" && body.id.trim()
          ? body.id.trim()
          : "";
    const params = body.params && typeof body.params === "object" ? body.params : {};
    return {
      capabilityId,
      taskId: typeof body.taskId === "string" && body.taskId.trim() ? body.taskId.trim() : null,
      stepId: typeof body.stepId === "string" && body.stepId.trim() ? body.stepId.trim() : null,
      params,
      operation: typeof body.operation === "string" && body.operation.trim() ? body.operation.trim() : null,
      intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : null,
      approved: body.approved === true || body.policy?.approved === true,
      claimedApproved: body.approved === true || body.policy?.approved === true,
      policy: body.policy && typeof body.policy === "object" ? body.policy : {},
    };
  }

  function buildCapabilityPolicyInput(capability, request) {
    const intent = capabilityRequestIntent(capability, request);
    const preferredDomain = capability.domains?.includes("cross_boundary")
      && !capability.domains?.includes("body_internal")
      ? "cross_boundary"
      : capability.domains?.[0] ?? "body_internal";
    return {
      type: "capability_invoke",
      taskId: request.taskId ?? null,
      intent,
      domain: request.policy.domain ?? preferredDomain,
      risk: request.policy.risk ?? capability.risk,
      requiresApproval:
        request.policy.requiresApproval === true
        || capability.requiresApproval === true
        || capability.governance === "require_approval",
      approved: request.approved,
      policy: {
        ...request.policy,
        intent,
        domain: request.policy.domain ?? preferredDomain,
        risk: request.policy.risk ?? capability.risk,
        requiresApproval:
          request.policy.requiresApproval === true
          || capability.requiresApproval === true
          || capability.governance === "require_approval",
        approved: request.approved,
      },
    };
  }

  function buildSystemSenseUrl(pathname, params = {}) {
    const url = new URL(pathname, systemSenseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  async function callCapabilityBackend(capability, request) {
    const engineeringToolSurface = engineeringToolSurfaceHandlers.callBackend(capability, request);
    if (engineeringToolSurface.handled) {
      return engineeringToolSurface.result;
    }
    const engineeringReadSearch = engineeringReadSearchHandlers.callBackend(capability, request);
    if (engineeringReadSearch.handled) {
      return engineeringReadSearch.result;
    }
    const engineeringLsp = engineeringLspHandlers.callBackend(capability, request);
    if (engineeringLsp.handled) {
      return engineeringLsp.result;
    }
    const engineeringVerification = engineeringVerificationHandlers.callBackend(capability, request);
    if (engineeringVerification.handled) {
      return engineeringVerification.result;
    }
    const engineeringRecovery = engineeringRecoveryHandlers.callBackend(capability, request);
    if (engineeringRecovery.handled) {
      return engineeringRecovery.result;
    }
    const engineeringMicrocompact = await engineeringMicrocompactHandlers.callBackend(capability, request);
    if (engineeringMicrocompact.handled) {
      return engineeringMicrocompact.result;
    }
    const engineeringProposal = engineeringProposalHandlers.callBackend(capability, request);
    if (engineeringProposal.handled) {
      return engineeringProposal.result;
    }
    const engineeringExecutionEvidence = engineeringExecutionEvidenceHandlers.callBackend(capability, request);
    if (engineeringExecutionEvidence.handled) {
      return engineeringExecutionEvidence.result;
    }
    const engineeringContext = await engineeringContextHandlers.callBackend(capability, request);
    if (engineeringContext.handled) {
      return engineeringContext.result;
    }
    const engineeringPlanTodo = await engineeringPlanTodoHandlers.callBackend(capability, request);
    if (engineeringPlanTodo.handled) {
      return engineeringPlanTodo.result;
    }
    const engineeringWorkView = await engineeringWorkViewHandlers.callBackend(capability, request);
    if (engineeringWorkView.handled) {
      return engineeringWorkView.result;
    }
    const pluginRuntimeRefresh = await pluginRuntimeRefreshHandlers.callBackend(capability, request);
    if (pluginRuntimeRefresh.handled) {
      return pluginRuntimeRefresh.result;
    }
    const engineeringProviderHandoff = await engineeringProviderHandoffHandlers.callBackend(capability, request);
    if (engineeringProviderHandoff.handled) {
      return engineeringProviderHandoff.result;
    }
    const acpxCodexCompatibility = acpxCodexCompatibilityHandlers.callBackend(capability, request);
    if (acpxCodexCompatibility.handled) {
      return acpxCodexCompatibility.result;
    }
    const pluginSearchWebContract = pluginSearchWebContractHandlers.callBackend(capability, request);
    if (pluginSearchWebContract.handled) {
      return pluginSearchWebContract.result;
    }
    const promptPack = promptPackHandlers.callBackend(capability, request);
    if (promptPack.handled) {
      return promptPack.result;
    }
    const workspaceEditTarget = workspaceEditTargetHandlers.callBackend(capability, request);
    if (workspaceEditTarget.handled) {
      return workspaceEditTarget.result;
    }
    const workspaceMutation = await workspaceMutationHandlers.callBackend(capability, request);
    if (workspaceMutation.handled) {
      return workspaceMutation.result;
    }
    const screenObservation = await screenObservationHandlers.callBackend(capability, request);
    if (screenObservation.handled) {
      return screenObservation.result;
    }
    const browserAction = await browserActionHandlers.callBackend(capability, request);
    if (browserAction.handled) {
      return browserAction.result;
    }
    const screenAction = await screenActionHandlers.callBackend(capability, request);
    if (screenAction.handled) {
      return screenAction.result;
    }
    const declarativeEvolution = await declarativeEvolutionHandlers.callBackend(capability, request);
    if (declarativeEvolution.handled) {
      return declarativeEvolution.result;
    }

    if (capability.id === "sense.system.vitals") {
      return fetchJson(`${systemSenseUrl}/system/health`);
    }

    if (capability.id === "sense.filesystem.read") {
      const operation = request.operation ?? request.params.operation ?? "list";
      if (operation === "read_text" || operation === "read-text") {
        return fetchJson(buildSystemSenseUrl("/system/files/read-text", {
          path: request.params.path,
        }));
      }
      if (operation === "metadata") {
        return fetchJson(buildSystemSenseUrl("/system/files/metadata", {
          path: request.params.path,
        }));
      }
      if (operation === "search") {
        return fetchJson(buildSystemSenseUrl("/system/files/search", {
          path: request.params.path,
          query: request.params.query ?? request.params.q,
          limit: request.params.limit,
        }));
      }
      return fetchJson(buildSystemSenseUrl("/system/files/list", {
        path: request.params.path,
        limit: request.params.limit,
      }));
    }

    if (capability.id === "act.filesystem.write_text") {
      return postJson(`${systemSenseUrl}/system/files/write-text`, {
        ...request.params,
        intent: request.intent ?? "filesystem.write",
      });
    }

    if (capability.id === "act.filesystem.append_text") {
      return postJson(`${systemSenseUrl}/system/files/append-text`, {
        ...request.params,
        intent: request.intent ?? "filesystem.append",
      });
    }

    if (capability.id === "act.filesystem.mkdir") {
      return postJson(`${systemSenseUrl}/system/files/mkdir`, {
        ...request.params,
        intent: request.intent ?? "filesystem.mkdir",
      });
    }

    if (capability.id === "sense.process.list") {
      return fetchJson(buildSystemSenseUrl("/system/processes", {
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      }));
    }

    if (capability.id === "sense.plugin.manifest_profile") {
      return buildNativePluginManifestProfile({
        packagePath: request.params.packagePath,
      });
    }

    if (capability.id === "sense.openclaw.tool_catalog") {
      return buildNativeOpenClawToolCatalogProfile({
        workspacePath: request.params.workspacePath,
        category: request.params.category,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      });
    }

    if (capability.id === "sense.openclaw.workspace_semantic_index") {
      return buildNativeOpenClawWorkspaceSemanticIndex({
        workspacePath: request.params.workspacePath,
        scope: request.params.scope,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      });
    }

    if (capability.id === "sense.openclaw.workspace_symbol_lookup") {
      return buildNativeOpenClawWorkspaceSymbolLookup({
        workspacePath: request.params.workspacePath,
        scope: request.params.scope,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      });
    }

    if (capability.id === "sense.openclaw.plugin_manifest_map") {
      return buildOpenClawPluginManifestMap({
        workspacePath: request.params.workspacePath,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      });
    }

    if (capability.id === "plan.openclaw.plugin_capability") {
      return buildOpenClawPluginCapabilityPlan({
        workspacePath: request.params.workspacePath,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      });
    }

    if (capability.id === "act.system.command.dry_run") {
      return postJson(`${systemSenseUrl}/system/command/dry-run`, {
        ...request.params,
        intent: request.intent ?? "system.command",
      });
    }

    if (capability.id === "act.system.command.execute") {
      return postJson(`${systemSenseUrl}/system/command/execute`, {
        ...request.params,
        intent: request.intent ?? "system.command.execute",
      });
    }

    if (capability.id === "act.system.heal") {
      const operation = request.operation ?? request.params.operation ?? request.intent ?? "heal.autofix";
      if (operation === "heal.diagnose" || operation === "diagnose") {
        return postJson(`${systemHealUrl}/heal/diagnose`, request.params);
      }
      if (operation === "heal.restart-service" || operation === "restart-service") {
        return postJson(`${systemHealUrl}/heal/restart-service`, request.params);
      }
      if (operation === "heal.maintenance" || operation === "maintenance" || operation === "system.repair") {
        return postJson(`${systemHealUrl}/maintenance/run`, request.params);
      }
      if (operation === "heal.maintenance.tick" || operation === "maintenance.tick" || operation === "tick") {
        return postJson(`${systemHealUrl}/maintenance/tick`, request.params);
      }
      return postJson(`${systemHealUrl}/heal/autofix`, request.params);
    }

    throw new Error(`Capability ${capability.id} is not invokable through core-v0.`);
  }

  function requestOperationFromResult(result) {
    if (result?.mode === "read_text") {
      return "read_text";
    }
    if (result?.metadata) {
      return "metadata";
    }
    if (Array.isArray(result?.results)) {
      return "search";
    }
    if (Array.isArray(result?.entries)) {
      return "list";
    }
    return "read";
  }

  function summariseCapabilityInvocationResult(capability, result) {
    const engineeringToolSurfaceSummary = engineeringToolSurfaceHandlers.summariseResult(capability, result);
    if (engineeringToolSurfaceSummary) {
      return engineeringToolSurfaceSummary;
    }
    const engineeringReadSearchSummary = engineeringReadSearchHandlers.summariseResult(capability, result);
    if (engineeringReadSearchSummary) {
      return engineeringReadSearchSummary;
    }
    const engineeringLspSummary = engineeringLspHandlers.summariseResult(capability, result);
    if (engineeringLspSummary) {
      return engineeringLspSummary;
    }
    const engineeringVerificationSummary = engineeringVerificationHandlers.summariseResult(capability, result);
    if (engineeringVerificationSummary) {
      return engineeringVerificationSummary;
    }
    const engineeringRecoverySummary = engineeringRecoveryHandlers.summariseResult(capability, result);
    if (engineeringRecoverySummary) {
      return engineeringRecoverySummary;
    }
    const engineeringMicrocompactSummary = engineeringMicrocompactHandlers.summariseResult(capability, result);
    if (engineeringMicrocompactSummary) {
      return engineeringMicrocompactSummary;
    }
    const engineeringProposalSummary = engineeringProposalHandlers.summariseResult(capability, result);
    if (engineeringProposalSummary) {
      return engineeringProposalSummary;
    }
    const engineeringExecutionEvidenceSummary = engineeringExecutionEvidenceHandlers.summariseResult(capability, result);
    if (engineeringExecutionEvidenceSummary) {
      return engineeringExecutionEvidenceSummary;
    }
    const engineeringContextSummary = engineeringContextHandlers.summariseResult(capability, result);
    if (engineeringContextSummary) {
      return engineeringContextSummary;
    }
    const engineeringPlanTodoSummary = engineeringPlanTodoHandlers.summariseResult(capability, result);
    if (engineeringPlanTodoSummary) {
      return engineeringPlanTodoSummary;
    }
    const engineeringWorkViewSummary = engineeringWorkViewHandlers.summariseResult(capability, result);
    if (engineeringWorkViewSummary) {
      return engineeringWorkViewSummary;
    }
    const pluginRuntimeRefreshSummary = pluginRuntimeRefreshHandlers.summariseResult(capability, result);
    if (pluginRuntimeRefreshSummary) {
      return pluginRuntimeRefreshSummary;
    }
    const engineeringProviderHandoffSummary = engineeringProviderHandoffHandlers.summariseResult(capability, result);
    if (engineeringProviderHandoffSummary) {
      return engineeringProviderHandoffSummary;
    }
    const acpxCodexCompatibilitySummary = acpxCodexCompatibilityHandlers.summariseResult(capability, result);
    if (acpxCodexCompatibilitySummary) {
      return acpxCodexCompatibilitySummary;
    }
    const pluginSearchWebContractSummary = pluginSearchWebContractHandlers.summariseResult(capability, result);
    if (pluginSearchWebContractSummary) {
      return pluginSearchWebContractSummary;
    }
    const promptPackSummary = promptPackHandlers.summariseResult(capability, result);
    if (promptPackSummary) {
      return promptPackSummary;
    }
    const workspaceEditTargetSummary = workspaceEditTargetHandlers.summariseResult(capability, result);
    if (workspaceEditTargetSummary) {
      return workspaceEditTargetSummary;
    }
    const workspaceMutationSummary = workspaceMutationHandlers.summariseResult(capability, result);
    if (workspaceMutationSummary) {
      return workspaceMutationSummary;
    }
    const screenObservationSummary = screenObservationHandlers.summariseResult(capability, result);
    if (screenObservationSummary) {
      return screenObservationSummary;
    }
    const browserActionSummary = browserActionHandlers.summariseResult(capability, result);
    if (browserActionSummary) {
      return browserActionSummary;
    }
    const screenActionSummary = screenActionHandlers.summariseResult(capability, result);
    if (screenActionSummary) {
      return screenActionSummary;
    }
    const declarativeEvolutionSummary = declarativeEvolutionHandlers.summariseResult(capability, result);
    if (declarativeEvolutionSummary) {
      return declarativeEvolutionSummary;
    }

    if (capability.id === "sense.system.vitals") {
      return {
        kind: "system.vitals",
        ok: result?.ok === true,
        alerts: result?.system?.alerts?.length ?? 0,
        services: Object.keys(result?.system?.services ?? {}).length,
      };
    }
    if (capability.id === "sense.filesystem.read") {
      const operation = result?.mode === "read_text"
        ? "read_text"
        : requestOperationFromResult(result);
      if (result?.mode === "read_text") {
        return {
          kind: "filesystem.read_text",
          ok: result?.ok === true,
          path: result?.path ?? null,
          contentBytes: result?.contentBytes ?? null,
          encoding: result?.encoding ?? null,
          operation,
        };
      }
      return {
        kind: "filesystem.read",
        ok: result?.ok === true,
        count: result?.count ?? (result?.metadata ? 1 : 0),
        path: result?.path ?? null,
        operation,
      };
    }
    if (capability.id === "act.filesystem.write_text") {
      return {
        kind: "filesystem.write_text",
        ok: result?.ok === true,
        path: result?.path ?? null,
        contentBytes: result?.contentBytes ?? null,
        overwrite: result?.overwrite ?? null,
      };
    }
    if (capability.id === "act.filesystem.append_text") {
      return {
        kind: "filesystem.append_text",
        ok: result?.ok === true,
        path: result?.path ?? null,
        contentBytes: result?.contentBytes ?? null,
        previousBytes: result?.previousBytes ?? null,
        totalBytes: result?.totalBytes ?? null,
      };
    }
    if (capability.id === "act.filesystem.mkdir") {
      return {
        kind: "filesystem.mkdir",
        ok: result?.ok === true,
        path: result?.path ?? null,
        created: result?.created ?? null,
        recursive: result?.recursive ?? null,
      };
    }
    if (capability.id === "sense.process.list") {
      return {
        kind: "process.list",
        ok: result?.ok === true,
        count: result?.count ?? 0,
      };
    }
    if (capability.id === "sense.plugin.manifest_profile") {
      return {
        kind: "plugin.manifest_profile",
        ok: result?.ok === true,
        pluginId: result?.plugin?.id ?? null,
        packageName: result?.plugin?.packageName ?? null,
        exportKeys: result?.plugin?.exportKeys?.length ?? 0,
        scriptNames: result?.plugin?.scriptNames?.length ?? 0,
        capabilities: Array.isArray(result?.capabilities) ? result.capabilities.length : 0,
        canExecutePluginCode: result?.governance?.canExecutePluginCode === true,
      };
    }
    if (capability.id === "sense.openclaw.tool_catalog") {
      return {
        kind: "openclaw.tool_catalog",
        ok: result?.ok === true,
        totalTools: result?.summary?.totalTools ?? 0,
        matchedTools: result?.summary?.matchedTools ?? 0,
        categories: result?.summary?.categoryCount ?? 0,
        filterApplied: result?.summary?.filterApplied === true,
        canExecuteToolCode: result?.governance?.canExecuteToolCode === true,
      };
    }
    if (capability.id === "sense.openclaw.workspace_semantic_index") {
      return {
        kind: "openclaw.workspace_semantic_index",
        ok: result?.ok === true,
        scope: result?.scope?.id ?? null,
        totalFiles: result?.summary?.totalFiles ?? 0,
        contentRead: result?.summary?.contentRead ?? 0,
        exportStatements: result?.summary?.exportStatements ?? 0,
        functionDeclarations: result?.summary?.functionDeclarations ?? 0,
        semanticVocabularyFiles: result?.summary?.semanticVocabularyFiles ?? 0,
        exposesSourceFileContent: result?.governance?.exposesSourceFileContent === true,
        canExecuteToolCode: result?.governance?.canExecuteToolCode === true,
      };
    }
    if (capability.id === "sense.openclaw.workspace_symbol_lookup") {
      return {
        kind: "openclaw.workspace_symbol_lookup",
        ok: result?.ok === true,
        query: result?.query?.text ?? null,
        scope: result?.query?.scope ?? null,
        matchedSymbols: result?.summary?.matchedSymbols ?? 0,
        filesScanned: result?.summary?.filesScanned ?? 0,
        declarationsScanned: result?.summary?.declarationsScanned ?? 0,
        canExecuteQuery: result?.governance?.canExecuteQuery === true,
        exposesSourceFileContent: result?.governance?.exposesSourceFileContent === true,
        exposesFunctionBodies: result?.governance?.exposesFunctionBodies === true,
        canExecuteToolCode: result?.governance?.canExecuteToolCode === true,
      };
    }
    if (capability.id === "act.system.command.dry_run") {
      return {
        kind: "command.dry_run",
        ok: result?.ok === true,
        risk: result?.plan?.risk ?? null,
        governance: result?.plan?.governance ?? null,
        wouldExecute: result?.plan?.wouldExecute ?? null,
      };
    }
    if (capability.id === "act.system.command.execute") {
      return {
        kind: "command.execute",
        ok: result?.ok === true,
        risk: result?.execution?.risk ?? null,
        governance: result?.execution?.governance ?? null,
        wouldExecute: result?.execution?.wouldExecute ?? null,
        exitCode: result?.execution?.result?.exitCode ?? null,
        timedOut: result?.execution?.result?.timedOut ?? null,
        stdout: result?.execution?.result?.stdout ?? "",
        stderr: result?.execution?.result?.stderr ?? "",
      };
    }
    if (capability.id === "act.system.heal") {
      const run = result?.run ?? null;
      const diagnosis = run?.diagnosis ?? result?.diagnosis ?? null;
      const executed = run?.executed ?? result?.executed ?? [];
      const skipped = run?.skipped ?? result?.skipped ?? [];
      const healEntries = [
        ...(Array.isArray(executed) ? executed : []),
        ...(Array.isArray(skipped) ? skipped : []),
        ...(result?.entry ? [result.entry] : []),
      ];
      return {
        kind: run ? "maintenance.run" : "system.heal",
        ok: result?.ok === true,
        status: result?.tick?.status ?? run?.status ?? diagnosis?.status ?? null,
        diagnosisStatus: diagnosis?.status ?? null,
        planSteps: diagnosis?.plan?.stepCount ?? 0,
        executed: Array.isArray(executed) ? executed.length : 0,
        skipped: Array.isArray(skipped) ? skipped.length : 0,
        maintenanceRunId: run?.id ?? null,
        tickReason: result?.tick?.reason ?? null,
        nextDueAt: result?.policy?.nextDueAt ?? null,
        noHostMutation: healEntries.every((entry) => entry?.mode === "simulated" || entry?.mode === "audit_only"),
        noProviderEgress: true,
      };
    }
    return {
      kind: capability.id,
      ok: result?.ok === true,
    };
  }

  function recordCapabilityInvocation({ capability, request, policy, invoked, blocked, reason = null, summary = null }) {
    const entry = {
      id: createId(),
      at: now(),
      capability: {
        id: capability.id,
        name: capability.name,
        kind: capability.kind,
        service: capability.service,
        risk: capability.risk,
        governance: capability.governance,
      },
      request: {
        taskId: request.taskId ?? null,
        stepId: request.stepId ?? null,
        operation: request.operation ?? request.params?.operation ?? null,
        intent: capabilityRequestIntent(capability, request),
        approved: request.approved === true,
        claimedApproved: request.claimedApproved === true,
        command: typeof request.params?.command === "string" ? request.params.command : null,
        cwd: typeof request.params?.cwd === "string" ? request.params.cwd : typeof request.params?.workingDirectory === "string" ? request.params.workingDirectory : null,
        path: typeof request.params?.path === "string" ? request.params.path : null,
      },
      policy: {
        id: policy.id,
        decision: policy.decision,
        domain: policy.domain,
        risk: policy.risk,
        reason: policy.reason,
        approved: policy.approved,
        autonomyMode: policy.autonomyMode,
        autonomous: policy.autonomous === true,
      },
      authorization: request.serverApproval ?? null,
      invoked: invoked === true,
      blocked: blocked === true,
      reason,
      summary,
    };
    capabilityInvocationLog.push(entry);
    if (capabilityInvocationLog.length > MAX_CAPABILITY_INVOCATION_ENTRIES) {
      capabilityInvocationLog.splice(0, capabilityInvocationLog.length - MAX_CAPABILITY_INVOCATION_ENTRIES);
    }
    persistState();
    return entry;
  }

  function listCapabilityInvocations({ limit = 20, capabilityId = null } = {}) {
    const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
    return capabilityInvocationLog
      .filter((entry) => !capabilityId || entry.capability?.id === capabilityId)
      .slice()
      .sort((left, right) => String(right.at).localeCompare(String(left.at)))
      .slice(0, safeLimit);
  }

  function buildCapabilityInvocationSummary() {
    return capabilityInvocationLog.reduce((summary, entry) => {
      summary.total += 1;
      if (entry.invoked) {
        summary.invoked += 1;
      }
      if (entry.blocked) {
        summary.blocked += 1;
      }
      const capabilityId = entry.capability?.id ?? "unknown";
      summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
      const decision = entry.policy?.decision ?? "unknown";
      summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
      if (!summary.latestAt || String(entry.at).localeCompare(summary.latestAt) > 0) {
        summary.latestAt = entry.at;
      }
      return summary;
    }, {
      total: 0,
      invoked: 0,
      blocked: 0,
      latestAt: null,
      byCapability: {},
      byPolicy: {},
    });
  }

  async function invokeCapability(body = {}) {
    const request = normaliseCapabilityInvokeRequest(body);
    if (!request.capabilityId) {
      return {
        statusCode: 400,
        response: { ok: false, error: "capabilityId is required." },
      };
    }

    const capability = capabilityById(request.capabilityId);
    if (!capability) {
      return {
        statusCode: 404,
        response: { ok: false, error: "Capability not found." },
      };
    }

    const serverApproval = validateCapabilityExecutionApproval({
      capability,
      request,
      tasks,
      approvals,
      persistState,
      reserve: true,
    });
    request.approved = serverApproval.approved;
    request.serverApproval = serverApproval;

    const engineeringWorkViewValidationError = engineeringWorkViewHandlers.validateRequest(capability, request);
    if (engineeringWorkViewValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringWorkViewValidationError },
      };
    }
    const engineeringContextValidationError = engineeringContextHandlers.validateRequest(capability, request);
    if (engineeringContextValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringContextValidationError },
      };
    }
    const engineeringPlanTodoValidationError = engineeringPlanTodoHandlers.validateRequest(capability, request);
    if (engineeringPlanTodoValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringPlanTodoValidationError },
      };
    }
    const engineeringRecoveryValidationError = engineeringRecoveryHandlers.validateRequest(capability, request);
    if (engineeringRecoveryValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringRecoveryValidationError },
      };
    }
    const engineeringMicrocompactValidationError = engineeringMicrocompactHandlers.validateRequest(capability, request);
    if (engineeringMicrocompactValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringMicrocompactValidationError },
      };
    }
    const engineeringLspValidationError = engineeringLspHandlers.validateRequest(capability, request);
    if (engineeringLspValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringLspValidationError },
      };
    }
    const pluginRuntimeRefreshValidationError = pluginRuntimeRefreshHandlers.validateRequest(capability, request);
    if (pluginRuntimeRefreshValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: pluginRuntimeRefreshValidationError },
      };
    }
    const engineeringProviderHandoffValidationError = engineeringProviderHandoffHandlers.validateRequest(capability, request);
    if (engineeringProviderHandoffValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: engineeringProviderHandoffValidationError },
      };
    }
    const acpxCodexCompatibilityValidationError = acpxCodexCompatibilityHandlers.validateRequest(capability, request);
    if (acpxCodexCompatibilityValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: acpxCodexCompatibilityValidationError },
      };
    }
    const workspaceMutationValidationError = workspaceMutationHandlers.validateRequest(capability, request);
    if (workspaceMutationValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: workspaceMutationValidationError },
      };
    }
    const screenObservationValidationError = screenObservationHandlers.validateRequest(capability, request);
    if (screenObservationValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: screenObservationValidationError },
      };
    }
    const browserActionValidationError = browserActionHandlers.validateRequest(capability, request);
    if (browserActionValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: browserActionValidationError },
      };
    }
    const screenActionValidationError = screenActionHandlers.validateRequest(capability, request);
    if (screenActionValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: screenActionValidationError },
      };
    }
    const declarativeEvolutionValidationError = declarativeEvolutionHandlers.validateRequest(capability, request);
    if (declarativeEvolutionValidationError) {
      return {
        statusCode: 400,
        response: { ok: false, error: declarativeEvolutionValidationError },
      };
    }

    const policy = recordPolicyDecision(evaluatePolicyIntent(
      buildCapabilityPolicyInput(capability, request),
      {
        stage: "capability.invoke",
        type: "capability_invoke",
        goal: `Invoke ${capability.id}`,
      },
    ));
    await publishEvent(createEventName("policy.evaluated"), { capability, policy });

    if (!serverApproval.ok || !isPolicyExecutionAllowed(policy)) {
      const reason = !serverApproval.ok
        ? serverApproval.reason
        : policy.decision === "deny" ? "policy_denied" : "policy_requires_approval";
      const invocation = recordCapabilityInvocation({
        capability,
        request,
        policy,
        invoked: false,
        blocked: true,
        reason,
        summary: {
          kind: capability.id,
          ok: false,
        },
      });
      await publishEvent(createEventName("capability.blocked"), {
        invocation,
        capability,
        policy,
        reason: policy.reason,
      });
      return {
        statusCode: 200,
        response: {
          ok: true,
          invoked: false,
          blocked: true,
          reason,
          capability,
          policy,
          invocation,
        },
      };
    }

    const result = await callCapabilityBackend(capability, request);
    const summary = summariseCapabilityInvocationResult(capability, result);
    const invocation = recordCapabilityInvocation({
      capability,
      request,
      policy,
      invoked: true,
      blocked: false,
      summary,
    });
    await publishEvent(createEventName("capability.invoked"), {
      invocation,
      capability,
      policy,
      summary,
    });
    return {
      statusCode: 200,
      response: {
        ok: true,
        invoked: true,
        blocked: false,
        capability,
        policy,
        summary,
        invocation,
        result,
      },
    };
  }

  async function buildCapabilityRegistry() {
    const serviceNames = [...new Set(baseCapabilities().map((capability) => capability.service))];
    const healthEntries = await Promise.all(serviceNames.map(async (service) => [service, await probeServiceHealth(service)]));
    const healthByService = Object.fromEntries(healthEntries);
    const capabilities = baseCapabilities().map((capability) => {
      const health = healthByService[capability.service] ?? { ok: false, status: "unknown" };
      return {
        ...capability,
        status: health.status,
        available: health.ok === true,
        health,
      };
    });

    return {
      registry: "capability-v0",
      mode: "local-body-registry",
      generatedAt: now(),
      capabilities,
      summary: summariseCapabilities(capabilities),
    };
  }

  return {
    capabilityById,
    capabilityByIntent,
    normaliseCapabilityInvokeRequest,
    buildCapabilityPolicyInput,
    buildCapabilityRegistry,
    listCapabilityInvocations,
    buildCapabilityInvocationSummary,
    invokeCapability,
  };
}
