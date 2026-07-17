import test from "node:test";
import assert from "node:assert/strict";

import { buildCapabilityApprovalBinding } from "../src/capability-runtime-approval-binding.mjs";
import { createNativeDeclarativeEvolutionTaskHandlers } from "../src/task-executor-native-declarative-evolution-handlers.mjs";

const candidateHash = "d".repeat(64);

function createHarness() {
  const events = [];
  const task = {
    id: "task-generic-binding",
    type: "native_declarative_evolution_staging",
    status: "queued",
    policy: { decision: { decision: "audit_only", reason: "approved_and_audited" } },
    plan: {
      planId: "plan-generic-binding",
      strategy: "native-declarative-evolution-staging-v0",
      steps: [{
        id: "step-stage-and-build-managed-nix-candidate",
        kind: "openclaw.declarative_evolution.stage_and_build",
        phase: "staging_and_read_only_nixos_build",
        status: "pending",
        capabilityId: "act.openclaw.declarative_evolution.staging_task",
        governance: "require_approval",
        requiresApproval: true,
        params: {
          candidateHash,
          stagingDirectory: "/tmp/openclaw-staging",
          writesManagedConfig: false,
          switchesGeneration: false,
          executesRollback: false,
        },
      }],
    },
    nativeDeclarativeEvolution: {
      candidate: { candidateHash, changes: [{ operation: "enable_component", component: "core" }] },
      approvalBinding: { kind: "native_declarative_evolution_candidate", candidateHash },
      governance: { writesManagedConfig: false, switchesGeneration: false, executesRollback: false },
    },
  };
  const approval = {
    id: "approval-generic-binding",
    status: "approved",
    taskId: task.id,
    binding: buildCapabilityApprovalBinding({ task }),
  };
  task.approval = { requestId: approval.id, status: approval.status, binding: approval.binding };
  let executionCalls = 0;
  const handlers = createNativeDeclarativeEvolutionTaskHandlers({
    state: { approvals: new Map([[approval.id, approval]]) },
    taskManager: {
      serialiseTask: (value) => value,
      isActiveTask: () => true,
      setTaskPhase: async (value, phase, options) => {
        value.status = options.status;
        value.executionPhase = phase;
        return value;
      },
      completeTask: (value, details) => {
        value.status = "completed";
        value.outcome = { kind: "completed", details };
        return value;
      },
      failTask: (value, reason, details) => {
        value.status = "failed";
        value.outcome = { kind: "failed", reason, details };
        return value;
      },
    },
    approvalEngine: { serialiseApproval: (value) => value },
    policyEvaluator: {
      ensureTaskPolicy: (value) => value.policy,
      isPolicyExecutionAllowed: () => true,
    },
    planBuilder: {
      buildNativeDeclarativeEvolutionCandidate: async ({ changes }) => ({
        candidateStatus: "validated",
        candidateHash,
        candidateText: "candidate body must remain transient",
        changes,
      }),
      executeNativeDeclarativeEvolutionCandidate: async ({ candidateHash: observedHash }) => {
        executionCalls += 1;
        assert.equal(observedHash, candidateHash);
        return {
          status: "passed",
          candidateHash,
          staging: { status: "staged", path: `/tmp/openclaw-staging/${candidateHash}.nix` },
          validation: { status: "passed", mode: "nix-instantiate" },
          evaluation: { status: "passed", mode: "nix-eval" },
          build: { status: "passed", mode: "nix-build-dry-run" },
          governance: { writesManagedConfig: false, switchesGeneration: false, executesRollback: false },
        };
      },
    },
    publishEvent: async (name, body) => events.push({ name, body }),
  });
  return { handlers, task, executionCalls: () => executionCalls, events };
}

test("staging executor accepts the current generic step-bound approval contract", async () => {
  const harness = createHarness();
  const result = await harness.handlers[0].execute(harness.task);

  assert.equal(result.task.status, "completed");
  assert.equal(harness.executionCalls(), 1);
  assert.equal(result.task.nativeDeclarativeEvolution.execution.candidateHash, candidateHash);
  assert.equal(result.task.nativeDeclarativeEvolution.governance.approvalBoundToCandidateHash, true);
  assert.equal(JSON.stringify(harness.events).includes("candidate body must remain transient"), false);
});
