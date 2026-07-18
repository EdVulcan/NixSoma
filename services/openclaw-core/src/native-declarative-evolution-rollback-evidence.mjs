import {
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";

export const NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_EVIDENCE_REGISTRY = "openclaw-native-declarative-evolution-rollback-evidence-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_OWNER = "deferred_manual_operator";

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export function buildNativeDeclarativeEvolutionManualRollbackEvidence({
  receipt,
  preActivationHealthHash,
  postActivationHealth,
  now = () => new Date().toISOString(),
} = {}) {
  const activationReceiptBound = receipt?.registry === HOSTD_ACTIVATION_RECEIPT_REGISTRY
    && isSha256(receipt.receiptHash)
    && receipt.targetPath === HOSTD_ACTIVATION_TARGET_PATH
    && receipt.status === "passed"
    && receipt.activationExecuted === true
    && receipt.generationSwitched === true
    && receipt.rollbackExecuted === false;
  const preHealthBound = isSha256(preActivationHealthHash);
  const postHealthStatus = postActivationHealth?.status ?? "unavailable";
  const postHealthBound = isSha256(postActivationHealth?.hostHealthHash);
  const healthFailed = postHealthStatus !== "healthy";
  const ready = activationReceiptBound && preHealthBound && postHealthBound && healthFailed;

  return {
    ok: ready,
    blocked: !ready,
    registry: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_EVIDENCE_REGISTRY,
    status: ready ? "manual_operator_required" : "blocked",
    generatedAt: now(),
    reason: ready ? "post_activation_health_not_healthy" : "rollback_evidence_not_bound",
    owner: NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_OWNER,
    activationReceipt: {
      receiptHash: receipt?.receiptHash ?? null,
      requestId: receipt?.requestId ?? null,
      activationTaskId: receipt?.activationTaskId ?? null,
      candidateHash: receipt?.candidateHash ?? null,
      targetPath: receipt?.targetPath ?? null,
      generationSwitched: receipt?.generationSwitched === true,
      rollbackExecuted: receipt?.rollbackExecuted === true,
    },
    healthTransition: {
      preActivationHealthHash: preActivationHealthHash ?? null,
      postActivationHealthHash: postActivationHealth?.hostHealthHash ?? null,
      postActivationStatus: postHealthStatus,
    },
    recommendation: ready
      ? "operator_review_current_generation_then_manual_rollback"
      : "retain_activation_failure_without_rollback_action",
    governance: {
      activationReceiptBound,
      preActivationHealthBound: preHealthBound,
      postActivationHealthBound: postHealthBound,
      createsTask: false,
      createsApproval: false,
      callsHostd: false,
      executesRollback: false,
      automaticRollback: false,
      requiresExplicitOperatorAction: true,
      candidateTextExposed: false,
    },
  };
}
