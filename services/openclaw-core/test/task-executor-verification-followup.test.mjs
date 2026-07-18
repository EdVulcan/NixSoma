import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkspaceMutationVerificationTrigger,
  createWorkspaceMutationVerificationFollowupCoordinator,
} from "../src/task-executor-verification-followup.mjs";

function buildMutationTask(status = "completed") {
  return {
    id: "mutation-task-1",
    type: "system_task",
    status,
    workViewStrategy: "openclaw-native-workspace-patch-apply",
    plan: {
      steps: [{ capabilityId: "act.filesystem.write_text", phase: "acting_on_target" }],
    },
    workspaceMutation: {
      registry: "openclaw-native-workspace-mutation-v0",
      capabilityId: "act.openclaw.workspace_patch_apply",
      workspace: {
        id: "openclaw",
        name: "OpenClaw",
        path: "/repo",
      },
      target: {
        relativePath: "src/example.mjs",
        originalSha256: "a".repeat(64),
        nextSha256: "b".repeat(64),
        editCount: 1,
      },
      contentExposed: false,
    },
    outcome: {
      kind: "completed",
      details: { executor: "capability-invoke-v1" },
    },
  };
}

test("verification followup binds a sovereign validation task to the completed mutation", async () => {
  const calls = [];
  const coordinator = createWorkspaceMutationVerificationFollowupCoordinator({
    autonomyMode: "sovereign_body",
    workspaceOps: {
      findWorkspaceCommandProposal: ({ workspacePath, scriptName }) => ({
        proposal: workspacePath === "/repo" && scriptName === "typecheck"
          ? { id: "openclaw:typecheck", scriptName: "typecheck", command: "npm" }
          : null,
      }),
      createOpenClawSourceCommandTask: async (input) => {
        calls.push(input);
        return {
          task: { id: "verification-task-1", status: "queued" },
          approval: null,
          governance: { autoAuthorized: true },
        };
      },
    },
    executeCapabilityPlanTask: async (task, options) => ({
      task: { ...task, status: "completed" },
      commandTranscript: [{ exitCode: 0, timedOut: false }],
      verification: { ok: true },
      options,
    }),
  });
  const task = buildMutationTask();

  const trigger = buildWorkspaceMutationVerificationTrigger(task);
  const result = await coordinator.createAndRun(task);

  assert.equal(trigger?.sourceTaskId, task.id);
  assert.match(trigger?.mutationHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].verificationTrigger.sourceTaskId, task.id);
  assert.equal(calls[0].verificationTrigger.mutationHash, trigger.mutationHash);
  assert.equal(calls[0].proposalId, "openclaw:typecheck");
  assert.equal(result.triggered, true);
  assert.equal(result.executed, true);
  assert.equal(result.ok, true);
  assert.equal(result.verificationTask.id, "verification-task-1");
});

test("guardian mode does not create an automatic verification task", async () => {
  let createCalls = 0;
  const coordinator = createWorkspaceMutationVerificationFollowupCoordinator({
    autonomyMode: "guardian",
    workspaceOps: {
      createOpenClawSourceCommandTask: async () => {
        createCalls += 1;
        return null;
      },
    },
  });

  assert.equal(await coordinator.createAndRun(buildMutationTask()), null);
  assert.equal(createCalls, 0);
});

test("verification followup ignores unfinished or unbound mutation tasks", async () => {
  const coordinator = createWorkspaceMutationVerificationFollowupCoordinator({
    autonomyMode: "sovereign_body",
    workspaceOps: {
      findWorkspaceCommandProposal: () => ({ proposal: { id: "unexpected" } }),
    },
  });

  assert.equal(await coordinator.createAndRun(buildMutationTask("queued")), null);
  const unbound = buildMutationTask();
  delete unbound.workspaceMutation;
  assert.equal(await coordinator.createAndRun(unbound), null);
});

test("verification proposal lookup failure does not fail the completed mutation", async () => {
  const coordinator = createWorkspaceMutationVerificationFollowupCoordinator({
    autonomyMode: "sovereign_body",
    workspaceOps: {
      findWorkspaceCommandProposal: () => {
        throw new Error("fixture lookup failure");
      },
      createOpenClawSourceCommandTask: async () => null,
    },
  });

  const result = await coordinator.createAndRun(buildMutationTask());

  assert.equal(result.triggered, false);
  assert.equal(result.reason, "verification_followup_proposal_lookup_failed");
});
