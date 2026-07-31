import { createHash } from "node:crypto";

import {
  validateNativeEngineeringRecommendationApplicationReceipt,
} from "./native-engineering-recommendation-application-receipt.mjs";
import {
  validateNativeEngineeringRecommendationExecutionReceipt,
} from "./native-engineering-recommendation-execution-receipt.mjs";

export const NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_REGISTRY =
  "openclaw-native-engineering-recommendation-outcome-receipt-v0";
export const NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_V1_REGISTRY =
  "openclaw-native-engineering-recommendation-outcome-receipt-v1";

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,200}$/u;
const SAFE_PHASE = /^[a-zA-Z0-9._:-]{1,120}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TERMINAL_OUTCOMES = new Set(["completed", "failed"]);

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function buildNativeEngineeringRecommendationOutcomeReceipt({
  applicationReceipt,
  executionReceipt = null,
  downstreamTaskId,
  terminalOutcome,
  terminalPhase,
  observedAt = new Date().toISOString(),
} = {}) {
  const application = validateNativeEngineeringRecommendationApplicationReceipt(applicationReceipt);
  const execution = validateNativeEngineeringRecommendationExecutionReceipt(executionReceipt);
  if (!application
    || !SAFE_ID.test(downstreamTaskId ?? "")
    || downstreamTaskId !== application.downstreamTaskId
    || !TERMINAL_OUTCOMES.has(terminalOutcome)
    || !SAFE_PHASE.test(terminalPhase ?? "")) {
    return null;
  }

  const executionBound = execution?.applicationReceiptHash === application.receiptHash
    && execution?.downstreamTaskId === downstreamTaskId
    && execution?.providerTaskId === application.providerTaskId;
  const receipt = {
    registry: executionBound
      ? NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_V1_REGISTRY
      : NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_REGISTRY,
    status: executionBound
      ? "terminal_outcome_with_execution_observed"
      : "terminal_outcome_observed",
    observedAt,
    providerTaskId: application.providerTaskId,
    downstreamTaskId,
    applicationReceiptHash: application.receiptHash,
    ...(executionBound ? { executionReceiptHash: execution.receiptHash } : {}),
    terminalOutcome,
    terminalPhase,
    outcomeBindingHash: sha256(JSON.stringify({
      applicationReceiptHash: application.receiptHash,
      ...(executionBound ? { executionReceiptHash: execution.receiptHash } : {}),
      downstreamTaskId,
      terminalOutcome,
      terminalPhase,
    })),
    governance: {
      applicationProven: true,
      downstreamTerminalOutcomeObserved: true,
      ...(executionBound ? { executionReceiptBound: true } : {}),
      downstreamActionExecutionProven: executionBound,
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

function validateCommon(value, { executionBound }) {
  if (!value
    || !SAFE_ID.test(value.providerTaskId ?? "")
    || !SAFE_ID.test(value.downstreamTaskId ?? "")
    || !SHA256.test(value.applicationReceiptHash ?? "")
    || !TERMINAL_OUTCOMES.has(value.terminalOutcome)
    || !SAFE_PHASE.test(value.terminalPhase ?? "")
    || !SHA256.test(value.outcomeBindingHash ?? "")
    || value.outcomeBindingHash !== sha256(JSON.stringify({
      applicationReceiptHash: value.applicationReceiptHash,
      ...(executionBound ? { executionReceiptHash: value.executionReceiptHash } : {}),
      downstreamTaskId: value.downstreamTaskId,
      terminalOutcome: value.terminalOutcome,
      terminalPhase: value.terminalPhase,
    }))
    || !SHA256.test(value.receiptHash ?? "")
    || value.governance?.applicationProven !== true
    || value.governance?.downstreamTerminalOutcomeObserved !== true
    || (executionBound
      ? value.governance?.executionReceiptBound !== true
      : value.governance?.executionReceiptBound !== undefined)
    || value.governance?.downstreamActionExecutionProven !== executionBound
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

export function validateNativeEngineeringRecommendationOutcomeReceipt(value) {
  if (value?.registry === NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_REGISTRY
    && value.status === "terminal_outcome_observed"
    && !("executionReceiptHash" in value)) {
    return validateCommon(value, { executionBound: false });
  }
  if (value?.registry === NATIVE_ENGINEERING_RECOMMENDATION_OUTCOME_RECEIPT_V1_REGISTRY
    && value.status === "terminal_outcome_with_execution_observed"
    && SHA256.test(value.executionReceiptHash ?? "")) {
    return validateCommon(value, { executionBound: true });
  }
  return null;
}
