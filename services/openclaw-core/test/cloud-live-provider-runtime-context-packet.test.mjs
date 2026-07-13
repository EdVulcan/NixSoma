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

test("context packet handoff materialises one bounded provider message with compact evidence", () => {
  const input = contextInputs();
  const result = materialiseCloudLiveProviderContextPacketExecution({
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
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidence.registry, CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_REGISTRY);
  assert.equal(result.evidence.responseContract, "engineering_recommendation_v0");
  assert.equal(result.evidence.sourceTranscriptRecords, 1);
  assert.equal(result.evidence.contextContentIncluded, false);
  assert.equal(result.evidence.requestEnvelopeMaterialized, true);
  assert.equal(result.liveProviderExecution.requestEnvelope.messages.length, 1);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /npm test/);
  assert.match(result.liveProviderExecution.requestEnvelope.messages[0].content, /Return only a JSON object/);
  assert.equal(result.liveProviderExecution.responseContract, "engineering_recommendation_v0");
  assert.doesNotMatch(result.liveProviderExecution.requestEnvelope.messages[0].content, /should-be-redacted/);
  assert.doesNotMatch(JSON.stringify(result.evidence), /tests passed/);
});

test("context packet handoff rejects a different task and an ambiguous request envelope", () => {
  const input = contextInputs();
  const mismatch = materialiseCloudLiveProviderContextPacketExecution({
    ...input,
    liveProviderExecution: {
      requested: true,
      taskId: input.task.id,
      contextPacket: { requested: true, taskId: "task-other" },
    },
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, "live_provider_context_task_mismatch");

  const conflict = materialiseCloudLiveProviderContextPacketExecution({
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

  const unsupportedContract = materialiseCloudLiveProviderContextPacketExecution({
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
