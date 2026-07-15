import { randomUUID } from "node:crypto";

import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildBaseCapabilities } from "./capability-descriptors.mjs";
import { createEngineeringReadSearchCapabilityHandlers } from "./capability-runtime-engineering-read-search.mjs";
import { createEngineeringVerificationCapabilityHandlers } from "./capability-runtime-engineering-verification.mjs";
import { createEngineeringWorkViewCapabilityHandlers } from "./capability-runtime-work-view.mjs";

export function createCapabilityRuntime(deps) {
  const {
    host,
    port,
    client,
    state,
    pluginReview = {},
    policyEvaluator,
    publishEvent = async () => {},
    fetchImpl = globalThis.fetch,
    createId = randomUUID,
    now = () => new Date().toISOString(),
    listCommandTranscriptRecords = () => [],
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
    buildNativeOpenClawPromptSemanticsProfile,
    buildOpenClawPluginManifestMap,
    buildOpenClawPluginCapabilityPlan,
  } = pluginReview;
  const engineeringReadSearchHandlers = createEngineeringReadSearchCapabilityHandlers({
    buildNativeEngineeringReadFile: pluginReview.buildNativeEngineeringReadFile,
    buildNativeEngineeringGlob: pluginReview.buildNativeEngineeringGlob,
    buildNativeEngineeringGrep: pluginReview.buildNativeEngineeringGrep,
  });
  const engineeringVerificationHandlers = createEngineeringVerificationCapabilityHandlers({
    listCommandTranscriptRecords,
    listCapabilityInvocations: (options) => listCapabilityInvocations(options),
    tasks: state.tasks ?? new Map(),
  });
  const engineeringWorkViewHandlers = createEngineeringWorkViewCapabilityHandlers({
    tasks: state.tasks ?? new Map(),
    sessionManagerUrl,
    fetchImpl,
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
      params,
      operation: typeof body.operation === "string" && body.operation.trim() ? body.operation.trim() : null,
      intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : null,
      approved: body.approved === true || body.policy?.approved === true,
      policy: body.policy && typeof body.policy === "object" ? body.policy : {},
    };
  }

  function buildCapabilityPolicyInput(capability, request) {
    const intent = request.intent ?? capability.intents?.[0] ?? "capability.invoke";
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
    const engineeringReadSearch = engineeringReadSearchHandlers.callBackend(capability, request);
    if (engineeringReadSearch.handled) {
      return engineeringReadSearch.result;
    }
    const engineeringVerification = engineeringVerificationHandlers.callBackend(capability, request);
    if (engineeringVerification.handled) {
      return engineeringVerification.result;
    }
    const engineeringWorkView = await engineeringWorkViewHandlers.callBackend(capability, request);
    if (engineeringWorkView.handled) {
      return engineeringWorkView.result;
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

    if (capability.id === "sense.openclaw.workspace_edit_target_select") {
      return buildNativeOpenClawWorkspaceEditTargetSelection({
        workspacePath: request.params.workspacePath,
        scope: request.params.scope,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      });
    }

    if (capability.id === "sense.openclaw.prompt_pack") {
      return buildNativeOpenClawPromptSemanticsProfile({
        workspacePath: request.params.workspacePath,
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
    const engineeringReadSearchSummary = engineeringReadSearchHandlers.summariseResult(capability, result);
    if (engineeringReadSearchSummary) {
      return engineeringReadSearchSummary;
    }
    const engineeringVerificationSummary = engineeringVerificationHandlers.summariseResult(capability, result);
    if (engineeringVerificationSummary) {
      return engineeringVerificationSummary;
    }
    const engineeringWorkViewSummary = engineeringWorkViewHandlers.summariseResult(capability, result);
    if (engineeringWorkViewSummary) {
      return engineeringWorkViewSummary;
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
        operation: request.operation ?? request.params?.operation ?? null,
        intent: request.intent ?? capability.intents?.[0] ?? null,
        approved: request.approved === true,
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

    const policy = recordPolicyDecision(evaluatePolicyIntent(
      buildCapabilityPolicyInput(capability, request),
      {
        stage: "capability.invoke",
        type: "capability_invoke",
        goal: `Invoke ${capability.id}`,
      },
    ));
    await publishEvent(createEventName("policy.evaluated"), { capability, policy });

    if (!isPolicyExecutionAllowed(policy)) {
      const reason = policy.decision === "deny" ? "policy_denied" : "policy_requires_approval";
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
