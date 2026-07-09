import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleWorkspaceNativeOpsRoute } from "../src/workspace-native-ops-routes.mjs";

async function invokeWorkspaceNativeOpsRoute(workspaceOps, method, path, body = null, overrides = {}) {
  const chunks = body === null ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.headers = {};

  let statusCode = null;
  let headers = null;
  let payload = "";
  const res = {
    writeHead(code, responseHeaders) {
      statusCode = code;
      headers = responseHeaders;
    },
    end(chunk = "") {
      payload = String(chunk);
    },
  };

  const handled = await handleWorkspaceNativeOpsRoute({
    req,
    res,
    requestUrl: new URL(path, "http://127.0.0.1:4100"),
    workspaceOps,
    serialisePlanForPublic: (plan) => ({ publicPlanId: plan.id }),
    serialiseTask: (task) => ({ id: task.id, status: task.status }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status }),
    buildTaskSummary: () => ({ total: 1 }),
    ...overrides,
  });

  return {
    handled,
    statusCode,
    headers,
    body: payload ? JSON.parse(payload) : null,
  };
}

test("workspace native text write draft preserves fixed content and public plan serialization", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    buildNativeOpenClawWorkspaceTextWriteDraft: (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-workspace-text-write-draft-v0",
        mode: "approval-gated-draft",
        draft: {
          plan: { id: "private-plan" },
          target: { relativePath: input.relativePath },
        },
      };
    },
  }, "GET", "/plugins/native-adapter/workspace-text-write/draft?relativePath=scratch/out.txt&overwrite=false");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/json/);
  assert.deepEqual(observedInput, {
    workspacePath: null,
    relativePath: "scratch/out.txt",
    content: "hello from openclaw native workspace text write\n",
    overwrite: false,
  });
  assert.deepEqual(response.body.draft.plan, { publicPlanId: "private-plan" });
});

test("workspace native patch draft parses JSON query params and preserves parse errors as 400", async () => {
  let observedInput = null;
  const edits = encodeURIComponent(JSON.stringify([{ search: "old", replacement: "new" }]));
  const proposal = encodeURIComponent(JSON.stringify({ id: "proposal-1" }));
  const response = await invokeWorkspaceNativeOpsRoute({
    buildNativeOpenClawWorkspacePatchApplyDraft: (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-workspace-patch-apply-draft-v0",
        draft: { plan: { id: "patch-plan" } },
      };
    },
  }, `GET`, `/plugins/native-adapter/workspace-patch-apply/draft?edits=${edits}&proposal=${proposal}&proposalQuery=rename&selectTargetFromSource=true`);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput.edits, [{ search: "old", replacement: "new" }]);
  assert.deepEqual(observedInput.proposal, { id: "proposal-1" });
  assert.equal(observedInput.targetSelectionQuery, "rename");
  assert.equal(observedInput.selectTargetFromSource, true);

  const failed = await invokeWorkspaceNativeOpsRoute({
    buildNativeOpenClawWorkspacePatchApplyDraft: () => {
      throw new Error("should not be called");
    },
  }, "GET", "/plugins/native-adapter/workspace-patch-apply/draft?edits={bad");

  assert.equal(failed.handled, true);
  assert.equal(failed.statusCode, 400);
  assert.equal(failed.body.ok, false);
});

test("workspace native engineering write proposal task bridge preserves approval-gated input", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createNativeEngineeringWriteProposalTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-engineering-write-proposal-task-v0",
        mode: "approval-gated-write-proposal-bridge",
        generatedAt: "2026-07-09T00:00:00.000Z",
        sourceRegistry: "openclaw-native-engineering-write-proposal-v0",
        capability: { id: "act.openclaw.engineering_tool.write_proposal" },
        workspace: { id: "workspace" },
        target: { relativePath: input.relativePath, contentExposed: false },
        engineeringWriteProposal: { contentExposed: false },
        workspaceTextWrite: { contentExposed: false },
        task: { id: "task-write", status: "pending" },
        approval: { id: "approval-write", status: "pending" },
        governance: { createsTask: true, createsApproval: true },
      };
    },
  }, "POST", "/plugins/native-adapter/engineering-write-proposal-tasks", {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/new.txt",
    content: "hello",
    overwrite: true,
    contextLines: 2,
    maxContentBytes: 512,
    maxExistingFileBytes: 1024,
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/new.txt",
    content: "hello",
    contentBase64: null,
    overwrite: true,
    contextLines: 2,
    maxContentBytes: 512,
    maxExistingFileBytes: 1024,
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-write", status: "pending" });
  assert.deepEqual(response.body.approval, { id: "approval-write", status: "pending" });
  assert.equal(response.body.engineeringWriteProposal.contentExposed, false);
});

test("workspace native source command task serializes task and approval contracts", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createOpenClawSourceCommandTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-source-command-task-v0",
        mode: "approval-gated",
        generatedAt: "2026-07-08T00:00:00.000Z",
        sourceRegistry: "openclaw-source-command-plan-draft-v0",
        sourceMode: "source-command",
        sourceCommandProposal: { id: "proposal-a" },
        sourceCommandSignals: { total: 2 },
        sourceCommandPlan: { id: "plan-a" },
        sourceCommandTask: { id: "source-task-a" },
        workspaceCommandTask: { id: "workspace-task-a" },
        task: { id: "task-a", status: "pending" },
        approval: { id: "approval-a", status: "pending" },
        governance: { decision: "require_approval" },
      };
    },
  }, "POST", "/plugins/native-adapter/source-command-proposals/tasks", {
    proposalId: "proposal-a",
    workspaceId: "openclaw",
    scriptName: "typecheck",
    workspacePath: "/tmp/openclaw",
    query: "command",
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    proposalId: "proposal-a",
    workspaceId: "openclaw",
    scriptName: "typecheck",
    workspacePath: "/tmp/openclaw",
    query: "command",
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-a", status: "pending" });
  assert.deepEqual(response.body.approval, { id: "approval-a", status: "pending" });
  assert.deepEqual(response.body.summary, { total: 1 });
});

test("workspace native command plan preserves 404 misses and route miss behavior", async () => {
  const failed = await invokeWorkspaceNativeOpsRoute({
    buildWorkspaceCommandPlanDraft: () => {
      throw new Error("proposal missing");
    },
  }, "GET", "/workspaces/command-proposals/plan");

  assert.equal(failed.handled, true);
  assert.equal(failed.statusCode, 404);
  assert.deepEqual(failed.body, { ok: false, error: "proposal missing" });

  const missed = await invokeWorkspaceNativeOpsRoute({}, "GET", "/workspaces");

  assert.equal(missed.handled, false);
  assert.equal(missed.statusCode, null);
  assert.equal(missed.body, null);
});
