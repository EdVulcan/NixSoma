import { createHash } from "node:crypto";

import {
  validateNativeEngineeringRecommendationApplicationReceipt,
} from "./native-engineering-recommendation-application-receipt.mjs";

export const NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_REGISTRY =
  "openclaw-native-engineering-recommendation-outcome-receipt-v0";

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SAFE_PHASE = /^[a-zA-Z0-9._:-]{1,120}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TERMINAL_OUTCOMES = new Set(["completed", "failed"]);

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function buildNativeEngineeringRecommendationOutcomeReceipt({
  applicationReceipt,
  downstreamTaskId,
  terminalOutcome,
  terminalPhase,
  observedAt = new Date().toISOString(),
} = {}) {
  const application = validateNativeEngineeringRecommendationApplicationReceipt(applicationReceipt);
  if (!application
    || !SAFE_ID.test(downstreamTaskId ?? "")
    || downstreamTaskId !== application.downstreamTaskId
    || !TERMINAL_OUTCOMES.has(terminalOutcome)
    || !SAFE_PHASE.test(terminalPhase ?? "")) {
    return null;
  }

  const receipt = {
    registry: NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_REGISTRY,
    status: "terminal_outcome_observed",
    observedAt,
    providerTaskId: application.providerTaskId,
    downstreamTaskId,
    applicationReceiptHash: application.receiptHash,
    terminalOutcome,
    terminalPhase,
    outcomeBindingHash: sha256(JSON.stringify({
      applicationReceiptHash: application.receiptHash,
      downstreamTaskId,
      terminalOutcome,
      terminalPhase,
    })),
    governance: {
      applicationProven: true,
      downstreamTerminalOutcomeObserved: true,
      downstreamActionExecutionProven: false,
      recommendationEffectivenessProven: false,
      causalAttribution: false,
      changesRanking: false,
      changesPolicy: false,
      createsTask: false,
      createsApproval: false,
      executesAction: false,
      callsProvider: false,
      outcomeContentPersisted: false,
    },
  };
  return {
    ...receipt,
    receiptHash: sha256(JSON.stringify(receipt)),
  };
}

export function validateNativeEngineeringRecommendationOutcomeReceipt(value) {
  if (!value
    || value.registry !== NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_REGISTRY
    || value.status !== "terminal_outcome_observed"
    || !SAFE_ID.test(value.providerTaskId ?? "")
    || !SAFE_ID.test(value.downstreamTaskId ?? "")
    || !SHA256.test(value.applicationReceiptHash ?? "")
    || !TERMINAL_OUTCOMES.has(value.terminalOutcome)
    || !SAFE_PHASE.test(value.terminalPhase ?? "")
    || !SHA256.test(value.outcomeBindingHash ?? "")
    || value.outcomeBindingHash !== sha256(JSON.stringify({
      applicationReceiptHash: value.applicationReceiptHash,
      downstreamTaskId: value.downstreamTaskId,
      terminalOutcome: value.terminalOutcome,
      terminalPhase: value.terminalPhase,
    }))
    || !SHA256.test(value.receiptHash ?? "")
    || value.governance?.applicationProven !== true
    || value.governance?.downstreamTerminalOutcomeObserved !== true
    || value.governance?.downstreamActionExecutionProven !== false
    || value.governance?.recommendationEffectivenessProven !== false
    || value.governance?.causalAttribution !== false
    || value.governance?.changesRanking !== false
    || value.governance?.changesPolicy !== false
    || value.governance?.createsTask !== false
    || value.governance?.createsApproval !== false
    || value.governance?.executesAction !== false
    || value.governance?.callsProvider !== false
    || value.governance?.outcomeContentPersisted !== false) {
    return null;
  }
  const { receiptHash, ...receipt } = value;
  return sha256(JSON.stringify(receipt)) === receiptHash ? value : null;
}
