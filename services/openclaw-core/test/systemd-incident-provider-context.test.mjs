import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildSystemdIncidentProviderContext,
  materialiseStoredSystemdIncidentProviderExecution,
  materialiseSystemdIncidentProviderHandoff,
} from "../src/systemd-incident-provider-context.mjs";
import { createSystemdIncidentRepairTask } from "./systemd-incident-fixture.mjs";

function rehashReceipt(receipt) {
  const { receiptHash: _receiptHash, ...content } = receipt;
  receipt.receiptHash = `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

test("systemd incident provider context projects only bounded receipt evidence", () => {
  const sourceTask = createSystemdIncidentRepairTask();
  const context = buildSystemdIncidentProviderContext({ sourceTask });

  assert.equal(context.ok, true, context.reason);
  assert.equal(context.projection.target.unit, "openclaw-event-hub.service");
  assert.equal(context.projection.target.healthServiceKey, "eventHub");
  assert.equal(context.projection.journalEvidence.returned, 3);
  assert.equal(context.projection.journalEvidence.messagesIncluded, false);
  assert.equal(context.projection.restoredHealthy, false);
  assert.equal(context.projection.operatorRecoveryRecommended, true);
  assert.equal(context.evidence.systemdIncidentContextIncluded, true);
  assert.equal(context.evidence.contextContentIncluded, false);
  assert.match(context.contextContentHash, /^[a-f0-9]{64}$/u);
  assert.match(context.requestEnvelope.messages[0].content, /engineering_recommendation_v0|Return only a JSON object/u);
  const serialized = JSON.stringify({ projection: context.projection, evidence: context.evidence });
  assert.doesNotMatch(serialized, /private-health|private diagnostic|hostd-private-invocation/u);
  assert.doesNotMatch(serialized, /job\/72|kernel_so_peercred/u);
});

test("incident handoff materializes and later reconstructs one deterministic approved request", () => {
  const sourceTask = createSystemdIncidentRepairTask();
  const tasks = new Map([[sourceTask.id, sourceTask]]);
  const handoff = materialiseSystemdIncidentProviderHandoff({
    tasks,
    liveProviderExecution: {
      requested: true,
      credentialReference: "openclaw://credential/deepseek-api-key",
      responseContract: "engineering_recommendation_v0",
      contextPacket: {
        requested: true,
        sourceTaskId: sourceTask.id,
        includeSystemdIncidentReceipt: true,
      },
    },
  });
  assert.equal(handoff.ok, true, handoff.reason);
  assert.equal(handoff.liveProviderExecution.requestEnvelope.messages.length, 1);
  assert.equal(handoff.liveProviderExecution.contextContentHash, handoff.evidence.contextContentHash);

  const handoffTask = {
    id: "provider-incident-task-1",
    cloudConsciousnessLiveProviderEgressExecution: {
      systemdIncidentContext: handoff.incidentContext,
      incidentContextContentHash: handoff.evidence.contextContentHash,
    },
  };
  tasks.set(handoffTask.id, handoffTask);
  const execution = materialiseStoredSystemdIncidentProviderExecution({ handoffTask, tasks });

  assert.equal(execution.handled, true);
  assert.equal(execution.ok, true, execution.reason);
  assert.equal(execution.liveProviderExecution.taskId, handoffTask.id);
  assert.equal(execution.liveProviderExecution.contextPacket.sourceTaskId, sourceTask.id);
  assert.equal(execution.liveProviderExecution.authorization.liveProviderCallEnabled, true);
  assert.equal(
    execution.liveProviderExecution.requestEnvelope.messages[0].content,
    handoff.liveProviderExecution.requestEnvelope.messages[0].content,
  );
  assert.equal(execution.evidence.executionTaskId, handoffTask.id);
});

test("incident context fails closed when receipt or stored projection changes", () => {
  const sourceTask = createSystemdIncidentRepairTask();
  sourceTask.outcome.details.incidentReceipt.restoredHealthy = true;
  const invalidReceipt = buildSystemdIncidentProviderContext({ sourceTask });
  assert.equal(invalidReceipt.ok, false);
  assert.equal(invalidReceipt.reason, "systemd_incident_receipt_hash_mismatch");

  const validSource = createSystemdIncidentRepairTask();
  const built = buildSystemdIncidentProviderContext({ sourceTask: validSource });
  const handoffTask = {
    id: "provider-incident-task-tampered",
    cloudConsciousnessLiveProviderEgressExecution: {
      systemdIncidentContext: {
        ...built.projection,
        restoredHealthy: true,
      },
      incidentContextContentHash: built.contextContentHash,
    },
  };
  const execution = materialiseStoredSystemdIncidentProviderExecution({
    handoffTask,
    tasks: new Map([[validSource.id, validSource]]),
  });
  assert.equal(execution.handled, true);
  assert.equal(execution.ok, false);
  assert.equal(execution.reason, "systemd_incident_stored_context_mismatch");
});

test("incident context rejects internally inconsistent fixed-unit evidence", () => {
  const sourceTask = createSystemdIncidentRepairTask();
  const receipt = sourceTask.outcome.details.incidentReceipt;
  receipt.journalEvidence.unit = "openclaw-system-sense.service";
  rehashReceipt(receipt);

  const context = buildSystemdIncidentProviderContext({ sourceTask });

  assert.equal(context.ok, false);
  assert.equal(context.reason, "systemd_incident_unit_binding_mismatch");
});
