import test from "node:test";
import assert from "node:assert/strict";

import {
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import {
  buildNativeDeclarativeEvolutionManualRollbackEvidence,
  NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_EVIDENCE_REGISTRY,
  NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_OWNER,
} from "../src/native-declarative-evolution-rollback-evidence.mjs";

const preActivationHealthHash = "a".repeat(64);
const postActivationHealthHash = "b".repeat(64);
const receiptHash = "c".repeat(64);

function receipt(overrides = {}) {
  return {
    registry: HOSTD_ACTIVATION_RECEIPT_REGISTRY,
    receiptHash,
    requestId: "request-1",
    activationTaskId: "task-activation",
    candidateHash: "d".repeat(64),
    targetPath: HOSTD_ACTIVATION_TARGET_PATH,
    status: "passed",
    activationExecuted: true,
    generationSwitched: true,
    rollbackExecuted: false,
    ...overrides,
  };
}

test("manual rollback evidence binds a successful activation to degraded post-health", () => {
  const result = buildNativeDeclarativeEvolutionManualRollbackEvidence({
    receipt: receipt(),
    preActivationHealthHash,
    postActivationHealth: {
      status: "degraded",
      hostHealthHash: postActivationHealthHash,
    },
    now: () => "2026-07-18T03:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
  assert.equal(result.registry, NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_EVIDENCE_REGISTRY);
  assert.equal(result.status, "manual_operator_required");
  assert.equal(result.owner, NATIVE_DECLARATIVE_EVOLUTION_ROLLBACK_OWNER);
  assert.equal(result.generatedAt, "2026-07-18T03:00:00.000Z");
  assert.equal(result.activationReceipt.receiptHash, receiptHash);
  assert.equal(result.healthTransition.preActivationHealthHash, preActivationHealthHash);
  assert.equal(result.healthTransition.postActivationHealthHash, postActivationHealthHash);
  assert.equal(result.recommendation, "operator_review_current_generation_then_manual_rollback");
  assert.equal(result.governance.automaticRollback, false);
  assert.equal(result.governance.executesRollback, false);
  assert.equal(result.governance.callsHostd, false);
  assert.equal(result.governance.createsTask, false);
  assert.equal(result.governance.createsApproval, false);
  assert.equal(result.governance.requiresExplicitOperatorAction, true);
});

test("rollback evidence fails closed unless activation and both health hashes are bound", () => {
  const healthy = buildNativeDeclarativeEvolutionManualRollbackEvidence({
    receipt: receipt(),
    preActivationHealthHash,
    postActivationHealth: { status: "healthy", hostHealthHash: postActivationHealthHash },
  });
  const invalidReceipt = buildNativeDeclarativeEvolutionManualRollbackEvidence({
    receipt: receipt({ registry: "untrusted-receipt" }),
    preActivationHealthHash,
    postActivationHealth: { status: "degraded", hostHealthHash: postActivationHealthHash },
  });
  const missingPostHash = buildNativeDeclarativeEvolutionManualRollbackEvidence({
    receipt: receipt(),
    preActivationHealthHash,
    postActivationHealth: { status: "unavailable" },
  });

  for (const result of [healthy, invalidReceipt, missingPostHash]) {
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.status, "blocked");
    assert.equal(result.governance.automaticRollback, false);
    assert.equal(result.governance.executesRollback, false);
    assert.equal(result.governance.requiresExplicitOperatorAction, true);
  }
});
