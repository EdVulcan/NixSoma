import test from "node:test";
import assert from "node:assert/strict";

import { createPolicyEvaluator } from "../src/policy-evaluator.mjs";

function createHarness(overrides = {}) {
  const persisted = [];
  const approvalRequests = [];
  const state = {
    policyAuditLog: [],
    MAX_POLICY_AUDIT_ENTRIES: 3,
    persistState: () => {
      persisted.push(Date.now());
    },
    autonomyMode: "guardian",
    DENIED_INTENTS: new Set(["system.destroy"]),
    CROSS_BOUNDARY_INTENTS: new Set(["cloud.provider.send"]),
    approvals: new Map(),
    ...overrides,
  };
  const evaluator = createPolicyEvaluator({
    state,
    createApprovalRequestForTask: (task, decision) => {
      approvalRequests.push({ task, decision });
      task.approval = {
        requestId: `approval-${approvalRequests.length}`,
        status: "pending",
        required: true,
      };
      return task.approval;
    },
  });

  return { evaluator, state, persisted, approvalRequests };
}

test("requires approval for cross-boundary provider egress by default", () => {
  const { evaluator } = createHarness();

  const decision = evaluator.evaluatePolicyIntent({
    type: "cloud_task",
    policy: { intent: "cloud.provider.send" },
  });

  assert.equal(decision.domain, "cross_boundary");
  assert.equal(decision.risk, "high");
  assert.equal(decision.decision, "require_approval");
  assert.equal(decision.reason, "cross_boundary_requires_user_approval");
  assert.equal(evaluator.isPolicyExecutionAllowed(decision), false);
});

test("allows body-internal work through audit-only governance", () => {
  const { evaluator } = createHarness();

  const decision = evaluator.evaluatePolicyIntent({
    type: "system_task",
    policy: { intent: "system.inspect" },
  });

  assert.equal(decision.domain, "body_internal");
  assert.equal(decision.risk, "medium");
  assert.equal(decision.decision, "audit_only");
  assert.equal(decision.reason, "body_internal_audit");
  assert.equal(decision.auditRequired, true);
  assert.equal(evaluator.isPolicyExecutionAllowed(decision), true);
});

test("denies absolute boundary intents", () => {
  const { evaluator } = createHarness();

  const decision = evaluator.evaluatePolicyIntent({
    type: "system_task",
    policy: { intent: "system.destroy" },
  });

  assert.equal(decision.domain, "body_internal");
  assert.equal(decision.risk, "critical");
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "absolute_boundary");
});

test("caps audit records and reports retained policy counts", () => {
  const { evaluator, state, persisted } = createHarness();

  for (const intent of ["task.one", "task.two", "system.inspect", "cloud.provider.send"]) {
    evaluator.recordPolicyDecision(evaluator.evaluatePolicyIntent({ policy: { intent } }));
  }

  assert.equal(state.policyAuditLog.length, 3);
  assert.equal(persisted.length, 4);

  const policyState = evaluator.buildPolicyState();
  assert.equal(policyState.counts.total, 3);
  assert.equal(policyState.counts.audit_only, 1);
  assert.equal(policyState.counts.require_approval, 1);
  assert.equal(policyState.counts.user_task, 1);
  assert.equal(policyState.counts.body_internal, 1);
  assert.equal(policyState.counts.cross_boundary, 1);
});

test("creates an approval request for cross-boundary task policy", () => {
  const { evaluator, state, approvalRequests } = createHarness();
  const task = {
    id: "task-1",
    type: "cloud_task",
    goal: "Send governed provider request",
    policy: {
      intent: "cloud.provider.send",
    },
  };

  const policy = evaluator.ensureTaskPolicy(task);

  assert.equal(policy.decision.decision, "require_approval");
  assert.equal(task.approval.required, true);
  assert.equal(task.approval.status, "pending");
  assert.equal(approvalRequests.length, 1);
  assert.equal(state.policyAuditLog.length, 1);
});
