import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExperienceConsumptionCandidate,
  finaliseExperienceConsumptionReceipt,
  validateExperienceConsumptionReceipt,
} from "../src/native-engineering-experience-consumption-receipt.mjs";

function candidate() {
  return buildExperienceConsumptionCandidate({
    experienceMemory: {
      records: [
        { id: "experience-a" },
        { id: "experience-b" },
        { id: "experience-c" },
        { id: "experience-d" },
        { id: "experience-over-limit" },
      ],
    },
    executionTaskId: "provider-task-1",
    sourceTaskId: "engineering-task-1",
    contextContentHash: "a".repeat(64),
    responseContract: "engineering_recommendation_v0",
  });
}

test("experience consumption receipt binds the exact bounded records to a successful provider response", () => {
  const receipt = finaliseExperienceConsumptionReceipt({
    candidate: candidate(),
    providerResult: {
      ok: true,
      audit: {
        requestContentHash: "b".repeat(64),
        providerResponseCreated: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
      },
    },
    consumedAt: "2026-07-31T11:30:00.000Z",
  });

  assert.equal(receipt.recordCount, 4);
  assert.deepEqual(receipt.recordIds, ["experience-a", "experience-b", "experience-c", "experience-d"]);
  assert.equal(receipt.executionTaskId, "provider-task-1");
  assert.equal(receipt.sourceTaskId, "engineering-task-1");
  assert.equal(receipt.governance.providerConsumptionProven, true);
  assert.equal(receipt.governance.downstreamAdvisoryApplicationProven, false);
  assert.equal(receipt.governance.causalAttribution, false);
  assert.equal(validateExperienceConsumptionReceipt(receipt), receipt);
});

test("experience consumption receipt stays absent before a successful provider response", () => {
  for (const override of [
    { ok: false },
    { providerResponseCreated: false },
    { endpointContacted: false },
    { networkEgress: false },
    { transmitsExternally: false },
    { requestContentHash: null },
  ]) {
    const providerResult = {
      ok: override.ok ?? true,
      audit: {
        requestContentHash: "b".repeat(64),
        providerResponseCreated: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
        ...override,
      },
    };
    assert.equal(finaliseExperienceConsumptionReceipt({ candidate: candidate(), providerResult }), null);
  }
  assert.equal(buildExperienceConsumptionCandidate({
    experienceMemory: { records: [] },
    executionTaskId: "provider-task-1",
    sourceTaskId: "engineering-task-1",
    contextContentHash: "a".repeat(64),
  }), null);
});

test("experience consumption receipt rejects changed bindings", () => {
  const receipt = finaliseExperienceConsumptionReceipt({
    candidate: candidate(),
    providerResult: {
      ok: true,
      audit: {
        requestContentHash: "b".repeat(64),
        providerResponseCreated: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
      },
    },
  });
  assert.equal(validateExperienceConsumptionReceipt({ ...receipt, sourceTaskId: "changed-task" }), null);
  assert.equal(validateExperienceConsumptionReceipt({ ...receipt, recordSetHash: "c".repeat(64) }), null);
  assert.equal(validateExperienceConsumptionReceipt({
    ...receipt,
    governance: { ...receipt.governance, causalAttribution: true },
  }), null);
});
