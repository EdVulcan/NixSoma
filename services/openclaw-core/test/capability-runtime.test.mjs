import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";
import { buildCapabilityApprovalBinding } from "../src/capability-runtime-approval-binding.mjs";

function createHarness(overrides = {}) {
  const events = [];
  const calls = {
    fetchJson: [],
    postJson: [],
    health: [],
  };
  const state = {
    capabilityInvocationLog: [],
    MAX_CAPABILITY_INVOCATION_ENTRIES: 3,
    CAPABILITY_HEALTH_TIMEOUT_MS: 50,
    CROSS_BOUNDARY_INTENTS: new Set(["cloud.provider.send"]),
    persistState: () => {
      calls.persisted = (calls.persisted ?? 0) + 1;
    },
    ...overrides.state,
  };
  const client = {
    eventHubUrl: "http://127.0.0.1:4101",
    sessionManagerUrl: "http://127.0.0.1:4102",
    browserRuntimeUrl: "http://127.0.0.1:4103",
    screenSenseUrl: "http://127.0.0.1:4104",
    screenActUrl: "http://127.0.0.1:4105",
    systemSenseUrl: "http://127.0.0.1:4106",
    systemHealUrl: "http://127.0.0.1:4107",
    fetchJson: async (url) => {
      calls.fetchJson.push(url);
      return overrides.fetchJsonResult ?? { ok: true, mode: "read_text", path: "/tmp/a", contentBytes: 8 };
    },
    postJson: async (url, body) => {
      calls.postJson.push({ url, body });
      return overrides.postJsonResult ?? { ok: true };
    },
    ...overrides.client,
  };
  const policyEvaluator = {
    evaluatePolicyIntent: (input, context) => ({
      id: "policy-evaluated",
      input,
      context,
      decision: "audit_only",
      domain: input.domain,
      risk: input.risk,
      reason: "body_internal_audit",
      approved: input.approved,
      autonomyMode: "guardian",
      autonomous: false,
      ...overrides.policyDecision,
    }),
    recordPolicyDecision: (decision) => ({ ...decision, id: decision.id ?? "policy-recorded" }),
    isPolicyExecutionAllowed: (decision) => decision.decision !== "deny" && decision.decision !== "require_approval",
    ...overrides.policyEvaluator,
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4100,
    client,
    state,
    taskManager: overrides.taskManager ?? {},
    pluginReview: {
      buildNativePluginManifestProfile: () => ({ ok: true, plugin: { id: "plugin-a" }, capabilities: [] }),
      buildNativeOpenClawToolCatalogProfile: () => ({ ok: true, summary: {} }),
      buildNativeOpenClawWorkspaceSemanticIndex: () => ({ ok: true, summary: {}, governance: {} }),
      buildNativeOpenClawWorkspaceSymbolLookup: () => ({ ok: true, summary: {}, query: {}, governance: {} }),
      buildNativeOpenClawWorkspaceEditTargetSelection: () => ({ ok: true }),
      buildNativeOpenClawPromptSemanticsProfile: () => ({ ok: true }),
      buildOpenClawPluginManifestMap: () => ({ ok: true }),
      buildOpenClawPluginCapabilityPlan: () => ({ ok: true }),
      buildNativeDeclarativeEvolutionCandidate: async ({ changes }) => ({
        ok: true,
        registry: "openclaw-native-declarative-evolution-candidate-v0",
        candidateStatus: "validated",
        target: { path: "/etc/nixos/openclaw-managed.nix" },
        changes,
        candidateText: "secret candidate body must remain transient",
        candidateHash: "candidate-hash",
        candidateBytes: 64,
        validation: { status: "passed", mode: "test-validator" },
        governance: {
          writesManagedConfig: false,
          switchesGeneration: false,
          executesRollback: false,
          createsTask: false,
          createsApproval: false,
          callsProvider: false,
          networkEgress: false,
        },
      }),
      ...overrides.pluginReview,
    },
    declarativeEvolution: overrides.declarativeEvolution ?? {
      createNativeDeclarativeEvolutionStagingTask: overrides.pluginReview?.createNativeDeclarativeEvolutionStagingTask,
    },
    policyEvaluator,
    publishEvent: async (name, body) => {
      events.push({ name, body });
    },
    readWorkViewState: overrides.readWorkViewState,
    listCommandTranscriptRecords: overrides.listCommandTranscriptRecords ?? (() => []),
    listFilesystemChangeRecords: overrides.listFilesystemChangeRecords ?? (() => []),
    buildExperienceMemoryReadModel: overrides.buildExperienceMemoryReadModel ?? (() => null),
    fetchImpl: overrides.fetchImpl ?? (async (url) => {
      calls.health.push(url);
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ ok: true, service: url.includes("4106") ? "openclaw-system-sense" : "test-service" }),
      };
    }),
    createId: () => `id-${(calls.ids = (calls.ids ?? 0) + 1)}`,
    now: () => "2026-07-08T00:00:00.000Z",
  });

  return { runtime, state, events, calls };
}

test("capability runtime builds the local body registry with service health", async () => {
  const { runtime, calls } = createHarness();

  const registry = await runtime.buildCapabilityRegistry();

  assert.equal(registry.registry, "capability-v0");
  assert.equal(registry.mode, "local-body-registry");
  assert.equal(registry.generatedAt, "2026-07-08T00:00:00.000Z");
  assert.ok(registry.summary.total > 20);
  assert.ok(registry.summary.online > 0);
  assert.equal(registry.capabilities.find((capability) => capability.id === "sense.system.vitals")?.available, true);
  assert.equal(
    registry.capabilities.find((capability) => capability.id === "sense.screen.observe")?.endpoint,
    "http://127.0.0.1:4104/screen/current",
  );
  assert.equal(runtime.capabilityByIntent("cloud.provider.send")?.id, "boundary.cross_domain.approval");
  assert.ok(calls.health.some((url) => url === "http://127.0.0.1:4106/health"));
});

test("capability runtime generates a validated managed Nix candidate without host mutation", async () => {
  const { runtime, state, events } = createHarness();

  const result = await runtime.invokeCapability({
    capabilityId: "plan.openclaw.declarative_evolution.managed_config_candidate",
    intent: "declarative.evolution.managed_config_candidate",
    params: {
      changes: [{ operation: "enable_component", component: "systemSense" }],
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.capability.id, "plan.openclaw.declarative_evolution.managed_config_candidate");
  assert.equal(result.response.summary.kind, "declarative_evolution.managed_config_candidate");
  assert.equal(result.response.summary.validationStatus, "passed");
  assert.equal(result.response.summary.noManagedConfigWrite, true);
  assert.equal(result.response.summary.noGenerationSwitch, true);
  assert.equal(result.response.summary.noRollback, true);
  assert.equal(result.response.summary.candidateTextInSummary, false);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("secret candidate body"), false);
  assert.deepEqual(events.slice(-2).map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime creates a hash-bound declarative evolution staging task only after confirmation", async () => {
  const candidateHash = "a".repeat(64);
  const calls = [];
  const { runtime, events } = createHarness({
    pluginReview: {
      createNativeDeclarativeEvolutionStagingTask: async (input) => {
        calls.push(input);
        return {
          ok: true,
          registry: "openclaw-native-declarative-evolution-staging-task-v0",
          candidate: { candidateHash },
          approvalBinding: { candidateHash },
          task: { id: "task-staging", status: "queued" },
          approval: { id: "approval-staging", status: "pending" },
          governance: {
            createsTask: true,
            createsApproval: true,
            canExecuteWithoutApproval: false,
            writesManagedConfig: false,
            switchesGeneration: false,
            executesRollback: false,
            networkEgress: false,
          },
        };
      },
    },
  });
  const changes = [{ operation: "enable_component", component: "systemSense" }];

  const unconfirmed = await runtime.invokeCapability({
    capabilityId: "act.openclaw.declarative_evolution.staging_task",
    params: { changes, confirm: false },
  });
  assert.equal(unconfirmed.response.invoked, true);
  assert.equal(unconfirmed.response.result.reason, "operator_confirmation_required");
  assert.equal(calls.length, 0);

  const confirmed = await runtime.invokeCapability({
    capabilityId: "act.openclaw.declarative_evolution.staging_task",
    params: { changes, confirm: true },
  });
  assert.equal(confirmed.response.invoked, true);
  assert.equal(confirmed.response.result.approvalBinding.candidateHash, candidateHash);
  assert.equal(confirmed.response.summary.kind, "declarative_evolution.staging_task");
  assert.equal(confirmed.response.summary.createsTask, true);
  assert.equal(confirmed.response.summary.createsApproval, true);
  assert.equal(confirmed.response.summary.noManagedConfigWrite, true);
  assert.equal(confirmed.response.summary.noGenerationSwitch, true);
  assert.equal(confirmed.response.summary.noRollback, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { changes, confirm: true });
  assert.equal(JSON.stringify(events).includes(candidateHash), true);
});

test("capability runtime exposes the read-only declarative evolution health gate and fails closed without taskId", async () => {
  const candidateHash = "a".repeat(64);
  const calls = [];
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeDeclarativeEvolutionHealthGate: async (input) => {
        calls.push(input);
        return {
          ok: true,
          blocked: false,
          registry: "openclaw-native-declarative-evolution-health-gate-v0",
          taskId: input.taskId,
          candidate: { candidateHash },
          staging: { fileHash: candidateHash, fileBytes: 64 },
          evaluatedClosure: { path: "/nix/store/abc123-openclaw-system", status: "bound" },
          closureIntegrity: {
            status: "verified",
            receipt: { receiptHash: "d".repeat(64) },
          },
          failedChecks: [],
          assessment: {
            status: "eligible_for_activation_review",
            eligibleForActivationReview: true,
            hostHealth: "not_assessed",
          },
          governance: {
            readsStagingFile: true,
            readsCurrentApprovalRecord: true,
            requeriesStoreOutput: true,
            emitsImmutableClosureReceipt: true,
            writesManagedConfig: false,
            switchesGeneration: false,
            executesRollback: false,
            assessesHostHealth: false,
            automaticActivation: false,
            automaticRollback: false,
            candidateTextExposed: false,
            providerEgress: false,
            networkEgress: false,
          },
          candidateText: "must-not-leave-the-builder",
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "sense.openclaw.declarative_evolution.health_gate");
  assert.equal(capability?.kind, "sensor");
  assert.equal(capability?.governance, "audit_only");
  assert.equal(capability?.available, true);

  const missingTaskId = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.declarative_evolution.health_gate",
    params: {},
  });
  assert.equal(missingTaskId.statusCode, 400);
  assert.match(missingTaskId.response.error, /requires taskId/);
  assert.equal(calls.length, 0);

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.declarative_evolution.health_gate",
    params: { taskId: "task-staging" },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.summary.kind, "declarative_evolution.health_gate");
  assert.equal(result.response.summary.assessment, "eligible_for_activation_review");
  assert.equal(result.response.summary.eligibleForActivationReview, true);
  assert.equal(result.response.summary.evaluatedToplevelPath, "/nix/store/abc123-openclaw-system");
  assert.equal(result.response.summary.closureIntegrityVerified, true);
  assert.equal(result.response.summary.closureIntegrityReceiptHash, "d".repeat(64));
  assert.equal(result.response.summary.hostHealth, "not_assessed");
  assert.equal(result.response.summary.noManagedConfigWrite, true);
  assert.equal(result.response.summary.noGenerationSwitch, true);
  assert.equal(result.response.summary.noRollback, true);
  assert.equal(result.response.summary.noHostHealthAssessment, true);
  assert.equal(result.response.summary.noAutomaticActivation, true);
  assert.equal(result.response.summary.noAutomaticRollback, true);
  assert.equal(result.response.summary.candidateTextInSummary, false);
  assert.deepEqual(calls, [{ taskId: "task-staging" }]);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("must-not-leave-the-builder"), false);
  assert.deepEqual(events.slice(-2).map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime creates a host-health-bound activation decision only after confirmation", async () => {
  const calls = [];
  const { runtime } = createHarness({
    declarativeEvolution: {
      createNativeDeclarativeEvolutionActivationDecisionTask: async (input) => {
        calls.push(input);
        return {
          ok: true,
          registry: "openclaw-native-declarative-evolution-activation-decision-v0",
          review: {
            sourceTaskId: input.taskId,
            activationReady: true,
            hostHealth: { status: "healthy" },
          },
          approvalBinding: {
            sourceStagingTaskId: input.taskId,
            decision: input.decision,
            candidateHash: "a".repeat(64),
            hostHealthHash: "b".repeat(64),
          },
          task: { id: "task-activation", status: "queued" },
          approval: { id: "approval-activation", status: "pending" },
          governance: {
            createsTask: true,
            createsApproval: true,
            writesManagedConfig: false,
            switchesGeneration: false,
            executesActivation: false,
            executesRollback: false,
            automaticActivation: false,
            automaticRollback: false,
          },
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const descriptor = registry.capabilities.find((item) => item.id === "act.openclaw.declarative_evolution.activation_decision");
  assert.equal(descriptor?.kind, "actuator");
  assert.equal(descriptor?.risk, "high");
  assert.equal(descriptor?.governance, "allow");

  const blocked = await runtime.invokeCapability({
    capabilityId: "act.openclaw.declarative_evolution.activation_decision",
    params: { taskId: "task-staging", decision: "approve_activation_review", confirm: false },
  });
  assert.equal(blocked.response.result.reason, "operator_confirmation_required");
  assert.equal(blocked.response.result.governance.executesActivation, false);
  assert.equal(blocked.response.result.governance.automaticActivation, false);
  assert.equal(blocked.response.result.governance.automaticRollback, false);
  assert.equal(calls.length, 0);

  const result = await runtime.invokeCapability({
    capabilityId: "act.openclaw.declarative_evolution.activation_decision",
    params: { taskId: "task-staging", decision: "approve_activation_review", confirm: true },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.response.summary.kind, "declarative_evolution.activation_decision");
  assert.equal(result.response.summary.activationReady, true);
  assert.equal(result.response.summary.activationExecuted, false);
  assert.equal(result.response.summary.noGenerationSwitch, true);
  assert.equal(result.response.summary.noAutomaticActivation, true);
  assert.equal(result.response.summary.noAutomaticRollback, true);
  assert.deepEqual(calls, [{ taskId: "task-staging", decision: "approve_activation_review", confirm: true }]);
});

test("capability runtime keeps managed-config activation confirmation and execution separate", async () => {
  const calls = [];
  const { runtime } = createHarness({
    declarativeEvolution: {
      createNativeDeclarativeEvolutionActivationTask: async (input) => {
        calls.push(input);
        return {
          ok: true,
          registry: "openclaw-native-declarative-evolution-activation-v0",
          approvalBinding: {
            activationDecisionTaskId: input.activationDecisionTaskId,
            candidateHash: "a".repeat(64),
            evaluatedClosurePath: "/nix/store/abc123-openclaw-system",
          },
          task: { id: "task-managed-activation", status: "queued" },
          approval: { id: "approval-managed-activation", status: "pending" },
          governance: {
            createsTask: true,
            createsApproval: true,
            executesActivation: true,
            automaticActivation: false,
            automaticRollback: false,
            executesRollback: false,
          },
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const descriptor = registry.capabilities.find((item) => item.id === "act.openclaw.declarative_evolution.activation");
  assert.equal(descriptor?.kind, "actuator");
  assert.equal(descriptor?.risk, "high");

  const blocked = await runtime.invokeCapability({
    capabilityId: "act.openclaw.declarative_evolution.activation",
    params: { activationDecisionTaskId: "task-decision", confirm: false },
  });
  assert.equal(blocked.response.result.reason, "operator_confirmation_required");
  assert.equal(blocked.response.result.governance.executesActivation, false);
  assert.equal(calls.length, 0);

  const created = await runtime.invokeCapability({
    capabilityId: "act.openclaw.declarative_evolution.activation",
    params: { activationDecisionTaskId: "task-decision", confirm: true },
  });
  assert.equal(created.statusCode, 200);
  assert.equal(created.response.summary.kind, "declarative_evolution.activation");
  assert.equal(created.response.summary.activationExecuted, false);
  assert.equal(created.response.summary.noAutomaticActivation, true);
  assert.equal(created.response.summary.noAutomaticRollback, true);
  assert.deepEqual(calls, [{ activationDecisionTaskId: "task-decision", confirm: true }]);
});

test("capability runtime exposes the native engineering tool surface inventory without execution authority", async () => {
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeEngineeringToolSurfaceInventory: (params) => {
        assert.equal(params.workspacePath, "/tmp/engineering-tool-surface");
        return {
          ok: true,
          registry: "openclaw-native-engineering-tool-surface-inventory-v0",
          workspace: { id: "fixture-workspace", path: "/private/workspace" },
          summary: {
            totalTools: 10,
            coveredTools: 10,
            sourceFilesPresent: 11,
            sourceFilesExpected: 11,
            readOnlyContracts: 4,
            mutationProposalContracts: 2,
            planningStateContracts: 3,
            verificationContracts: 1,
            lspContracts: 1,
            canReadSourceIndex: true,
            canReadSourceFileContent: false,
            exposesSourceFileContent: false,
            canImportModule: false,
            canExecuteToolCode: false,
            canRunVerification: false,
            canStartLsp: false,
            canMutate: false,
            createsTask: false,
            createsApproval: false,
            canCallProvider: false,
            canUseNetwork: false,
            nextRecommendedSlice: "select-next-concrete-local-capability-from-forward-directive",
          },
          governance: {
            canReadMetadata: true,
            canReadSourceIndex: true,
            canReadSourceFileContent: false,
            exposesSourceFileContent: false,
            canImportModule: false,
            canExecuteToolCode: false,
            canRunVerification: false,
            canStartLsp: false,
            canMutate: false,
            createsTask: false,
            createsApproval: false,
            canCallProvider: false,
            canUseNetwork: false,
            observerVisible: true,
          },
          sourceEvidence: { secretSourceBody: "must-not-persist" },
        };
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool_surface_inventory",
    intent: "engineering.tool_surface_inventory",
    params: { workspacePath: "/tmp/engineering-tool-surface" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.capability.id, "sense.openclaw.engineering_tool_surface_inventory");
  assert.equal(result.response.summary.kind, "engineering.tool_surface_inventory");
  assert.equal(result.response.summary.totalTools, 10);
  assert.equal(result.response.summary.coveredTools, 10);
  assert.equal(result.response.summary.noSourceContentExposure, true);
  assert.equal(result.response.summary.noToolExecution, true);
  assert.equal(result.response.summary.noLspStart, true);
  assert.equal(result.response.summary.noMutation, true);
  assert.equal(result.response.summary.noTaskCreation, true);
  assert.equal(result.response.summary.noApprovalCreation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.nextRecommendedSlice, "select-next-concrete-local-capability-from-forward-directive");
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("must-not-persist"), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime invokes bounded screen observation through the screen-sense owner", async () => {
  const { runtime, state, events, calls } = createHarness({
    fetchJsonResult: {
      ok: true,
      screen: {
        timestamp: "2026-07-16T00:00:00.000Z",
        readiness: "ready",
        captureSource: "browser",
        captureStrategy: "browser-runtime-backed",
        focusedWindow: { title: "private", pid: 42 },
        windowList: [{ title: "private", pid: 42 }],
        ocrBlocks: [{ text: "private", confidence: 0.9 }],
        snapshotText: "private snapshot",
        trustedSession: { sessionIdentity: { sessionId: "private-session" } },
        visualFrame: { available: true, width: 960, height: 540, fresh: true, dataUrl: "secret" },
        semanticTargets: { available: true, itemCount: 2, items: [{ name: "private" }] },
        workView: { status: "ready", visibility: "observable", mode: "ai-owned-work-view" },
        workViewSummary: { tabCount: 2, visibleTextBlocks: ["private"] },
      },
    },
  });

  const result = await runtime.invokeCapability({ capabilityId: "sense.screen.observe" });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.summary.kind, "screen.observe");
  assert.equal(result.response.summary.readiness, "ready");
  assert.equal(result.response.summary.noScreenPayload, true);
  assert.equal(result.response.summary.noMutation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.deepEqual(calls.fetchJson, ["http://127.0.0.1:4104/screen/current"]);
  assert.equal(state.capabilityInvocationLog.at(-1)?.capability?.id, "sense.screen.observe");
  assert.equal(events.at(-1)?.name, "capability.invoked");
  assert.equal(JSON.stringify(result.response).includes("private snapshot"), false);

  const rejected = await runtime.invokeCapability({
    capabilityId: "sense.screen.observe",
    params: { includeVisualFrame: true },
  });
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.response.error, /not supported/);
  assert.deepEqual(calls.fetchJson, ["http://127.0.0.1:4104/screen/current"]);
});

test("capability runtime exposes the existing LSP selected-target read bridge without persisting content", async () => {
  const privateContent = "const privateSymbol = true;";
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeEngineeringLspSelectedTargetReadBridge: (params) => {
        assert.equal(params.taskId, "task-lsp-selected-read");
        assert.equal(params.targetIndex, 1);
        return {
          ok: true,
          blocked: false,
          summary: {
            sourceTaskId: params.taskId,
            targetIndex: params.targetIndex,
            relativePath: "src/app.ts",
            startLine: 2,
            endLine: 3,
            includeRead: true,
            readOk: true,
            contentExposed: true,
          },
          target: { relativePath: "src/app.ts", startLine: 2, endLine: 3 },
          readResult: {
            ok: true,
            summary: { charsReturned: privateContent.length, outputTruncated: false },
            content: privateContent,
          },
          bounds: { noRawLspPayload: true },
          governance: { canMutateWorkspace: false, canCallProvider: false },
        };
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge",
    intent: "engineering.lsp.selected_target_read_bridge",
    taskId: "task-lsp-selected-read",
    params: {
      taskId: "task-lsp-selected-read",
      language: "typescript",
      targetIndex: 1,
      contextLines: 2,
      includeRead: true,
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.capability.id, "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge");
  assert.equal(result.response.summary.kind, "engineering.lsp_selected_target_read");
  assert.equal(result.response.summary.targetIndex, 1);
  assert.equal(result.response.summary.noRawLspPayload, true);
  assert.equal(result.response.summary.noMutation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.charsReturned, privateContent.length);
  assert.equal(result.response.result.readResult.content, privateContent);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes(privateContent), false);
  assert.equal(JSON.stringify(events).includes(privateContent), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);

  const rejected = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge",
    params: { includeRead: true },
  });
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.response.error, /explicit taskId/u);

  const invalidTarget = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.lsp_selected_target_read_bridge",
    params: { taskId: "task-lsp-selected-read", targetIndex: 8 },
  });
  assert.equal(invalidTarget.statusCode, 400);
  assert.match(invalidTarget.response.error, /targetIndex/u);
});

test("capability runtime dispatches browser new-tab through screen-act with a bound intent", async () => {
  const targetUrl = "https://example.com/capability-browser-action";
  const { runtime, state, events, calls } = createHarness({
    postJsonResult: {
      ok: true,
      action: {
        kind: "browser.new_tab",
        result: "executed-browser-runtime",
        degraded: false,
        params: { url: targetUrl },
        mediation: {
          attempted: true,
          accepted: true,
          status: "accepted",
          reason: null,
          leaseMatched: true,
          transport: "trusted-sidecar",
          visualGrounding: {
            required: true,
            status: "advanced",
            sequenceAdvanced: true,
            pageUrl: targetUrl,
            dataUrl: "data:image/jpeg;base64,secret",
          },
        },
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.browser.open",
    operation: "browser.new_tab",
    params: { url: targetUrl },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.capability.id, "act.browser.open");
  assert.equal(result.response.policy.input.intent, "browser.new_tab");
  assert.equal(result.response.invocation.request.intent, "browser.new_tab");
  assert.equal(result.response.summary.kind, "browser.new_tab");
  assert.equal(result.response.summary.accepted, true);
  assert.equal(result.response.summary.browserRuntimeExecuted, true);
  assert.equal(result.response.summary.noPayloadExposure, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.result.governance.dispatchesExistingScreenActOwner, true);
  assert.deepEqual(calls.postJson, [{
    url: "http://127.0.0.1:4105/act/browser/new-tab",
    body: { url: targetUrl },
  }]);
  assert.equal(JSON.stringify(result.response.invocation).includes(targetUrl), false);
  assert.equal(JSON.stringify(result.response.summary).includes(targetUrl), false);
  assert.equal(JSON.stringify(result.response.result).includes("data:image/jpeg"), false);
  assert.equal(state.capabilityInvocationLog.at(-1)?.request.intent, "browser.new_tab");
  assert.equal(events.at(-1)?.name, "capability.invoked");
});

test("capability runtime dispatches bounded keyboard type through screen-act without persisting input", async () => {
  const input = "transient-capability-input";
  const { runtime, state, events, calls } = createHarness({
    postJsonResult: {
      ok: true,
      action: {
        kind: "keyboard.type",
        result: "executed-browser-runtime",
        degraded: false,
        params: { text: input },
        mediation: {
          attempted: true,
          accepted: true,
          status: "accepted",
          reason: null,
          leaseMatched: true,
          transport: "trusted-sidecar-ipc",
          visualGrounding: {
            required: true,
            status: "advanced",
            sequenceAdvanced: true,
            pageUrl: "https://example.com/private",
            dataUrl: "data:image/jpeg;base64,secret",
          },
        },
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.screen.pointer_keyboard",
    operation: "keyboard.type",
    params: { text: input },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.capability.id, "act.screen.pointer_keyboard");
  assert.equal(result.response.policy.input.intent, "keyboard.type");
  assert.equal(result.response.invocation.request.intent, "keyboard.type");
  assert.equal(result.response.summary.kind, "keyboard.type");
  assert.equal(result.response.summary.accepted, true);
  assert.equal(result.response.summary.writesBrowserInput, true);
  assert.equal(result.response.summary.inputValueExposed, false);
  assert.equal(result.response.summary.noPayloadExposure, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.result.governance.dispatchesExistingScreenActOwner, true);
  assert.equal(result.response.result.governance.exposesInputValue, false);
  assert.deepEqual(calls.postJson, [{
    url: "http://127.0.0.1:4105/act/keyboard/type",
    body: { text: input },
  }]);
  assert.equal(JSON.stringify(result.response.invocation).includes(input), false);
  assert.equal(JSON.stringify(result.response.summary).includes(input), false);
  assert.equal(JSON.stringify(result.response.result).includes(input), false);
  assert.equal(JSON.stringify(result.response.result).includes("data:image/jpeg"), false);
  assert.equal(state.capabilityInvocationLog.at(-1)?.request.intent, "keyboard.type");
  assert.equal(events.at(-1)?.name, "capability.invoked");
});

test("capability runtime dispatches bounded left click through screen-act", async () => {
  const { runtime, state, events, calls } = createHarness({
    postJsonResult: {
      ok: true,
      action: {
        kind: "mouse.click",
        result: "executed-browser-runtime",
        degraded: false,
        params: { x: 640, y: 360, button: "left" },
        mediation: {
          attempted: true,
          accepted: true,
          status: "accepted",
          reason: null,
          leaseMatched: true,
          transport: "trusted-sidecar-ipc",
          visualGrounding: {
            required: true,
            status: "advanced",
            sequenceAdvanced: true,
            pageUrl: "https://example.com/private",
            dataUrl: "data:image/jpeg;base64,secret",
          },
        },
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.screen.pointer_keyboard",
    operation: "mouse.click",
    params: { x: 640, y: 360, button: "left" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.policy.input.intent, "mouse.click");
  assert.equal(result.response.invocation.request.intent, "mouse.click");
  assert.equal(result.response.summary.kind, "mouse.click");
  assert.equal(result.response.summary.accepted, true);
  assert.equal(result.response.summary.pointerAction, true);
  assert.equal(result.response.summary.writesBrowserInput, false);
  assert.equal(result.response.summary.noPayloadExposure, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.result.registry, "openclaw-screen-pointer-capability-v0");
  assert.equal(result.response.result.governance.pointerAction, true);
  assert.deepEqual(calls.postJson, [{
    url: "http://127.0.0.1:4105/act/mouse/click",
    body: { x: 640, y: 360, button: "left" },
  }]);
  assert.equal(JSON.stringify(result.response.invocation).includes("640"), false);
  assert.equal(JSON.stringify(result.response.result).includes("data:image/jpeg"), false);
  assert.equal(state.capabilityInvocationLog.at(-1)?.request.intent, "mouse.click");
  assert.equal(events.at(-1)?.name, "capability.invoked");
});

test("capability runtime dispatches simulated system maintenance through system-heal", async () => {
  const { runtime, state, events, calls } = createHarness({
    postJsonResult: {
      ok: true,
      tick: { status: "ran", reason: "forced" },
      run: {
        id: "maintenance-1",
        status: "healthy",
        autonomy: {
          governance: "audit_only",
          approvalRequired: false,
          mode: "conservative",
        },
        diagnosis: { plan: { mode: "simulated", stepCount: 0 } },
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.system.heal",
    operation: "heal.maintenance.tick",
    params: { force: true, autofix: true, mode: "simulated" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.policy.input.intent, "heal.maintenance.tick");
  assert.equal(result.response.invocation.request.intent, "heal.maintenance.tick");
  assert.equal(result.response.summary.kind, "maintenance.run");
  assert.equal(result.response.summary.noHostMutation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.maintenanceRunId, "maintenance-1");
  assert.deepEqual(calls.postJson, [{
    url: "http://127.0.0.1:4107/maintenance/tick",
    body: { force: true, autofix: true, mode: "simulated" },
  }]);
  assert.equal(JSON.stringify(result.response.invocation).includes("simulated"), false);
  assert.equal(state.capabilityInvocationLog.at(-1)?.request.intent, "heal.maintenance.tick");
  assert.equal(events.at(-1)?.name, "capability.invoked");
});

test("capability runtime exposes workspace edit target selection through the governed invoke path", async () => {
  const builderInputs = [];
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeOpenClawWorkspaceEditTargetSelection: (input) => {
        builderInputs.push(input);
        return {
          ok: true,
          registry: "openclaw-native-workspace-edit-target-selection-v0",
          query: { scope: "tools" },
          selectedTarget: { relativePath: "src/agents/tools/edit-target-tool.ts" },
          summary: {
            candidateCount: 1,
            selected: true,
            canFeedPatchProposal: true,
            exposesSourceFileContent: false,
            canExecutePluginCode: false,
            canExecuteToolCode: false,
            canActivateRuntime: false,
            canMutate: false,
            createsTask: false,
            createsApproval: false,
            canCallProvider: false,
            canUseNetwork: false,
          },
          governance: {
            exposesSourceFileContent: false,
            canExecutePluginCode: false,
            canExecuteToolCode: false,
            canActivateRuntime: false,
            canMutate: false,
            createsTask: false,
            createsApproval: false,
            canCallProvider: false,
            canUseNetwork: false,
          },
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "sense.openclaw.workspace_edit_target_select");
  assert.equal(capability?.kind, "sensor");
  assert.equal(capability?.governance, "audit_only");
  assert.equal(capability?.available, true);

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.workspace_edit_target_select",
    params: {
      workspacePath: "/workspace/fixture",
      scope: "tools",
      q: "edit",
      limit: 8,
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.summary.selectedTarget, "src/agents/tools/edit-target-tool.ts");
  assert.equal(result.response.summary.noSourceContentExposure, true);
  assert.equal(result.response.summary.noMutation, true);
  assert.equal(result.response.summary.noTaskCreation, true);
  assert.equal(result.response.summary.noApprovalCreation, true);
  assert.equal(result.response.summary.noPluginExecution, true);
  assert.equal(result.response.summary.noRuntimeActivation, true);
  assert.equal(result.response.summary.canCallProvider, false);
  assert.equal(result.response.summary.canUseNetwork, false);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.deepEqual(builderInputs, [{
    workspacePath: "/workspace/fixture",
    scope: "tools",
    query: "edit",
    limit: 8,
  }]);
  assert.equal(state.capabilityInvocationLog.at(-1).summary.noSourceContentExposure, true);
  assert(events.some((event) => event.name === "capability.invoked"));
});

test("capability runtime normalises invoke requests and policy inputs", () => {
  const { runtime } = createHarness();
  const capability = runtime.capabilityById("act.filesystem.write_text");
  const request = runtime.normaliseCapabilityInvokeRequest({
    id: " act.filesystem.write_text ",
    taskId: " task-1 ",
    params: { path: "/tmp/a" },
    policy: { domain: "user_task", risk: "critical", approved: true },
  });

  assert.equal(request.capabilityId, "act.filesystem.write_text");
  assert.equal(request.taskId, "task-1");
  assert.equal(request.approved, true);

  const policyInput = runtime.buildCapabilityPolicyInput(capability, request);

  assert.equal(policyInput.intent, "filesystem.write");
  assert.equal(policyInput.domain, "user_task");
  assert.equal(policyInput.risk, "critical");
  assert.equal(policyInput.requiresApproval, true);
  assert.equal(policyInput.policy.approved, true);
});

test("capability runtime records and publishes blocked invocations", async () => {
  const { runtime, state, events, calls } = createHarness({
    policyDecision: {
      decision: "require_approval",
      reason: "approval_required",
      approved: false,
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.system.command.dry_run",
    params: { command: "date" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.response.invoked, false);
  assert.equal(result.response.blocked, true);
  assert.equal(result.response.reason, "approval_task_required");
  assert.equal(state.capabilityInvocationLog.length, 1);
  assert.equal(state.capabilityInvocationLog[0].blocked, true);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.blocked"]);
  assert.equal(calls.persisted, 1);
});

test("capability runtime commits an approved command reservation and rejects replay", async () => {
  const task = {
    id: "task-command-runtime",
    status: "queued",
    plan: {
      planId: "plan-command-runtime",
      steps: [{
        id: "step-command-runtime",
        phase: "acting_on_target",
        status: "pending",
        capabilityId: "act.system.command.execute",
        intent: "system.command.execute",
        governance: "require_approval",
        requiresApproval: true,
        params: { command: "echo", args: ["approved"], cwd: "/tmp" },
      }],
    },
  };
  const approval = {
    id: "approval-command-runtime",
    taskId: task.id,
    status: "approved",
  };
  approval.binding = buildCapabilityApprovalBinding({ task });
  task.approval = { requestId: approval.id, status: approval.status };
  const { runtime, calls } = createHarness({
    state: {
      tasks: new Map([[task.id, task]]),
      approvals: new Map([[approval.id, approval]]),
    },
    client: {
      postJson: async (url, body) => {
        calls.postJson.push({ url, body });
        return { ok: true, execution: { result: { exitCode: 0 } } };
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.system.command.execute",
    taskId: task.id,
    stepId: "step-command-runtime",
    intent: "system.command.execute",
    params: { command: "echo", args: ["approved"], cwd: "/tmp" },
  });

  assert.equal(result.response.invoked, true);
  assert.equal(task.plan.steps[0].status, "completed");
  assert.equal(task.plan.steps[0].executionReceipt.status, "committed");
  assert.equal(calls.postJson.length, 1);

  const replay = await runtime.invokeCapability({
    capabilityId: "act.system.command.execute",
    taskId: task.id,
    stepId: "step-command-runtime",
    intent: "system.command.execute",
    params: { command: "echo", args: ["approved"], cwd: "/tmp" },
  });
  assert.equal(replay.response.invoked, false);
  assert.equal(replay.response.reason, "approval_step_completed");
  assert.equal(calls.postJson.length, 1);
});

test("capability runtime aborts an approved reservation when the actuator fails", async () => {
  const task = {
    id: "task-command-failure",
    status: "queued",
    plan: {
      planId: "plan-command-failure",
      steps: [{
        id: "step-command-failure",
        phase: "acting_on_target",
        status: "pending",
        capabilityId: "act.system.command.execute",
        intent: "system.command.execute",
        governance: "require_approval",
        requiresApproval: true,
        params: { command: "echo", args: ["failure"] },
      }],
    },
  };
  const approval = { id: "approval-command-failure", taskId: task.id, status: "approved" };
  approval.binding = buildCapabilityApprovalBinding({ task });
  task.approval = { requestId: approval.id, status: approval.status };
  const { runtime } = createHarness({
    state: {
      tasks: new Map([[task.id, task]]),
      approvals: new Map([[approval.id, approval]]),
    },
    client: {
      postJson: async () => {
        throw new Error("actuator unavailable");
      },
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.system.command.execute",
    taskId: task.id,
    stepId: "step-command-failure",
    intent: "system.command.execute",
    params: { command: "echo", args: ["failure"] },
  });

  assert.equal(result.statusCode, 502);
  assert.equal(result.response.reason, "capability_backend_failed");
  assert.equal(task.plan.steps[0].status, "pending");
  assert.equal(task.plan.steps[0].executionReceipt.status, "aborted");
});

test("capability runtime invokes filesystem reads and trims invocation history", async () => {
  const { runtime, state, events, calls } = createHarness({
    fetchJsonResult: {
      ok: true,
      results: [{ path: "/tmp/a" }],
      count: 1,
      path: "/tmp",
    },
  });

  for (let index = 0; index < 4; index += 1) {
    const result = await runtime.invokeCapability({
      capabilityId: "sense.filesystem.read",
      operation: "search",
      params: { path: "/tmp", query: "a", limit: 5 },
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.response.invoked, true);
    assert.equal(result.response.summary.kind, "filesystem.read");
    assert.equal(result.response.summary.operation, "search");
  }

  assert.equal(state.capabilityInvocationLog.length, 3);
  assert.equal(runtime.buildCapabilityInvocationSummary().total, 3);
  assert.equal(runtime.listCapabilityInvocations({ limit: 2 }).length, 2);
  assert.equal(calls.fetchJson[0], "http://127.0.0.1:4106/system/files/search?path=%2Ftmp&query=a&limit=5");
  assert.equal(events.filter((event) => event.name === "capability.invoked").length, 4);
});

test("capability runtime exposes bounded engineering read/search through the governed invoke path", async () => {
  const builderInputs = {};
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeEngineeringReadFile: (input) => {
        builderInputs.read = input;
        return {
          ok: true,
          registry: "openclaw-native-engineering-read-search-v0",
          operation: "read",
          target: { relativePath: "src/app.ts", contentExposed: true },
          summary: { lineCount: 2, charsReturned: 21, outputTruncated: false },
          content: "source body must stay out of the ledger",
        };
      },
      buildNativeEngineeringGlob: (input) => {
        builderInputs.glob = input;
        return {
          ok: true,
          registry: "openclaw-native-engineering-read-search-v0",
          operation: "glob",
          query: { pattern: "src/**/*.ts", limit: 4 },
          summary: { pattern: "src/**/*.ts", matchedResults: 2, resultsTruncated: false, filesConsidered: 7, contentRead: false },
        };
      },
      buildNativeEngineeringGrep: (input) => {
        builderInputs.grep = input;
        return {
          ok: true,
          registry: "openclaw-native-engineering-read-search-v0",
          operation: "grep",
          query: { text: "OpenClaw", include: "src/**/*.ts" },
          summary: { query: "OpenClaw", include: "src/**/*.ts", matchedResults: 1, outputChars: 18, resultsTruncated: false, filesRead: 3 },
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  for (const capabilityId of [
    "sense.openclaw.engineering_tool.read",
    "sense.openclaw.engineering_tool.glob",
    "sense.openclaw.engineering_tool.grep",
  ]) {
    const capability = registry.capabilities.find((item) => item.id === capabilityId);
    assert.equal(capability?.governance, "audit_only");
    assert.equal(capability?.requiresApproval, undefined);
    assert.equal(capability?.available, true);
  }

  const read = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.read",
    params: {
      workspacePath: "/tmp/workspace",
      path: "src/app.ts",
      start_line: 2,
      endLine: 3,
      maxOutputChars: 500,
    },
  });
  const glob = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.glob",
    params: { workspacePath: "/tmp/workspace", pattern: "src/**/*.ts", limit: 4 },
  });
  const grep = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.grep",
    params: {
      workspacePath: "/tmp/workspace",
      q: "OpenClaw",
      include: "src/**/*.ts",
      case_sensitive: true,
      limit: 2,
    },
  });

  assert.equal(read.response.invoked, true);
  assert.equal(read.response.summary.kind, "engineering.read");
  assert.equal(read.response.summary.contentExposed, true);
  assert.equal(glob.response.summary.matchedResults, 2);
  assert.equal(grep.response.summary.filesRead, 3);
  assert.deepEqual(builderInputs.read, {
    workspacePath: "/tmp/workspace",
    relativePath: "src/app.ts",
    startLine: 2,
    endLine: 3,
    maxOutputChars: 500,
    maxFileSizeBytes: undefined,
  });
  assert.deepEqual(builderInputs.grep, {
    workspacePath: "/tmp/workspace",
    query: "OpenClaw",
    literal: undefined,
    caseSensitive: true,
    include: "src/**/*.ts",
    limit: 2,
    maxOutputChars: undefined,
    maxFileSizeBytes: undefined,
  });
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("source body"), false);
  assert.equal(state.capabilityInvocationLog.length, 3);
  assert.equal(events.filter((event) => event.name === "capability.invoked").length, 3);
});

test("capability runtime exposes read-only verification evidence through the governed invoke path", async () => {
  const taskId = "verification-task-1";
  const transcriptRecord = {
    taskId,
    taskStatus: "completed",
    taskClosedAt: "2026-07-08T00:00:01.000Z",
    taskOutcome: "completed",
    index: 0,
    state: "executed",
    command: "npm",
    exitCode: 0,
    timedOut: false,
    stdout: "verification-ok",
    stderr: "",
  };
  const stateTasks = new Map([[
    taskId,
    {
      id: taskId,
      status: "completed",
      closedAt: transcriptRecord.taskClosedAt,
      outcome: {
        kind: "completed",
        details: {
          commandTranscript: [{
            command: "npm",
            exitCode: 0,
            timedOut: false,
          }],
        },
      },
    },
  ]]);
  const { runtime, state, events } = createHarness({
    state: { tasks: stateTasks },
    listCommandTranscriptRecords: ({ limit }) => {
      assert.equal(limit, 100);
      return [transcriptRecord];
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "sense.openclaw.engineering_tool.verify_evidence");
  assert.equal(capability?.governance, "audit_only");
  assert.equal(capability?.available, true);
  assert.equal(capability?.requiresApproval, undefined);

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.verify_evidence",
    taskId,
    params: { limit: 4, maxOutputChars: 200 },
  });

  assert.equal(result.response.invoked, true);
  assert.equal(result.response.summary.kind, "engineering.verification_evidence");
  assert.equal(result.response.summary.passed, 1);
  assert.equal(result.response.summary.attachedToCompletedTasks, 1);
  assert.equal(result.response.summary.noCommandExecution, true);
  assert.equal(result.response.result.capability.id, "sense.openclaw.engineering_tool.verify_evidence");
  assert.equal(result.response.result.query.taskId, taskId);
  assert.equal(result.response.result.evidence[0].result.stdout, "verification-ok");
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("verification-ok"), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime exposes compact trusted work-view observation through the governed invoke path", async () => {
  const taskId = "work-view-task-1";
  const task = {
    id: taskId,
    type: "native_engineering_lsp_lifecycle",
    status: "running",
    workViewStrategy: "openclaw-native-engineering-lsp-lifecycle",
    workView: { sessionId: "session-current", workViewId: "work-view-primary" },
  };
  const workViewState = {
    ok: true,
    session: { sessionId: "session-current", status: "running", role: "ai-work-view" },
    workView: {
      workViewId: "work-view-primary",
      status: "ready",
      visibility: "hidden",
      mode: "background",
      trustedSession: {
        sessionIdentity: { status: "authoritative", authority: "openclaw-session-manager" },
        helperRuntime: {
          status: "active",
          actionAuthority: "active",
          leaseMatched: true,
          sidecar: {
            captureSourceStatus: "ready",
            captureFreshness: "fresh",
            captureObservation: {
              registry: "openclaw-trusted-work-view-sidecar-capture-observation-v0",
              sequence: 4,
              visualFrame: {
                available: true,
                fresh: true,
                sequence: 4,
                sha256: "a".repeat(64),
                pageUrl: "https://private.example.invalid/not-returned",
                width: 960,
                height: 540,
                byteLength: 12_000,
              },
              semanticTargets: {
                available: true,
                itemCount: 3,
                inventorySha256: "b".repeat(64),
                frameSequence: 4,
                frameSha256: "a".repeat(64),
                items: [{ name: "private target not returned" }],
              },
            },
          },
        },
        recoveryRecommendation: { action: "none" },
      },
    },
  };
  const { runtime, state, events } = createHarness({
    state: { tasks: new Map([[taskId, task]]) },
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => url.endsWith("/work-view/state") ? workViewState : { ok: true },
    }),
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "sense.openclaw.engineering_context.work_view_observation");
  assert.equal(capability?.governance, "audit_only");
  assert.equal(capability?.available, true);

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.work_view_observation",
    taskId,
  });

  assert.equal(result.response.invoked, true);
  assert.equal(result.response.result.registry, "openclaw-native-engineering-work-view-association-v0");
  assert.equal(result.response.result.identityLevel, "Level 2: trusted session/work-view component");
  assert.equal(result.response.result.summary.status, "bound");
  assert.equal(result.response.result.observation.freshness, "fresh");
  assert.equal(result.response.result.observation.semanticTargets.itemCount, 3);
  assert.equal(result.response.result.semanticActionDecision.status, "ready_for_target_selection");
  assert.equal(result.response.result.summary.semanticActionReady, true);
  assert.equal(result.response.summary.kind, "engineering.work_view_observation");
  assert.equal(result.response.summary.semanticActionDecisionStatus, "ready_for_target_selection");
  assert.equal(result.response.summary.semanticActionReady, true);
  assert.equal(result.response.summary.readsSemanticActionDecision, true);
  assert.equal(result.response.summary.noPayloadExposure, true);
  assert.equal(result.response.summary.readsTrustedWorkViewObservation, true);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("private.example"), false);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("private target"), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime rejects conflicting trusted work-view task ids before policy or state read", async () => {
  const calls = [];
  const { runtime, state, events } = createHarness({
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.work_view_observation",
    taskId: "task-envelope",
    params: { taskId: "task-params" },
  });

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.response, {
    ok: false,
    error: "Trusted work-view observation taskId must match the request taskId.",
  });
  assert.equal(calls.length, 0);
  assert.equal(state.capabilityInvocationLog.length, 0);
  assert.deepEqual(events, []);
});

test("capability runtime binds an engineering task only after explicit confirmation and preserves task status", async () => {
  const taskId = "task-capability-bind";
  const task = { id: taskId, status: "completed", workView: null };
  let stateReads = 0;
  let bindCalls = 0;
  const workViewState = {
    session: { sessionId: "session-current", status: "running" },
    workView: {
      workViewId: "work-view-primary",
      status: "ready",
      visibility: "hidden",
      mode: "background",
      displayTarget: "workspace-2",
      trustedSession: {
        sessionIdentity: { status: "authoritative" },
        helperRuntime: { status: "active", actionAuthority: "active", leaseMatched: true },
      },
    },
  };
  const { runtime, state, events } = createHarness({
    state: { tasks: new Map([[taskId, task]]) },
    taskManager: {
      getTaskById: (candidateId) => candidateId === taskId ? task : null,
      bindTaskToTrustedWorkView: (candidate, binding) => {
        bindCalls += 1;
        candidate.workView = { ...binding };
        return candidate;
      },
      serialiseTask: (candidate) => ({ id: candidate.id, status: candidate.status }),
    },
    readWorkViewState: async () => {
      stateReads += 1;
      return { ok: true, data: workViewState };
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "act.openclaw.engineering_context.work_view_bind");
  assert.equal(capability?.kind, "actuator");
  assert.equal(capability?.governance, "allow");

  const unconfirmed = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId,
    params: {},
  });
  assert.equal(unconfirmed.response.invoked, true);
  assert.equal(unconfirmed.response.result.ok, false);
  assert.equal(unconfirmed.response.result.bind.summary.status, "operator_confirmation_required");
  assert.equal(unconfirmed.response.summary.kind, "engineering.work_view_bind");
  assert.equal(unconfirmed.response.summary.blocked, true);
  assert.equal(unconfirmed.response.summary.noPayloadExposure, true);
  assert.equal(stateReads, 0);
  assert.equal(bindCalls, 0);

  const bound = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId,
    params: { confirm: true },
  });
  assert.equal(bound.response.invoked, true);
  assert.equal(bound.response.result.ok, true);
  assert.equal(bound.response.result.changed, true);
  assert.equal(bound.response.result.bind.summary.status, "bound");
  assert.equal(bound.response.result.bind.summary.operation, "bind");
  assert.equal(bound.response.result.task.status, "completed");
  assert.equal(bound.response.summary.taskStatusPreserved, true);
  assert.equal(bound.response.summary.noWorkViewMutation, true);
  assert.equal(bound.response.summary.noProviderEgress, true);
  assert.equal(bound.response.summary.noPayloadExposure, true);
  assert.equal(stateReads, 1);
  assert.equal(bindCalls, 1);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("session-current"), false);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("leaseId"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "capability.invoked",
    "policy.evaluated",
    "task.work_view_bound",
    "capability.invoked",
  ]);
});

test("capability runtime rejects stale engineering work-view binding without mutation", async () => {
  const taskId = "task-capability-stale-bind";
  const task = {
    id: taskId,
    status: "queued",
    workView: { sessionId: "session-old", workViewId: "work-view-primary" },
  };
  let bindCalls = 0;
  const { runtime, state } = createHarness({
    state: { tasks: new Map([[taskId, task]]) },
    taskManager: {
      getTaskById: () => task,
      bindTaskToTrustedWorkView: () => {
        bindCalls += 1;
        return task;
      },
    },
    readWorkViewState: async () => ({
      ok: true,
      data: {
        session: { sessionId: "session-current", status: "running" },
        workView: {
          workViewId: "work-view-primary",
          status: "ready",
          trustedSession: {
            sessionIdentity: { status: "authoritative" },
            helperRuntime: { status: "active", actionAuthority: "active", leaseMatched: true },
          },
        },
      },
    }),
  });

  const result = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId,
    params: { confirm: true },
  });

  assert.equal(result.response.invoked, true);
  assert.equal(result.response.result.ok, false);
  assert.equal(result.response.result.bind.summary.status, "stale_session_binding");
  assert.equal(result.response.summary.blocked, true);
  assert.equal(result.response.summary.changed, false);
  assert.equal(result.response.summary.taskStatusPreserved, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.noPayloadExposure, true);
  assert.equal(bindCalls, 0);
  assert.equal(state.capabilityInvocationLog.length, 1);
});

test("capability runtime exposes plan/todo evidence and governed workbench storage", async () => {
  const taskId = "task-capability-plan-todo";
  const task = {
    id: taskId,
    status: "running",
    goal: "Keep visible planning state bounded",
    plan: {
      summary: "Review and verify the bounded workbench state.",
      steps: [
        { id: "inspect", title: "Inspect the existing workbench", status: "completed" },
        { id: "verify", title: "Verify the common capability path", status: "running" },
      ],
    },
  };
  const records = new Map();
  const { runtime, state, events } = createHarness({
    state: {
      tasks: new Map([[taskId, task]]),
      nativeEngineeringPlanTodoWorkbenchRecords: records,
    },
    taskManager: {
      getTaskById: (candidateId) => candidateId === taskId ? task : null,
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  assert.equal(registry.capabilities.find((item) => item.id === "sense.openclaw.engineering_context.plan_todo_evidence")?.kind, "sensor");
  assert.equal(registry.capabilities.find((item) => item.id === "act.openclaw.engineering_context.plan_todo_workbench_state")?.kind, "actuator");

  const evidence = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.plan_todo_evidence",
    taskId,
    params: {
      planSummary: "Transient planning summary must stay out of invocation metadata.",
      todos: [
        { id: "current", description: "Transient todo description", status: "in_progress" },
      ],
    },
  });
  assert.equal(evidence.response.invoked, true);
  assert.equal(evidence.response.result.capability.id, "sense.openclaw.engineering_context.plan_todo_evidence");
  assert.equal(evidence.response.result.summary.todoSource, "query_todos");
  assert.equal(evidence.response.summary.kind, "engineering.plan_todo_evidence");
  assert.equal(evidence.response.summary.noMutation, true);
  assert.equal(evidence.response.summary.noTodoFileWrite, true);
  assert.equal(evidence.response.summary.noProviderEgress, true);

  const unconfirmed = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.plan_todo_workbench_state",
    taskId,
    params: {
      todos: [{ id: "blocked", description: "Must not be stored without confirmation", status: "pending" }],
    },
  });
  assert.equal(unconfirmed.response.invoked, true);
  assert.equal(unconfirmed.response.result.ok, false);
  assert.equal(unconfirmed.response.result.reason, "operator_confirmation_required");
  assert.equal(unconfirmed.response.summary.blocked, true);
  assert.equal(unconfirmed.response.summary.taskStatusPreserved, true);
  assert.equal(records.size, 0);
  assert.equal(task.status, "running");

  const saved = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.plan_todo_workbench_state",
    taskId,
    params: {
      confirm: true,
      source: "capability-runtime-test",
      planSummary: "Persisted summary preview",
      confirmedPlan: "Persisted confirmed plan preview",
      todos: [{ id: "stored", description: "Persisted visible todo", status: "in_progress" }],
    },
  });
  assert.equal(saved.response.invoked, true);
  assert.equal(saved.response.result.ok, true);
  assert.equal(saved.response.result.record.revision, 1);
  assert.equal(saved.response.result.record.counts.total, 1);
  assert.equal(saved.response.summary.taskStatusPreserved, true);
  assert.equal(saved.response.summary.noTodoFileWrite, true);
  assert.equal(saved.response.summary.noProviderEgress, true);
  assert.equal(task.status, "running");
  assert.equal(records.get(taskId).revision, 1);

  const revised = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_context.plan_todo_workbench_state",
    taskId,
    params: {
      confirm: true,
      todos: [{ id: "stored-again", description: "Revision two visible todo", status: "done" }],
    },
  });
  assert.equal(revised.response.result.record.revision, 2);
  assert.equal(records.get(taskId).revision, 2);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("Transient todo description"), false);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("Persisted confirmed plan preview"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "capability.invoked",
    "policy.evaluated",
    "capability.invoked",
    "policy.evaluated",
    "native_engineering.plan_todo.workbench_state_saved",
    "capability.invoked",
    "policy.evaluated",
    "native_engineering.plan_todo.workbench_state_saved",
    "capability.invoked",
  ]);
});

test("capability runtime exposes an allowlisted work-view control through the governed invoke path", async () => {
  const { runtime, state, events, calls } = createHarness({
    client: {
      postJson: async (url, body) => {
        calls.postJson.push({ url, body });
        return {
          ok: true,
          workView: {
            status: "ready",
            visibility: "visible",
            mode: "foreground-observable",
            helperStatus: "active",
            browserStatus: "running",
            activeUrl: "https://private.example.invalid/not-returned",
            trustedSession: {
              helperRuntime: { leaseId: "lease-not-returned" },
              recoveryRecommendation: { action: "none" },
            },
          },
          browser: { activeUrl: "https://private.example.invalid/browser-not-returned" },
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "act.work_view.control");
  assert.equal(capability?.governance, "allow");

  const result = await runtime.invokeCapability({
    capabilityId: "act.work_view.control",
    operation: "work_view.reveal",
    params: { entryUrl: "https://private.example.invalid/request-url" },
  });

  assert.equal(result.response.invoked, true);
  assert.equal(result.response.result.registry, "openclaw-native-work-view-control-v0");
  assert.equal(result.response.result.action, "reveal_work_view");
  assert.equal(result.response.result.workView.visibility, "visible");
  assert.equal(result.response.result.governance.browserNavigation, true);
  assert.equal(result.response.result.governance.providerEgress, false);
  assert.equal(result.response.result.governance.exposesActiveUrl, false);
  assert.equal(result.response.policy.input.intent, "work_view.reveal");
  assert.equal(result.response.invocation.request.intent, "work_view.reveal");
  assert.equal(result.response.summary.kind, "work_view.control");
  assert.equal(result.response.summary.browserNavigation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.noPayloadExposure, true);
  assert.deepEqual(calls.postJson, [{
    url: "http://127.0.0.1:4102/work-view/reveal",
    body: {
      operatorActionSource: "capability_runtime_work_view_control",
      recommendedAction: "reveal_work_view",
      entryUrl: "https://private.example.invalid/request-url",
    },
  }]);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("private.example"), false);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("lease-not-returned"), false);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.invoked"]);
});

test("capability runtime rejects an unallowlisted work-view control before policy or dispatch", async () => {
  const { runtime, state, events, calls } = createHarness();

  const result = await runtime.invokeCapability({
    capabilityId: "act.work_view.control",
    operation: "browser.open",
    params: { entryUrl: "https://private.example.invalid/not-used" },
  });

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.response, {
    ok: false,
    error: "Trusted work-view control operation is not allowlisted.",
  });
  assert.deepEqual(calls.postJson, []);
  assert.equal(state.capabilityInvocationLog.length, 0);
  assert.deepEqual(events, []);
});

test("capability runtime maps each canonical work-view control to its fixed owner route", async () => {
  const { runtime, calls } = createHarness();
  const requests = [
    {
      operation: "work_view.prepare",
      params: { displayTarget: "workspace-2", entryUrl: "https://example.com/prepare" },
    },
    {
      operation: "work_view.reveal",
      params: { entryUrl: "https://example.com/reveal" },
    },
    { operation: "work_view.hide", params: {} },
  ];

  for (const request of requests) {
    const result = await runtime.invokeCapability({
      capabilityId: "act.work_view.control",
      ...request,
    });
    assert.equal(result.response.invoked, true);
  }

  assert.deepEqual(calls.postJson, [
    {
      url: "http://127.0.0.1:4102/work-view/prepare",
      body: {
        operatorActionSource: "capability_runtime_work_view_control",
        recommendedAction: "prepare_work_view",
        displayTarget: "workspace-2",
        entryUrl: "https://example.com/prepare",
      },
    },
    {
      url: "http://127.0.0.1:4102/work-view/reveal",
      body: {
        operatorActionSource: "capability_runtime_work_view_control",
        recommendedAction: "reveal_work_view",
        entryUrl: "https://example.com/reveal",
      },
    },
    {
      url: "http://127.0.0.1:4102/work-view/hide",
      body: {
        operatorActionSource: "capability_runtime_work_view_control",
        recommendedAction: "hide_work_view",
      },
    },
  ]);
});

test("capability runtime rejects credential-bearing work-view URLs before dispatch", async () => {
  const { runtime, state, events, calls } = createHarness();

  const result = await runtime.invokeCapability({
    capabilityId: "act.work_view.control",
    operation: "work_view.reveal",
    params: { entryUrl: "https://user:password@example.com/private" },
  });

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.response, {
    ok: false,
    error: "Trusted work-view control entryUrl must be an HTTP(S) URL without credentials.",
  });
  assert.deepEqual(calls.postJson, []);
  assert.equal(state.capabilityInvocationLog.length, 0);
  assert.deepEqual(events, []);
});

test("capability runtime exposes the local engineering context packet through the governed invoke path", async () => {
  const taskId = "context-capability-task";
  const task = {
    id: taskId,
    type: "system_task",
    status: "completed",
    goal: "Assemble bounded context",
    outcome: { kind: "completed" },
  };
  const transcriptRecord = {
    taskId,
    index: 0,
    invocationId: "context-invocation-1",
    command: "npm",
    stdout: "password=private-context-value",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  };
  const { runtime, state, events } = createHarness({
    state: {
      tasks: new Map([[taskId, task]]),
      runtimeState: { currentTaskId: taskId },
    },
    listCommandTranscriptRecords: ({ limit }) => {
      assert.equal(limit, 100);
      return [transcriptRecord];
    },
    buildExperienceMemoryReadModel: ({ taskType, goal }) => ({
      ok: true,
      registry: "openclaw-native-engineering-experience-memory-v0",
      records: [{
        id: "experience-context-1",
        taskType,
        lesson: "Reuse bounded verification evidence.",
        outcome: "completed",
        executionPhase: "completed",
        applicabilityTokens: ["type:system_task"],
        confidence: 0.72,
        recordedAt: "2026-07-08T00:00:00.000Z",
        source: { registry: "openclaw-task-lifecycle-terminal-v0", taskId, outcomeHash: "a".repeat(64) },
        relevance: 101,
      }],
      summary: {
        storedRecords: 1,
        recalledRecords: 1,
        matchedRecords: 1,
        completedMatches: 1,
        failedMatches: 0,
        completionRate: 1,
        latestOutcome: "completed",
        pattern: "repeatable_success",
        nextAction: "Reuse the bounded approval path and attach verification evidence before reporting completion.",
        status: "recalled",
        advisoryOnly: true,
        queryTokenCount: 1,
      },
      bounds: { maxRecallRecords: 8 },
      governance: { advisoryOnly: true },
      auditEvidence: { summary: { storedRecords: 1, recalledRecords: 1, queryTokenCount: 1, queryHash: "b".repeat(64), advisoryOnly: true } },
      goal,
    }),
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "sense.openclaw.engineering_context.packet");
  assert.equal(capability?.governance, "audit_only");

  const result = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.packet",
    params: {
      taskId,
      limit: 4,
      maxOutputChars: 200,
      thresholdChars: 256,
      protectRecentAssistantTurns: 0,
    },
  });

  assert.equal(result.response.invoked, true);
  assert.equal(result.response.result.registry, "openclaw-native-engineering-context-packet-v0");
  assert.equal(result.response.result.summary.sourceTranscriptRecords, 1);
  assert.equal(result.response.result.summary.redactions, 1);
  assert.equal(JSON.stringify(result.response.result).includes("private-context-value"), false);
  assert.equal(result.response.summary.kind, "engineering.context_packet");
  assert.equal(result.response.summary.noContentPersistence, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.experienceMemoryIncluded, true);
  assert.equal(result.response.summary.experienceMemoryRecalled, 1);
  assert.equal(result.response.summary.experienceMemoryPattern, "repeatable_success");
  assert.equal(result.response.summary.experienceMemoryCompletionRate, 1);
  assert.equal(result.response.summary.experienceMemoryAdvisoryOnly, true);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("private-context-value"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "native_engineering.context_packet_built",
    "capability.invoked",
  ]);
});

test("capability runtime validates context packet source and observation selectors before policy", async () => {
  const { runtime, state, events } = createHarness();

  const invalidObservation = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.packet",
    params: { includeWorkViewObservation: true },
  });
  assert.equal(invalidObservation.statusCode, 400);
  assert.equal(invalidObservation.response.error, "includeWorkViewObservation requires includeWorkView.");

  const missingSource = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.packet",
    params: { sourceTaskId: "missing-context-source" },
  });
  assert.equal(missingSource.statusCode, 400);
  assert.equal(missingSource.response.error, "Engineering context source task does not exist.");

  const blankHarness = createHarness();
  const blankSource = await blankHarness.runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_context.packet",
    params: { sourceTaskId: "   " },
  });
  assert.equal(blankSource.statusCode, 200);
  assert.equal(blankSource.response.invoked, true);
  assert.equal(blankSource.response.result.summary.sourceTaskId, null);
  assert.equal(blankHarness.state.capabilityInvocationLog.length, 1);

  assert.equal(state.capabilityInvocationLog.length, 0);
  assert.deepEqual(events, []);
});

test("capability runtime exposes the existing bounded edit proposal without mutation", async () => {
  let receivedInput = null;
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeEngineeringEditProposal: (input) => {
        receivedInput = input;
        return {
          ok: true,
          registry: "openclaw-native-engineering-edit-proposal-v0",
          target: {
            relativePath: "src/app.ts",
            originalSha256: "a".repeat(64),
            proposedSha256: "b".repeat(64),
          },
          summary: {
            editCount: 1,
            replacementsAvailable: 1,
            changedAtLine: 1,
            previewLineCount: 2,
            previewTruncated: false,
          },
          governance: {
            canMutate: false,
            canApplyPatch: false,
            createsTask: false,
            requiresApprovalBeforeApply: true,
          },
          diffPreview: { lines: [{ text: "transient proposal content" }] },
          deferredExecutionBoundaries: ["no provider call"],
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "act.openclaw.engineering_tool.edit_proposal");
  assert.equal(capability?.kind, "planner");
  assert.equal(capability?.governance, "audit_only");

  const result = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_tool.edit_proposal",
    params: {
      workspacePath: "/workspace/fixture",
      relativePath: "src/app.ts",
      oldString: "before",
      newString: "after",
      contextLines: 2,
      maxOutputChars: 500,
      maxFileSizeBytes: 8_000,
    },
  });

  assert.deepEqual(receivedInput, {
    workspacePath: "/workspace/fixture",
    relativePath: "src/app.ts",
    oldString: "before",
    newString: "after",
    contextLines: 2,
    maxOutputChars: 500,
    maxFileSizeBytes: 8_000,
  });
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.result.registry, "openclaw-native-engineering-edit-proposal-v0");
  assert.equal(result.response.result.diffPreview.lines[0].text, "transient proposal content");
  assert.equal(result.response.summary.kind, "engineering.edit_proposal");
  assert.equal(result.response.summary.noMutation, true);
  assert.equal(result.response.summary.noTaskCreation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.requiresApprovalBeforeApply, true);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("transient proposal content"), false);
  assert.equal(JSON.stringify(events).includes("transient proposal content"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "capability.invoked",
  ]);
});

test("capability runtime exposes the existing redacted write proposal without mutation", async () => {
  let receivedInput = null;
  const { runtime, state, events } = createHarness({
    pluginReview: {
      buildNativeEngineeringWriteProposal: (input) => {
        receivedInput = input;
        return {
          ok: true,
          blocked: false,
          registry: "openclaw-native-engineering-write-proposal-v0",
          target: {
            relativePath: "new-file.txt",
            existingSha256: null,
            proposedSha256: "c".repeat(64),
            contentExposed: false,
          },
          summary: {
            proposalKind: "create_file_proposal",
            targetExists: false,
            overwriteRequested: false,
            proposedBytes: 21,
            previewLineCount: 1,
            previewTruncated: false,
          },
          governance: {
            canMutate: false,
            canWriteFile: false,
            canOverwriteFile: false,
            createsTask: false,
            requiresApprovalBeforeWrite: true,
          },
          deferredExecutionBoundaries: ["no provider call"],
        };
      },
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  const capability = registry.capabilities.find((item) => item.id === "act.openclaw.engineering_tool.write_proposal");
  assert.equal(capability?.kind, "planner");
  assert.equal(capability?.governance, "audit_only");

  const result = await runtime.invokeCapability({
    capabilityId: "act.openclaw.engineering_tool.write_proposal",
    params: {
      workspacePath: "/workspace/fixture",
      relativePath: "new-file.txt",
      content: "transient write content",
      overwrite: false,
      contextLines: 2,
      maxContentBytes: 500,
      maxExistingFileBytes: 8_000,
    },
  });

  assert.deepEqual(receivedInput, {
    workspacePath: "/workspace/fixture",
    relativePath: "new-file.txt",
    content: "transient write content",
    contentBase64: undefined,
    overwrite: false,
    contextLines: 2,
    maxContentBytes: 500,
    maxExistingFileBytes: 8_000,
  });
  assert.equal(result.response.invoked, true);
  assert.equal(result.response.result.registry, "openclaw-native-engineering-write-proposal-v0");
  assert.equal(result.response.result.target.contentExposed, false);
  assert.equal(result.response.summary.kind, "engineering.write_proposal");
  assert.equal(result.response.summary.noMutation, true);
  assert.equal(result.response.summary.noTaskCreation, true);
  assert.equal(result.response.summary.noProviderEgress, true);
  assert.equal(result.response.summary.requiresApprovalBeforeWrite, true);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("transient write content"), false);
  assert.equal(JSON.stringify(events).includes("transient write content"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "capability.invoked",
  ]);
});

test("capability runtime exposes approved edit and write execution evidence through the shared ledger boundary", async () => {
  const builderInputs = [];
  const editTaskId = "runtime-edit-execution-task";
  const writeTaskId = "runtime-write-execution-task";
  const filesystemChanges = [
    {
      id: "edit-change-1",
      taskId: editTaskId,
      change: "write_text",
      capabilityId: "act.filesystem.write_text",
      path: "/workspace/src/app.ts",
      contentBytes: 24,
    },
    {
      id: "write-change-1",
      taskId: writeTaskId,
      change: "write_text",
      capabilityId: "act.filesystem.write_text",
      path: "/workspace/src/new.ts",
      contentBytes: 18,
    },
  ];
  const tasks = new Map([
    [editTaskId, { id: editTaskId, status: "completed" }],
    [writeTaskId, { id: writeTaskId, status: "completed" }],
  ]);
  const { runtime, state, events } = createHarness({
    state: { tasks },
    listFilesystemChangeRecords: ({ limit }) => {
      builderInputs.push({ limit });
      return filesystemChanges;
    },
    pluginReview: {
      buildNativeEngineeringEditExecutionEvidence: (input) => ({
        ok: true,
        registry: "openclaw-native-engineering-edit-execution-evidence-v0",
        query: { taskId: input.taskId, limit: input.limit },
        summary: { total: 1, passed: 1, failed: 0, completedTasks: 1, withEngineeringProposal: 1 },
        bounds: { noFilesystemWrite: true, noTaskCreation: true, noApprovalAction: true },
        governance: { canMutate: false, canCreateTask: false, canApproveTask: false, canCallProvider: false },
      }),
      buildNativeEngineeringWriteExecutionEvidence: (input) => ({
        ok: true,
        registry: "openclaw-native-engineering-write-execution-evidence-v0",
        query: { taskId: input.taskId, limit: input.limit },
        summary: { total: 1, passed: 1, failed: 0, completedTasks: 1, withEngineeringProposal: 1 },
        bounds: { noFilesystemWrite: true, noTaskCreation: true, noApprovalAction: true },
        governance: { canMutate: false, canCreateTask: false, canApproveTask: false, canCallProvider: false },
      }),
    },
  });

  const registry = await runtime.buildCapabilityRegistry();
  for (const capabilityId of [
    "sense.openclaw.engineering_tool.edit_execution_evidence",
    "sense.openclaw.engineering_tool.write_execution_evidence",
  ]) {
    const capability = registry.capabilities.find((item) => item.id === capabilityId);
    assert.equal(capability?.kind, "sensor");
    assert.equal(capability?.governance, "audit_only");
    assert.equal(capability?.available, true);
  }

  const edit = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.edit_execution_evidence",
    taskId: editTaskId,
    params: { limit: 4 },
  });
  const write = await runtime.invokeCapability({
    capabilityId: "sense.openclaw.engineering_tool.write_execution_evidence",
    params: { taskId: writeTaskId, limit: 4 },
  });

  assert.equal(edit.response.invoked, true);
  assert.equal(edit.response.result.query.taskId, editTaskId);
  assert.equal(edit.response.summary.kind, "engineering.edit_execution_evidence");
  assert.equal(edit.response.summary.noMutation, true);
  assert.equal(edit.response.summary.noTaskCreation, true);
  assert.equal(edit.response.summary.noApprovalAction, true);
  assert.equal(edit.response.summary.noProviderEgress, true);
  assert.equal(write.response.invoked, true);
  assert.equal(write.response.result.query.taskId, writeTaskId);
  assert.equal(write.response.summary.kind, "engineering.write_execution_evidence");
  assert.equal(write.response.summary.noMutation, true);
  assert.equal(write.response.summary.noTaskCreation, true);
  assert.equal(write.response.summary.noApprovalAction, true);
  assert.equal(write.response.summary.noProviderEgress, true);
  assert.deepEqual(builderInputs, [{ limit: 100 }, { limit: 100 }]);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("/workspace/src"), false);
  assert.deepEqual(events.map((event) => event.name), [
    "policy.evaluated",
    "capability.invoked",
    "policy.evaluated",
    "capability.invoked",
  ]);
});
