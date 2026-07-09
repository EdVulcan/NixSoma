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

test("workspace native ACPX/Codex wrapper write task bridge preserves approval-gated input", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createNativeAcpxCodexBridgeWrapperWriteTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0",
        mode: "approval-gated-acpx-codex-bridge-wrapper-write",
        generatedAt: "2026-07-10T00:00:00.000Z",
        sourceRegistry: "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0",
        capability: { id: "act.openclaw.acpx_codex_bridge.wrapper_write_bridge" },
        workspace: { id: "workspace" },
        target: { relativePath: ".openclaw/acpx/codex-bridge/codex-acp-test.sh", contentPreviewExposed: false },
        wrapperWriteProposal: { contentPreviewExposed: false },
        workspaceTextWrite: { registry: "openclaw-native-workspace-text-write-task-v0", contentExposed: false },
        task: { id: "task-acpx-write", status: "pending" },
        approval: { id: "approval-acpx-write", status: "pending" },
        governance: { createsTask: true, createsApproval: true, contentPreviewExposed: false },
      };
    },
  }, "POST", "/plugins/native-adapter/acpx-codex-bridge-wrapper-write-tasks", {
    workspacePath: "/tmp/openclaw",
    sessionKey: "agent:codex:test",
    command: "npx.cmd",
    wrapperName: "codex-acp-test",
    overwrite: false,
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    sessionKey: "agent:codex:test",
    command: "npx.cmd",
    wrapperName: "codex-acp-test",
    overwrite: false,
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-acpx-write", status: "pending" });
  assert.deepEqual(response.body.approval, { id: "approval-acpx-write", status: "pending" });
  assert.equal(response.body.workspaceTextWrite.contentExposed, false);
  assert.equal(response.body.governance.contentPreviewExposed, false);
});

test("workspace native engineering edit proposal task bridge preserves approval-gated input", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createNativeEngineeringEditProposalTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-engineering-edit-proposal-task-v0",
        mode: "approval-gated-edit-proposal-bridge",
        generatedAt: "2026-07-09T00:00:00.000Z",
        sourceRegistry: "openclaw-native-engineering-edit-proposal-v0",
        capability: { id: "act.openclaw.engineering_tool.edit_proposal" },
        workspace: { id: "workspace" },
        target: { relativePath: input.relativePath, contentExposed: false, diffPreviewExposed: true },
        validation: { ok: true },
        proposal: { id: "engineering-edit-proposal" },
        edits: [{ index: 0 }],
        diffPreview: { format: "bounded-line-diff-v0" },
        engineeringEditProposal: { contentExposed: false, diffPreviewExposed: true },
        workspacePatchApply: { registry: "openclaw-native-workspace-patch-apply-task-v0", contentExposed: false },
        task: { id: "task-edit", status: "pending" },
        approval: { id: "approval-edit", status: "pending" },
        governance: { createsTask: true, createsApproval: true },
      };
    },
  }, "POST", "/plugins/native-adapter/engineering-edit-proposal-tasks", {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/app.ts",
    search: "old",
    replacement: "new",
    contextLines: 2,
    maxOutputChars: 512,
    maxFileSizeBytes: 1024,
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/app.ts",
    oldString: "old",
    newString: "new",
    contextLines: 2,
    maxOutputChars: 512,
    maxFileSizeBytes: 1024,
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-edit", status: "pending" });
  assert.deepEqual(response.body.approval, { id: "approval-edit", status: "pending" });
  assert.equal(response.body.engineeringEditProposal.contentExposed, false);
  assert.equal(response.body.workspacePatchApply.registry, "openclaw-native-workspace-patch-apply-task-v0");
});

test("workspace native engineering LSP lifecycle task bridge preserves approval-gated input", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createNativeEngineeringLspLifecycleTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        mode: "approval-gated-lsp-lifecycle-binary-gate",
        generatedAt: "2026-07-09T00:00:00.000Z",
        sourceRegistry: "openclaw-native-engineering-lsp-lifecycle-draft-v0",
        lifecycleDraft: { id: "lsp-draft" },
        engineeringLspLifecycle: {
          language: input.language,
          lifecycleAction: input.lifecycleAction,
          server: { serverBinary: "typescript-language-server", processStarted: false },
        },
        task: { id: "task-lsp", status: "queued" },
        approval: { id: "approval-lsp", status: "pending" },
        governance: { createsTask: true, createsApproval: true },
      };
    },
  }, "POST", "/plugins/native-adapter/engineering-lsp/lifecycle-tasks", {
    workspacePath: "/tmp/openclaw",
    language: "python",
    lifecycleAction: "restart",
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "python",
    lifecycleAction: "restart",
    relativePath: "src/app.ts",
    symbolAction: "definition",
    line: 1,
    character: 0,
    maxFileSizeBytes: 128 * 1024,
    maxPreviewChars: 8_000,
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-lsp", status: "queued" });
  assert.deepEqual(response.body.approval, { id: "approval-lsp", status: "pending" });
  assert.equal(response.body.engineeringLspLifecycle.server.processStarted, false);
});

test("workspace native engineering LSP source-transfer task bridge preserves proposal inputs", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createNativeEngineeringLspLifecycleTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        mode: "approval-gated-lsp-source-transfer-didopen",
        generatedAt: "2026-07-10T00:00:00.000Z",
        sourceRegistry: "openclaw-native-engineering-lsp-source-transfer-proposal-v0",
        lifecycleDraft: null,
        sourceTransferProposal: {
          registry: "openclaw-native-engineering-lsp-source-transfer-proposal-v0",
          file: { relativePath: input.relativePath, textSha256: "a".repeat(64) },
          proposedDidOpen: { sent: false },
        },
        engineeringLspLifecycle: {
          language: input.language,
          lifecycleAction: input.lifecycleAction,
          sourceTransfer: { relativePath: input.relativePath, didOpenSent: false },
          server: { serverBinary: "typescript-language-server", processStarted: false },
        },
        task: { id: "task-lsp-source-transfer", status: "queued" },
        approval: { id: "approval-lsp-source-transfer", status: "pending" },
        governance: { createsTask: true, createsApproval: true, sourceTransferRequiresApproval: true },
      };
    },
  }, "POST", "/plugins/native-adapter/engineering-lsp/lifecycle-tasks", {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    lifecycleAction: "source_transfer",
    relativePath: "src/app.ts",
    symbolAction: "definition",
    line: 1,
    character: 0,
    maxFileSizeBytes: 2048,
    maxPreviewChars: 500,
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    lifecycleAction: "source_transfer",
    relativePath: "src/app.ts",
    symbolAction: "definition",
    line: 1,
    character: 0,
    maxFileSizeBytes: 2048,
    maxPreviewChars: 500,
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-lsp-source-transfer", status: "queued" });
  assert.deepEqual(response.body.approval, { id: "approval-lsp-source-transfer", status: "pending" });
  assert.equal(response.body.sourceTransferProposal.proposedDidOpen.sent, false);
  assert.equal(response.body.engineeringLspLifecycle.sourceTransfer.didOpenSent, false);
});

test("workspace native engineering LSP symbol request task bridge preserves request inputs", async () => {
  let observedInput = null;
  const response = await invokeWorkspaceNativeOpsRoute({
    createNativeEngineeringLspLifecycleTask: async (input) => {
      observedInput = input;
      return {
        registry: "openclaw-native-engineering-lsp-lifecycle-task-v0",
        mode: "approval-gated-lsp-symbol-request",
        generatedAt: "2026-07-10T00:00:00.000Z",
        sourceRegistry: "openclaw-native-engineering-lsp-symbol-request-proposal-v0",
        lifecycleDraft: null,
        sourceTransferProposal: null,
        symbolRequestProposal: {
          registry: "openclaw-native-engineering-lsp-symbol-request-proposal-v0",
          proposedJsonRpc: { method: "textDocument/definition", sent: false },
        },
        engineeringLspLifecycle: {
          language: input.language,
          lifecycleAction: input.lifecycleAction,
          symbolRequest: { action: input.symbolAction, sent: false },
          server: { serverBinary: "typescript-language-server", processStarted: false },
        },
        task: { id: "task-lsp-symbol", status: "queued" },
        approval: { id: "approval-lsp-symbol", status: "pending" },
        governance: { createsTask: true, createsApproval: true, symbolRequestRequiresApproval: true },
      };
    },
  }, "POST", "/plugins/native-adapter/engineering-lsp/lifecycle-tasks", {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    lifecycleAction: "symbol_request",
    symbolAction: "definition",
    relativePath: "src/app.ts",
    line: 2,
    character: 14,
    confirm: true,
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    lifecycleAction: "symbol_request",
    relativePath: "src/app.ts",
    symbolAction: "definition",
    line: 2,
    character: 14,
    maxFileSizeBytes: 128 * 1024,
    maxPreviewChars: 8_000,
    confirm: true,
  });
  assert.deepEqual(response.body.task, { id: "task-lsp-symbol", status: "queued" });
  assert.equal(response.body.symbolRequestProposal.proposedJsonRpc.sent, false);
  assert.equal(response.body.engineeringLspLifecycle.symbolRequest.sent, false);
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
