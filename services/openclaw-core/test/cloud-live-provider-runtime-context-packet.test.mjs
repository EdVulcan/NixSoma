import test from "node:test";
import assert from "node:assert/strict";

import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_REGISTRY,
  materialiseCloudLiveProviderContextPacketExecution,
} from "../src/cloud-live-provider-runtime-context-packet.mjs";

function contextTask() {
  return {
    id: "task-context-1",
    type: "source_command_task",
    status: "completed",
    goal: "Verify the bounded engineering context.",
    outcome: {
      kind: "completed",
      details: {
        commandTranscript: [{
          invocationId: "inv-context-1",
          command: "npm test",
          exitCode: 0,
          timedOut: false,
          stdout: "tests passed; api_key=should-be-redacted",
          stderr: "",
        }],
      },
    },
  };
}

function contextInputs() {
  const task = contextTask();
  return {
    task,
    tasks: new Map([[task.id, task]]),
    transcriptRecords: [{
      taskId: task.id,
      index: 0,
      invocationId: "inv-context-1",
      command: "npm test",
      exitCode: 0,
      timedOut: false,
      stdout: "tests passed; api_key=should-be-redacted",
      stderr: "",
    }],
    capabilityInvocations: [{
      id: "inv-context-1",
      capability: { id: "act.system.command.execute" },
      request: { taskId: task.id, command: "npm test" },
      summary: { exitCode: 0, timedOut: false },
    }],
  };
}

test("context packet handoff materialises one bounded provider message with compact evidence", async () => {
  const input = contextInputs();
  const result = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      contextPacket: {
        requested: true,
        taskId: input.task.id,
        instruction: "Recommend the next local verification step.",
      },
    },
    buildExperienceMemoryReadModel: ({ taskType }) => ({
      ok: true,
      registry: "openclaw-native-engineering-experience-memory-v0",
      records: [{
        id: "experience-provider-1",
        taskType,
        lesson: "Reuse bounded verification evidence.",
        outcome: "completed",
        executionPhase: "completed",
        applicabilityTokens: ["type:source_command_task"],
        confidence: 0.72,
        recordedAt: "2026-07-16T00:00:00.000Z",
        source: { registry: "openclaw-task-lifecycle-terminal-v0", taskId: "task-context-1", outcomeHash: "a".repeat(64) },
        relevance: 101,
      }],
      summary: { storedRecords: 1, recalledRecords: 1, status: "recalled", advisoryOnly: true },
      bounds: { maxRecallRecords: 8 },
      governance: { advisoryOnly: true },
      auditEvidence: { summary: { storedRecords: 1, recalledRecords: 1, queryTokenCount: 1, queryHash: "b".repeat(64), advisoryOnly: true } },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidence.registry, CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_REGISTRY);
  assert.equal(result.evidence.responseContract, "engineering_recommendation_v0");
  assert.equal(result.evidence.sourceTranscriptRecords, 1);
  assert.equal(result.evidence.contextContentIncluded, false);
  assert.equal(result.evidence.requestEnvelopeMaterialized, true);
  assert.equal(result.evidence.experienceMemoryIncluded, true);
  assert.equal(result.evidence.experienceMemoryRecalled, 1);
  assert.equal(result.evidence.experienceMemoryAdvisoryOnly, true);
  assert.equal(result.liveProviderExecution.requestEnvelope.messages.length, 1);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /npm test/);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /Return only a JSON object/);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /Reuse bounded verification evidence/);
  assert.equal(result.liveProviderExecution.responseContract, "engineering_recommendation_v0");
  assert.doesNotMatch(result.liveProviderExecution.requestEnvelope.messages[0].content, /should-be-redacted/);
  assert.doesNotMatch(JSON.stringify(result.evidence), /tests passed/);
});

test("context packet handoff rejects a different task and an ambiguous request envelope", async () => {
  const input = contextInputs();
  const mismatch = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      contextPacket: { requested: true, taskId: "task-other" },
    },
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, "live_provider_context_task_mismatch");

  const conflict = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      requestEnvelope: { messages: [{ role: "user", content: "ambiguous" }] },
      contextPacket: { requested: true, taskId: input.task.id },
    },
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "live_provider_context_request_envelope_conflict");

  const unsupportedContract = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      contextPacket: {
        requested: true,
        taskId: input.task.id,
        responseContract: "unrecognized_contract_v99",
      },
    },
  });
  assert.equal(unsupportedContract.ok, false);
  assert.equal(unsupportedContract.reason, "live_provider_context_response_contract_not_supported");
});

test("context packet handoff can explicitly carry work-view observation and plan/todo summaries", async () => {
  const input = contextInputs();
  input.tasks.get(input.task.id).workView = {
    sessionId: "session-context-1",
    workViewId: "work-view-context-1",
  };
  input.tasks.get(input.task.id).goal = "Review api_key=plan-secret without exposing it";
  input.tasks.get(input.task.id).plan = {
    planner: "test-planner",
    strategy: "bounded-verification",
    steps: [{
      id: "verify-step",
      phase: "verify",
      title: "Inspect the bounded verification evidence",
      status: "pending",
    }],
  };
  const result = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    runtimeState: { currentTaskId: input.task.id },
    workbenchRecords: new Map([[input.task.id, {
      key: input.task.id,
      recordId: "workbench-context-1",
      taskId: input.task.id,
      revision: 2,
      todos: [{ id: "todo-1", description: "Review the provider recommendation", status: "in_progress" }],
    }]]),
    sessionManagerUrl: "http://session-manager",
    readWorkViewState: async () => ({
      ok: true,
      data: {
        ok: true,
        workView: {
          workViewId: "work-view-context-1",
          status: "ready",
          visibility: "visible",
          helperStatus: "active",
          browserStatus: "running",
        },
        session: {
          sessionId: "session-context-1",
          status: "ready",
          role: "ai-work-view",
        },
        trustedSession: {
          sessionIdentity: {
            status: "authoritative",
            sessionManagerBacked: true,
            browserRuntimeBacked: true,
          },
          helperRuntime: {
            status: "active",
            actionAuthority: "active",
            leaseMatched: true,
            sidecar: {
              captureSourceStatus: "ready",
              captureFreshness: "fresh",
              captureAgeMs: 42,
              captureObservation: {
                registry: "capture-v0",
                sequence: 9,
                capturedAt: "2026-07-14T01:00:00.000Z",
                observedAt: "2026-07-14T01:00:00.100Z",
                activeUrl: "https://private.example/should-not-escape",
                title: "Private page title",
                visibleTextBlockCount: 3,
                visualFrame: {
                  available: true,
                  fresh: true,
                  sequence: 9,
                  sha256: "a".repeat(64),
                  width: 960,
                  height: 540,
                  byteLength: 12000,
                  sourceScope: "ai_owned_active_page_only",
                  dataUrl: "data:image/jpeg;base64,private",
                },
                semanticTargets: {
                  available: true,
                  itemCount: 2,
                  inventorySha256: "b".repeat(64),
                  frameSequence: 9,
                  frameSha256: "a".repeat(64),
                  items: [{ selector: "#private", inputValue: "secret" }],
                },
              },
            },
          },
        },
      },
    }),
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      contextPacket: {
        requested: true,
        taskId: input.task.id,
        includeWorkView: true,
        includeWorkViewObservation: true,
        includePlanTodo: true,
        instruction: "Recommend the next bounded verification step.",
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidence.workViewObservationIncluded, true);
  assert.equal(result.evidence.workViewObservationStatus, "ready");
  assert.equal(result.evidence.semanticTargetCount, 2);
  assert.equal(result.evidence.semanticActionDecisionStatus, "ready_for_target_selection");
  assert.equal(result.evidence.semanticActionReady, true);
  assert.equal(result.evidence.planTodoEvidenceIncluded, true);
  assert.equal(result.evidence.planTodoTodoSource, "workbench_storage");
  assert.equal(result.liveProviderExecution.contextPacket.includeWorkViewObservation, true);
  assert.equal(result.liveProviderExecution.contextPacket.includePlanTodo, true);
  const content = result.liveProviderExecution.requestEnvelope.messages[0].content;
  assert.match(content, /workViewObservationIncluded.*true/);
  assert.match(content, /workViewObservationStatus.*ready/);
  assert.match(content, /semanticActionReady.*true/);
  assert.match(content, /openclaw-native-engineering-plan-todo-evidence-v0/);
  assert.doesNotMatch(content, /https:\/\/private\.example/);
  assert.doesNotMatch(content, /data:image/);
  assert.doesNotMatch(content, /private page title/);
  assert.doesNotMatch(content, /"selector"|"inputValue"|"leaseId"/);
  assert.doesNotMatch(JSON.stringify(result.evidence), /private|secret/);
  assert.doesNotMatch(content, /plan-secret/);
});

test("context packet handoff rejects observation without the explicit work-view request", async () => {
  const input = contextInputs();
  const result = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      contextPacket: {
        requested: true,
        taskId: input.task.id,
        includeWorkViewObservation: true,
      },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "live_provider_context_observation_requires_work_view");
});

test("context packet handoff can bind a provider task to a separate source engineering task", async () => {
  const input = contextInputs();
  const sourceTask = input.task;
  const executionTask = {
    id: "egress-context-task-1",
    type: "cloud_consciousness_live_provider_egress_execution_task",
    status: "queued",
    goal: "Request a bounded provider recommendation",
  };
  input.tasks.set(executionTask.id, executionTask);

  const result = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    task: executionTask,
    liveProviderExecution: {
      requested: true,
      taskId: executionTask.id,
      contextPacket: {
        requested: true,
        taskId: executionTask.id,
        sourceTaskId: sourceTask.id,
        instruction: "Review the source task evidence and recommend the next bounded step.",
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidence.taskId, sourceTask.id);
  assert.equal(result.evidence.executionTaskId, executionTask.id);
  assert.equal(result.evidence.sourceTaskId, sourceTask.id);
  assert.equal(result.evidence.sourceTranscriptRecords, 1);
  assert.equal(result.liveProviderExecution.contextPacket.taskId, executionTask.id);
  assert.equal(result.liveProviderExecution.contextPacket.sourceTaskId, sourceTask.id);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /npm test/);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /task-context-1/);

  const missing = await materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    task: executionTask,
    liveProviderExecution: {
      requested: true,
      taskId: executionTask.id,
      contextPacket: {
        requested: true,
        taskId: executionTask.id,
        sourceTaskId: "missing-source-task",
      },
    },
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "live_provider_context_source_task_not_found");
});
