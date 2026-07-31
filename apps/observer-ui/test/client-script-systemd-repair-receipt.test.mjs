import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerClientAppRefreshersScript } from "../src/client-script-refreshers-app.mjs";

test("Observer task detail renders compact systemd repair receipt evidence", () => {
  for (const token of [
    "Systemd Repair Receipt:",
    "Systemd Repair Target:",
    "Systemd Repair Journal:",
    "Systemd Repair Hostd:",
    "messagesPersisted",
    "receiptHash",
    "Provider Incident Context:",
    "Provider Incident Target:",
    "Provider Incident Journal:",
    "Provider Incident Experience:",
    "journalMessagesIncluded",
    "providerOutputIncluded",
    "Experience Consumption Receipt:",
    "Experience Consumption Binding:",
    "Experience Consumption Boundary:",
    "experienceMemoryConsumptionReceipt",
    "providerConsumptionProven",
    "downstreamAdvisoryApplicationProven",
    "Recommendation Application:",
    "Recommendation Application Binding:",
    "Recommendation Application Control:",
    "Recommendation Application Boundary:",
    "engineeringRecommendationApplicationReceipt",
    "explicitOperatorSelection",
    "downstreamExecutionProven",
    "downstreamOutcomeProven",
    "Recommendation Execution:",
    "Recommendation Execution Binding:",
    "Recommendation Execution Evidence:",
    "Recommendation Execution Boundary:",
    "engineeringRecommendationExecutionReceipt",
    "executionBindingHash",
    "postActionVerified",
    "Recommendation Outcome:",
    "Recommendation Outcome Binding:",
    "Recommendation Outcome Boundary:",
    "engineeringRecommendationOutcomeReceipt",
    "downstreamTerminalOutcomeObserved",
    "downstreamActionExecutionProven",
    "recommendationEffectivenessProven",
    "Systemd Observation Receipt:",
    "Systemd Observation Target:",
    "Systemd Observation Health:",
    "Systemd Observation Journal:",
    "Systemd Observation Boundary:",
    "systemdIncidentObservationReceipt",
    "Scheduled Systemd Incident:",
    "Scheduled Systemd Target:",
    "Scheduled Systemd Health:",
    "Scheduled Systemd Boundary:",
    "systemdIncidentObservation",
    "Fixed Unit Incident Triage:",
    "Fixed Unit Triage Source:",
    "Fixed Unit Triage Target:",
    "Fixed Unit Triage Boundary:",
    "systemdIncidentTriage",
    "Fixed Unit Repair Promotion:",
    "Fixed Unit Repair Source:",
    "Fixed Unit Repair Target:",
    "Fixed Unit Repair Gate:",
    "systemdIncidentRepairPromotion",
    "callsProvider",
    "authorizesRepair",
  ]) {
    assert.match(observerClientAppRefreshersScript, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.doesNotMatch(observerClientAppRefreshersScript, /journal\.entries/u);
});

test("generated Observer client remains syntactically valid with repair receipt readback", () => {
  assert.doesNotThrow(() => new Function(`return (async () => {${clientScript()}\n});`));
});
