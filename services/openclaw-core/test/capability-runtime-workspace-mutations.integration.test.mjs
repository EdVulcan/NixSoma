import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRuntime } from "../src/capability-runtime.mjs";

function createMutationResult(capabilityId, taskId) {
  return {
    registry: "openclaw-native-workspace-mutation-task-v0",
    mode: "approval-gated",
    capability: { id: capabilityId, approvalRequired: true },
    target: {
      relativePath: "src/app.ts",
      contentBytes: 18,
      editCount: capabilityId.endsWith("patch_apply") ? 1 : 0,
      contentExposed: false,
      diffPreviewExposed: capabilityId.endsWith("patch_apply"),
    },
    diffPreview: capabilityId.endsWith("patch_apply") ? ["-secret", "+replacement"] : null,
    task: {
      id: taskId,
      type: "system_task",
      goal: "Apply workspace mutation",
      status: "queued",
      plan: { actions: [{ params: { content: "secret content", replacement: "secret replacement" } }] },
    },
    approval: { id: `${taskId}-approval`, status: "pending", taskId },
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      canCallProvider: false,
      canUseNetwork: false,
    },
  };
}

function createHarness() {
  const events = [];
  const calls = [];
  const state = {
    capabilityInvocationLog: [],
    MAX_CAPABILITY_INVOCATION_ENTRIES: 10,
    CAPABILITY_HEALTH_TIMEOUT_MS: 50,
    CROSS_BOUNDARY_INTENTS: [],
    persistState: () => {},
  };
  const runtime = createCapabilityRuntime({
    host: "127.0.0.1",
    port: 4100,
    client: {
      eventHubUrl: "http://127.0.0.1:4101",
      sessionManagerUrl: "http://127.0.0.1:4102",
      browserRuntimeUrl: "http://127.0.0.1:4103",
      screenSenseUrl: "http://127.0.0.1:4104",
      screenActUrl: "http://127.0.0.1:4105",
      systemSenseUrl: "http://127.0.0.1:4106",
      systemHealUrl: "http://127.0.0.1:4107",
      fetchJson: async () => ({ ok: true }),
      postJson: async () => ({ ok: true }),
    },
    state,
    pluginReview: {},
    workspaceOps: {
      createNativeOpenClawWorkspaceTextWriteTask: async (input) => {
        calls.push({ capabilityId: "act.openclaw.workspace_text_write", input });
        return createMutationResult("act.openclaw.workspace_text_write", "task-write-runtime");
      },
      createNativeOpenClawWorkspacePatchApplyTask: async (input) => {
        calls.push({ capabilityId: "act.openclaw.workspace_patch_apply", input });
        return createMutationResult("act.openclaw.workspace_patch_apply", "task-patch-runtime");
      },
    },
    serialiseTask: (task) => ({ id: task.id, status: task.status, plan: { redacted: true } }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status, taskId: approval.taskId }),
    taskManager: {},
    policyEvaluator: {
      evaluatePolicyIntent: (input) => ({
        id: "policy-runtime",
        decision: input.approved === true ? "audit_only" : "require_approval",
        domain: input.domain,
        risk: input.risk,
        reason: input.approved === true ? "approved_capability" : "approval_required",
        approved: input.approved === true,
        autonomyMode: "guardian",
        autonomous: false,
      }),
      recordPolicyDecision: (decision) => decision,
      isPolicyExecutionAllowed: (decision) => decision.decision === "audit_only",
    },
    publishEvent: async (name) => {
      events.push(name);
    },
  });
  return { runtime, state, calls, events };
}

test("common capability invoke preserves the workspace mutation double gate and compact audit", async () => {
  const { runtime, state, calls, events } = createHarness();

  const unapproved = await runtime.invokeCapability({
    capabilityId: "act.openclaw.workspace_text_write",
    params: { workspacePath: "/tmp/openclaw", relativePath: "src/app.ts", content: "secret content", confirm: true },
  });
  assert.equal(unapproved.response.blocked, true);
  assert.equal(unapproved.response.reason, "policy_requires_approval");
  assert.equal(calls.length, 0);

  const unconfirmed = await runtime.invokeCapability({
    capabilityId: "act.openclaw.workspace_text_write",
    approved: true,
    params: { workspacePath: "/tmp/openclaw", relativePath: "src/app.ts", content: "secret content", confirm: false },
  });
  assert.equal(unconfirmed.response.invoked, true);
  assert.equal(unconfirmed.response.result.blocked, true);
  assert.equal(unconfirmed.response.result.reason, "operator_confirmation_required");
  assert.equal(calls.length, 0);

  const approved = await runtime.invokeCapability({
    capabilityId: "act.openclaw.workspace_text_write",
    approved: true,
    params: {
      workspacePath: "/tmp/openclaw",
      relativePath: "src/app.ts",
      content: "secret content",
      overwrite: false,
      confirm: true,
    },
  });
  assert.equal(approved.response.invoked, true);
  assert.equal(approved.response.summary.kind, "workspace.text_write_task");
  assert.equal(approved.response.summary.createsTask, true);
  assert.equal(approved.response.summary.createsApproval, true);
  assert.equal(approved.response.summary.noMutationBeforeApproval, true);
  assert.equal(approved.response.summary.noContentInInvocation, true);
  assert.equal(approved.response.summary.noReplacementInInvocation, true);
  assert.equal(approved.response.summary.noFullDiffInInvocation, true);
  assert.deepEqual(calls[0], {
    capabilityId: "act.openclaw.workspace_text_write",
    input: {
      workspacePath: "/tmp/openclaw",
      relativePath: "src/app.ts",
      content: "secret content",
      overwrite: false,
      engineeringPlanTodoSuggestionLink: null,
      confirm: true,
    },
  });
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("secret content"), false);
  assert.equal(JSON.stringify(state.capabilityInvocationLog).includes("secret replacement"), false);
  assert.equal(approved.response.result.task.plan.redacted, true);

  const patch = await runtime.invokeCapability({
    capabilityId: "act.openclaw.workspace_patch_apply",
    approved: true,
    params: {
      workspacePath: "/tmp/openclaw",
      relativePath: "src/app.ts",
      search: "old",
      replacement: "secret replacement",
      occurrence: 1,
      contextLines: 1,
      confirm: true,
    },
  });
  assert.equal(patch.response.invoked, true);
  assert.equal(patch.response.summary.kind, "workspace.patch_apply_task");
  assert.equal(patch.response.summary.diffPreviewExposed, true);
  assert.equal(patch.response.summary.noFullDiffInInvocation, true);
  assert.equal(calls.length, 2);
  assert(events.filter((name) => name === "capability.blocked").length === 1, true);
  assert.equal(events.filter((name) => name === "capability.invoked").length, 3);
});
