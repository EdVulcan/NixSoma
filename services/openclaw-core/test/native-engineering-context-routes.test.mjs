import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleNativeEngineeringContextRoute } from "../src/native-engineering-context-routes.mjs";

async function invoke({
  method = "POST",
  path = "/plugins/native-adapter/engineering-microcompact/projection",
  body = {},
  publishEvent = async () => {},
  state = { tasks: new Map() },
  executor = { listCommandTranscriptRecords: () => [] },
  planBuilder = { listCapabilityInvocations: () => [] },
  sessionManagerUrl = "http://127.0.0.1:4102",
  readWorkViewState = async () => ({ ok: false, data: null }),
} = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  const response = { statusCode: null, body: null };
  const res = {
    writeHead(statusCode) { response.statusCode = statusCode; },
    end(payload) { response.body = JSON.parse(String(payload)); },
  };
  const handled = await handleNativeEngineeringContextRoute({
    req,
    res,
    requestUrl: new URL(`http://127.0.0.1${path}`),
    state,
    executor,
    planBuilder,
    publishEvent,
    sessionManagerUrl,
    readWorkViewState,
  });
  return { handled, ...response };
}

test("microcompact projection route returns transformed copy and summary-only audit event", async () => {
  const events = [];
  const raw = "sensitive-tool-output-".repeat(100);
  const response = await invoke({
    body: {
      thresholdChars: 100,
      protectRecentAssistantTurns: 0,
      messages: [
        { role: "assistant", content: [{ type: "text", text: "old" }] },
        { role: "toolResult", toolName: "cc_grep", content: [{ type: "text", text: raw }] },
        { role: "assistant", content: [{ type: "text", text: "new" }] },
      ],
    },
    publishEvent: async (name, payload) => events.push({ name, payload }),
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.registry, "openclaw-native-engineering-microcompact-projection-v0");
  assert.equal(response.body.summary.compactedMessages, 1);
  assert.equal(JSON.stringify(events).includes("sensitive-tool-output"), false);
  assert.equal(events[0].name, "native_engineering.microcompact_projection_built");
});

test("microcompact projection route rejects invalid input and other methods", async () => {
  const invalid = await invoke({ body: { messages: "invalid" } });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body.error, /requires messages/u);

  const method = await invoke({ method: "GET" });
  assert.equal(method.statusCode, 405);
});

test("microcompact projection route fails closed when audit publication fails", async () => {
  const response = await invoke({
    body: { messages: [] },
    publishEvent: async () => ({ ok: false, error: "event-hub unavailable" }),
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.ok, false);
  assert.match(response.body.error, /audit is unavailable/u);
  assert.equal("messages" in response.body, false);
});

test("engineering context packet route assembles existing task evidence without provider use", async () => {
  const events = [];
  const task = {
    id: "task-context-1",
    type: "system_task",
    status: "completed",
    goal: "Assemble local engineering context",
    outcome: {
      kind: "completed",
      details: {
        commandTranscript: [{ command: "npm test", exitCode: 0, timedOut: false }],
      },
    },
  };
  const record = {
    taskId: task.id,
    index: 0,
    command: "npm test",
    stdout: "password=do-not-include ".repeat(100),
    stderr: "",
    exitCode: 0,
    timedOut: false,
  };
  const response = await invoke({
    path: "/plugins/native-adapter/engineering-context/packet",
    body: { taskId: task.id, thresholdChars: 100, protectRecentAssistantTurns: 0 },
    state: { tasks: new Map([[task.id, task]]) },
    executor: { listCommandTranscriptRecords: () => [record] },
    planBuilder: { listCapabilityInvocations: () => [] },
    publishEvent: async (name, payload) => events.push({ name, payload }),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.registry, "openclaw-native-engineering-context-packet-v0");
  assert.equal(response.body.summary.redactions > 0, true);
  assert.equal(JSON.stringify(response.body).includes("do-not-include"), false);
  assert.equal(response.body.governance.callsProvider, false);
  assert.equal(response.body.governance.networkEgress, false);
  assert.equal(events[0].name, "native_engineering.context_packet_built");
  assert.equal(JSON.stringify(events).includes("do-not-include"), false);
});

test("engineering context packet route reads the existing session-manager owner when requested", async () => {
  const task = {
    id: "task-work-view-1",
    type: "native_engineering_lsp_lifecycle",
    status: "running",
    goal: "Use the trusted work view for engineering context",
    workViewStrategy: "openclaw-native-engineering-lsp-lifecycle",
    plan: {
      planner: "capability-aware-v1",
      strategy: "rule-v1",
      status: "running",
      steps: [{ id: "verify-step", title: "Run bounded verification", status: "pending", phase: "verifying_result" }],
    },
    workView: {
      sessionId: "session-current",
      workViewId: "work-view-primary",
    },
  };
  const response = await invoke({
    path: "/plugins/native-adapter/engineering-context/packet",
    body: { taskId: task.id, includeWorkView: true, includeWorkViewObservation: true, includePlanTodo: true },
    state: { tasks: new Map([[task.id, task]]), runtimeState: {}, nativeEngineeringPlanTodoWorkbenchRecords: new Map() },
    readWorkViewState: async () => ({
      ok: true,
      data: {
        session: { sessionId: "session-current", status: "running" },
        workView: {
          workViewId: "work-view-primary",
          status: "ready",
          helperStatus: "active",
          trustedSession: {
            sessionIdentity: { status: "authoritative" },
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
                  semanticTargets: { available: true, itemCount: 1 },
                  visualFrame: { available: true, fresh: true, sequence: 4, sha256: "c".repeat(64) },
                },
              },
            },
            recoveryRecommendation: { action: "none" },
          },
        },
      },
    }),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.workViewAssociation.registry, "openclaw-native-engineering-work-view-association-v0");
  assert.equal(response.body.workViewAssociation.summary.status, "bound");
  assert.equal(response.body.workViewAssociation.observation.status, "ready");
  assert.equal(response.body.workViewAssociation.observation.semanticTargets.itemCount, 1);
  assert.equal(response.body.summary.workViewObservationIncluded, true);
  assert.equal(response.body.summary.planTodoEvidenceIncluded, true);
  assert.equal(response.body.summary.planTodoCurrentAction, "create_verification_task");
  assert.equal(response.body.governance.readsPlanTodoEvidence, true);
  assert.equal(response.body.messages.some((message) => message.evidenceKind === "engineering_plan_todo_evidence"), true);
  assert.equal(response.body.governance.readsTrustedWorkViewObservation, true);
  assert.equal(response.body.governance.readsTrustedWorkViewState, true);
  assert.equal(JSON.stringify(response.body).includes("leaseId"), false);
});
