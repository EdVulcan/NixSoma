import assert from "node:assert/strict";
import test from "node:test";

import { createEngineeringVerificationTaskCapabilityHandlers } from "../src/capability-runtime-engineering-verification-task.mjs";

function createHarness() {
  const calls = [];
  const workspaceOps = {
    async createOpenClawSourceCommandTask(input) {
      calls.push(input);
      return {
        registry: "openclaw-source-command-task-v0",
        sourceCommandProposal: { id: input.proposalId ?? "openclaw:build" },
        sourceCommandTask: { proposalId: input.proposalId ?? "openclaw:build", executed: false },
        task: {
          id: "verification-task-1",
          type: "system_task",
          status: "queued",
          approval: { required: true },
        },
        approval: { id: "approval-1", status: "pending", taskId: "verification-task-1" },
        governance: {
          createsTask: true,
          createsApproval: true,
          canExecuteWithoutApproval: false,
          canExecuteCommand: false,
          canMutate: false,
          canCallProvider: false,
          canUseNetwork: false,
          executed: false,
        },
      };
    },
  };
  const handlers = createEngineeringVerificationTaskCapabilityHandlers({
    workspaceOps,
    serialiseTask: (task) => ({ id: task.id, status: task.status }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status }),
  });
  return { calls, handlers };
}

test("verification task capability keeps confirmation as a task-creation gate", async () => {
  const { calls, handlers } = createHarness();
  const capability = { id: "act.openclaw.engineering_tool.verify" };
  const blocked = await handlers.callBackend(capability, { params: { confirm: false } });

  assert.equal(blocked.handled, true);
  assert.equal(blocked.result.blocked, true);
  assert.equal(blocked.result.reason, "operator_confirmation_required");
  assert.equal(calls.length, 0);
});

test("verification task capability delegates a bounded source command task", async () => {
  const { calls, handlers } = createHarness();
  const capability = { id: "act.openclaw.engineering_tool.verify" };
  const link = { sourceTaskId: "plan-task", actionId: "create_verification_task" };
  const result = await handlers.callBackend(capability, {
    params: {
      proposalId: "openclaw:build",
      workspacePath: "/workspace/openclaw",
      query: "command",
      engineeringPlanTodoSuggestionLink: link,
      confirm: true,
    },
  });

  assert.deepEqual(calls, [{
    proposalId: "openclaw:build",
    workspaceId: undefined,
    scriptName: undefined,
    workspacePath: "/workspace/openclaw",
    query: "command",
    engineeringPlanTodoSuggestionLink: link,
    confirm: true,
  }]);
  assert.equal(result.handled, true);
  assert.deepEqual(result.result.task, { id: "verification-task-1", status: "queued" });
  assert.deepEqual(result.result.approval, { id: "approval-1", status: "pending" });
  const summary = handlers.summariseResult(capability, result.result);
  assert.equal(summary.kind, "engineering.verification_task");
  assert.equal(summary.createsTask, true);
  assert.equal(summary.createsApproval, true);
  assert.equal(summary.noCommandExecution, true);
  assert.equal(summary.noProviderEgress, true);
});

test("verification task capability rejects malformed confirmation input", () => {
  const { handlers } = createHarness();
  assert.match(
    handlers.validateRequest(
      { id: "act.openclaw.engineering_tool.verify" },
      { params: { confirm: "true" } },
    ),
    /confirm must be a boolean/u,
  );
});
