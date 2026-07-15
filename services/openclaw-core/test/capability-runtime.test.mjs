import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";

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
    pluginReview: {
      buildNativePluginManifestProfile: () => ({ ok: true, plugin: { id: "plugin-a" }, capabilities: [] }),
      buildNativeOpenClawToolCatalogProfile: () => ({ ok: true, summary: {} }),
      buildNativeOpenClawWorkspaceSemanticIndex: () => ({ ok: true, summary: {}, governance: {} }),
      buildNativeOpenClawWorkspaceSymbolLookup: () => ({ ok: true, summary: {}, query: {}, governance: {} }),
      buildNativeOpenClawWorkspaceEditTargetSelection: () => ({ ok: true }),
      buildNativeOpenClawPromptSemanticsProfile: () => ({ ok: true }),
      buildOpenClawPluginManifestMap: () => ({ ok: true }),
      buildOpenClawPluginCapabilityPlan: () => ({ ok: true }),
      ...overrides.pluginReview,
    },
    policyEvaluator,
    publishEvent: async (name, body) => {
      events.push({ name, body });
    },
    listCommandTranscriptRecords: overrides.listCommandTranscriptRecords ?? (() => []),
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
  assert.equal(runtime.capabilityByIntent("cloud.provider.send")?.id, "boundary.cross_domain.approval");
  assert.ok(calls.health.some((url) => url === "http://127.0.0.1:4106/health"));
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
  assert.equal(result.response.reason, "policy_requires_approval");
  assert.equal(state.capabilityInvocationLog.length, 1);
  assert.equal(state.capabilityInvocationLog[0].blocked, true);
  assert.deepEqual(events.map((event) => event.name), ["policy.evaluated", "capability.blocked"]);
  assert.equal(calls.persisted, 1);
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
  assert.equal(result.response.summary.kind, "engineering.work_view_observation");
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
