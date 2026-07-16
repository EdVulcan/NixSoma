import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceMutationCapabilityHandlers } from "../src/capability-runtime-workspace-mutations.mjs";

const textWriteCapability = { id: "act.openclaw.workspace_text_write" };
const patchApplyCapability = { id: "act.openclaw.workspace_patch_apply" };

function taskResult(capabilityId) {
  return {
    registry: "openclaw-native-workspace-mutation-task-v0",
    mode: "approval-gated",
    capability: { id: capabilityId, approvalRequired: true },
    target: {
      relativePath: "src/app.ts",
      contentBytes: 24,
      originalBytes: 12,
      nextBytes: 24,
      editCount: 1,
      contentExposed: false,
      diffPreviewExposed: true,
    },
    diffPreview: ["-old", "+replacement must remain transient"],
    task: {
      id: "task-mutation-1",
      type: "system_task",
      goal: "Apply approved workspace mutation",
      status: "queued",
      plan: { actions: [{ params: { content: "secret content" } }] },
    },
    approval: { id: "approval-mutation-1", status: "pending", taskId: "task-mutation-1" },
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      canMutate: false,
      canCallProvider: false,
      canUseNetwork: false,
    },
  };
}

test("workspace mutation handler keeps approval and confirmation as separate gates", async () => {
  const calls = [];
  const handlers = createWorkspaceMutationCapabilityHandlers({
    workspaceOps: {
      createNativeOpenClawWorkspaceTextWriteTask: async (input) => {
        calls.push({ kind: "write", input });
        return taskResult(textWriteCapability.id);
      },
    },
    serialiseTask: (task) => ({ id: task.id, status: task.status, plan: { redacted: true } }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status, taskId: approval.taskId }),
  });

  const unconfirmed = await handlers.callBackend(textWriteCapability, { params: { confirm: false } });
  assert.equal(unconfirmed.handled, true);
  assert.equal(unconfirmed.result.blocked, true);
  assert.equal(unconfirmed.result.reason, "operator_confirmation_required");
  assert.equal(calls.length, 0);

  const invoked = await handlers.callBackend(textWriteCapability, {
    params: {
      workspacePath: "/tmp/openclaw",
      relativePath: "src/app.ts",
      content: "secret content",
      overwrite: false,
      confirm: true,
    },
  });
  assert.equal(invoked.handled, true);
  assert.deepEqual(calls, [{
    kind: "write",
    input: {
      workspacePath: "/tmp/openclaw",
      relativePath: "src/app.ts",
      content: "secret content",
      overwrite: false,
      engineeringPlanTodoSuggestionLink: null,
      confirm: true,
    },
  }]);
  assert.deepEqual(invoked.result.task, {
    id: "task-mutation-1",
    status: "queued",
    plan: { redacted: true },
  });
  assert.deepEqual(invoked.result.approval, {
    id: "approval-mutation-1",
    status: "pending",
    taskId: "task-mutation-1",
  });
  assert.equal(JSON.stringify(invoked.result.task).includes("secret content"), false);

  assert.deepEqual(handlers.summariseResult(textWriteCapability, invoked.result), {
    kind: "workspace.text_write_task",
    ok: true,
    blocked: false,
    reason: null,
    taskId: "task-mutation-1",
    approvalId: "approval-mutation-1",
    relativePath: "src/app.ts",
    contentBytes: 24,
    editCount: 1,
    diffPreviewExposed: true,
    fullContentExposed: false,
    createsTask: true,
    createsApproval: true,
    requiresApproval: true,
    canExecuteWithoutApproval: false,
    executed: false,
    noMutationBeforeApproval: true,
    noContentInInvocation: true,
    noReplacementInInvocation: true,
    noFullDiffInInvocation: true,
    noProviderEgress: true,
  });
});

test("workspace patch capability forwards bounded patch inputs and remains unrelated-safe", async () => {
  let observedInput = null;
  const handlers = createWorkspaceMutationCapabilityHandlers({
    workspaceOps: {
      createNativeOpenClawWorkspacePatchApplyTask: async (input) => {
        observedInput = input;
        return taskResult(patchApplyCapability.id);
      },
    },
  });

  const backend = await handlers.callBackend(patchApplyCapability, {
    params: {
      workspacePath: "/tmp/openclaw",
      relativePath: "src/app.ts",
      search: "old",
      replacement: "new",
      occurrence: 2,
      edits: [{ search: "old", replacement: "new" }],
      contextLines: 2,
      proposal: { id: "proposal-1" },
      deriveProposalFromSource: true,
      proposalQuery: "edit",
      selectTargetFromSource: true,
      targetSelectionQuery: "tool",
      targetSelectionScope: "tools",
      confirm: true,
    },
  });

  assert.equal(backend.handled, true);
  assert.equal(observedInput.confirm, true);
  assert.equal(observedInput.deriveProposalFromSource, true);
  assert.equal(observedInput.selectTargetFromSource, true);
  assert.deepEqual(observedInput.edits, [{ search: "old", replacement: "new" }]);
  assert.equal(handlers.validateRequest(patchApplyCapability, { params: { confirm: "true" } }), "workspace.patch_apply_task confirm must be a boolean.");
  assert.deepEqual(await handlers.callBackend({ id: "sense.system.vitals" }, { params: {} }), {
    handled: false,
    result: null,
  });
});
