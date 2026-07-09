import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createNativeEngineeringLspEvidenceBuilders,
  NATIVE_ENGINEERING_LSP_EVIDENCE_REGISTRY,
  NATIVE_ENGINEERING_LSP_LIFECYCLE_DRAFT_REGISTRY,
} from "../src/native-engineering-lsp-evidence-builders.mjs";
import {
  createNativeEngineeringLspSourceTransferProposalBuilders,
  NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_REGISTRY,
} from "../src/native-engineering-lsp-source-transfer-proposal-builders.mjs";
import {
  createNativeEngineeringLspSymbolRequestProposalBuilders,
  NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_REGISTRY,
} from "../src/native-engineering-lsp-symbol-request-proposal-builders.mjs";

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-engineering-lsp-evidence-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  mkdirSync(path.join(root, "python"), { recursive: true });
  mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
  mkdirSync(path.join(root, ".cache"), { recursive: true });
  writeFileSync(path.join(root, "tsconfig.json"), "{}\n");
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "openclaw-lsp-fixture" }, null, 2));
  writeFileSync(path.join(root, "pyproject.toml"), "[project]\nname = \"openclaw-lsp-fixture\"\n");
  writeFileSync(path.join(root, "src", "app.ts"), "export const openclawSymbol = 1;\n");
  writeFileSync(path.join(root, "src", "binary.ts"), Buffer.from([0, 1, 2, 3]));
  writeFileSync(path.join(root, "scripts", "tool.mjs"), "export const scriptSymbol = 1;\n");
  writeFileSync(path.join(root, "python", "agent.py"), "def openclaw_symbol():\n    return 1\n");
  writeFileSync(path.join(root, "node_modules", "pkg", "leak.ts"), "export const dependency = 1;\n");
  writeFileSync(path.join(root, ".cache", "leak.py"), "def cached(): pass\n");
  return root;
}

function createHarness(root) {
  return createNativeEngineeringLspEvidenceBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace: () => ({
      registry: { registry: "openclaw-source-workspace-v0" },
      item: {
        id: "fixture",
        name: "LSP Fixture",
        path: root,
      },
    }),
  });
}

function createSourceTransferHarness(root) {
  return createNativeEngineeringLspSourceTransferProposalBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace: () => ({
      registry: { registry: "openclaw-source-workspace-v0" },
      item: {
        id: "fixture",
        name: "LSP Fixture",
        path: root,
      },
    }),
  });
}

function createSymbolRequestHarness(records) {
  return createNativeEngineeringLspSymbolRequestProposalBuilders({
    records,
    selectOpenClawToolCatalogWorkspace: ({ workspacePath }) => ({
      item: {
        id: "fixture",
        name: "LSP Fixture",
        path: workspacePath,
      },
    }),
  });
}

test("native engineering LSP evidence maps server contracts without starting servers", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const evidence = builders.buildNativeEngineeringLspEvidence({
    action: "check",
    language: "typescript",
    limit: 100,
  });

  assert.equal(evidence.ok, true);
  assert.equal(evidence.registry, NATIVE_ENGINEERING_LSP_EVIDENCE_REGISTRY);
  assert.equal(evidence.mode, "lsp-contract-and-availability-evidence-only");
  assert.equal(evidence.capability.id, "sense.openclaw.engineering_tool.lsp_evidence");
  assert.equal(evidence.summary.selectedAction, "check");
  assert.equal(evidence.summary.detectedLanguages.includes("typescript"), true);
  assert.equal(evidence.summary.detectedLanguages.includes("javascript"), true);
  assert.equal(evidence.summary.detectedLanguages.includes("python"), true);
  assert.equal(evidence.serverReadiness.serverBinary, "typescript-language-server");
  assert.equal(evidence.serverReadiness.status, "not_checked");
  assert.equal(evidence.serverReadiness.canStartServer, false);
  assert.equal(evidence.governance.canCheckServerBinary, false);
  assert.equal(evidence.governance.canStartLspServer, false);
  assert.equal(evidence.governance.canSendJsonRpcRequest, false);
  assert.equal(evidence.governance.canExecuteCommand, false);
  assert.equal(evidence.bounds.noSourceFileContentRead, true);
  assert.equal(evidence.bounds.noLspServerStart, true);
  assert.equal(evidence.deferredExecutionBoundaries.includes("no LSP server process start"), true);
});

test("native engineering LSP evidence validates requested symbol position without reading file content", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const evidence = builders.buildNativeEngineeringLspEvidence({
    action: "definition",
    language: "typescript",
    relativePath: "src/app.ts",
    line: 1,
    character: 13,
  });

  assert.equal(evidence.query.action, "definition");
  assert.equal(evidence.requestedPosition.required, true);
  assert.equal(evidence.requestedPosition.valid, true);
  assert.equal(evidence.requestedPosition.relativePath, "src/app.ts");
  assert.equal(evidence.requestedPosition.contentRead, false);
  assert.equal(evidence.summary.canResolveSymbolNow, false);
  assert.equal(JSON.stringify(evidence).includes("openclawSymbol"), false);
});

test("native engineering LSP evidence rejects traversal and skipped directories", (t) => {
  const root = createFixture();
  const outsideRoot = mkdtempSync(path.join(os.tmpdir(), "openclaw-engineering-lsp-outside-"));
  writeFileSync(path.join(outsideRoot, "outside.ts"), "export const outsideSecret = 1;\n");
  symlinkSync(path.join(outsideRoot, "outside.ts"), path.join(root, "src", "outside.ts"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  t.after(() => rmSync(outsideRoot, { recursive: true, force: true }));
  const builders = createHarness(root);

  assert.throws(
    () => builders.buildNativeEngineeringLspEvidence({
      action: "hover",
      language: "typescript",
      relativePath: "../package.json",
    }),
    /workspace/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspEvidence({
      action: "references",
      language: "python",
      relativePath: ".cache/leak.py",
    }),
    /hidden\/generated\/cache/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspEvidence({
      action: "definition",
      language: "typescript",
      relativePath: "src/outside.ts",
    }),
    /real path escapes/i,
  );
});

test("native engineering LSP lifecycle draft maps a workspace-scoped lifecycle action without execution", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const draft = builders.buildNativeEngineeringLspLifecycleDraft({
    language: "python",
    lifecycleAction: "restart",
    limit: 100,
  });

  assert.equal(draft.ok, true);
  assert.equal(draft.registry, NATIVE_ENGINEERING_LSP_LIFECYCLE_DRAFT_REGISTRY);
  assert.equal(draft.mode, "lsp-lifecycle-readiness-draft-only");
  assert.equal(draft.capability.id, "plan.openclaw.engineering_tool.lsp_lifecycle");
  assert.equal(draft.summary.selectedLanguage, "python");
  assert.equal(draft.summary.lifecycleAction, "restart");
  assert.equal(draft.summary.detectedLanguages.includes("python"), true);
  assert.equal(draft.lifecycleDraft.server.serverBinary, "pylsp");
  assert.equal(draft.lifecycleDraft.status, "draft_only");
  assert.equal(draft.lifecycleDraft.workspaceScoped, true);
  assert.equal(draft.lifecycleDraft.createsTask, false);
  assert.equal(draft.lifecycleDraft.createsApproval, false);
  assert.equal(draft.lifecycleDraft.executesCommand, false);
  assert.equal(draft.lifecycleDraft.server.binaryChecked, false);
  assert.equal(draft.lifecycleDraft.server.processStarted, false);
  assert.equal(draft.lifecycleDraft.server.jsonRpcHandshakeSent, false);
  assert.equal(draft.governance.canDraftLifecycleAction, true);
  assert.equal(draft.governance.canCheckServerBinary, false);
  assert.equal(draft.governance.canStartLspServer, false);
  assert.equal(draft.governance.canSendJsonRpcRequest, false);
  assert.equal(draft.governance.canCreateTask, false);
  assert.equal(draft.bounds.noTaskCreation, true);
  assert.equal(draft.bounds.noApprovalCreation, true);
  assert.equal(draft.summary.executionReady, false);
  assert.equal(draft.summary.canCreateTaskNow, false);
  assert.equal(draft.readinessGates.some((gate) => gate.id === "process_supervision" && gate.status === "deferred"), true);
  assert.equal(draft.deferredExecutionBoundaries.includes("no LSP server process start"), true);
  assert.equal(JSON.stringify(draft).includes("openclaw_symbol"), false);
});

test("native engineering LSP source-transfer proposal reads one bounded source file without didOpen", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createSourceTransferHarness(root);

  const proposal = builders.buildNativeEngineeringLspSourceTransferProposal({
    language: "typescript",
    relativePath: "src/app.ts",
    maxPreviewChars: 200,
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.registry, NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_REGISTRY);
  assert.equal(proposal.mode, "lsp-didopen-source-transfer-proposal-only");
  assert.equal(proposal.capability.id, "plan.openclaw.engineering_tool.lsp_source_transfer");
  assert.equal(proposal.file.relativePath, "src/app.ts");
  assert.equal(proposal.file.languageId, "typescript");
  assert.equal(proposal.file.languageMatchesExtension, true);
  assert.match(proposal.file.uri, /^file:\/\//u);
  assert.match(proposal.file.textSha256, /^[a-f0-9]{64}$/u);
  assert.equal(proposal.proposedDidOpen.method, "textDocument/didOpen");
  assert.equal(proposal.proposedDidOpen.sent, false);
  assert.equal(proposal.proposedDidOpen.textDocument.textSha256, proposal.file.textSha256);
  assert.equal(proposal.sourcePreview.truncated, false);
  assert.equal(proposal.sourcePreview.text.includes("openclawSymbol"), true);
  assert.equal(proposal.serverContract.binaryChecked, false);
  assert.equal(proposal.serverContract.processStarted, false);
  assert.equal(proposal.serverContract.jsonRpcSent, false);
  assert.equal(proposal.serverContract.didOpenSent, false);
  assert.equal(proposal.governance.canReadWorkspaceSourceForProposal, true);
  assert.equal(proposal.governance.canTransferSourceContentToLsp, false);
  assert.equal(proposal.governance.canSendDidOpen, false);
  assert.equal(proposal.governance.futureSourceTransferRequiresApproval, true);
  assert.equal(proposal.bounds.noDidOpenSent, true);
  assert.equal(proposal.bounds.noSymbolRequestSent, true);
  assert.equal(proposal.auditEvidence.operation, "lsp_source_transfer_proposal");
  assert.equal(proposal.summary.sourceContentTransferred, false);
  assert.equal(proposal.deferredExecutionBoundaries.includes("no textDocument/didOpen notification sent"), true);
});

test("native engineering LSP source-transfer proposal enforces workspace, skip, binary, size, and language bounds", (t) => {
  const root = createFixture();
  const outsideRoot = mkdtempSync(path.join(os.tmpdir(), "openclaw-engineering-lsp-source-transfer-outside-"));
  writeFileSync(path.join(outsideRoot, "outside.ts"), "export const outsideSecret = 1;\n");
  symlinkSync(path.join(outsideRoot, "outside.ts"), path.join(root, "src", "outside.ts"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  t.after(() => rmSync(outsideRoot, { recursive: true, force: true }));
  const builders = createSourceTransferHarness(root);

  assert.throws(
    () => builders.buildNativeEngineeringLspSourceTransferProposal({
      relativePath: "../package.json",
    }),
    /workspace/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspSourceTransferProposal({
      relativePath: ".cache/leak.py",
      language: "python",
    }),
    /hidden\/generated\/cache/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspSourceTransferProposal({
      relativePath: "src/outside.ts",
    }),
    /real path escapes/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspSourceTransferProposal({
      relativePath: "src/binary.ts",
      language: "typescript",
    }),
    /binary/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspSourceTransferProposal({
      relativePath: "scripts/tool.mjs",
      language: "typescript",
    }),
    /does not match/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringLspSourceTransferProposal({
      relativePath: "src/app.ts",
      maxFileSizeBytes: 1,
    }),
    /maxFileSizeBytes/i,
  );
});

test("native engineering LSP symbol request proposal requires approved didOpen state and does not send JSON-RPC", () => {
  const records = new Map([[
    "typescript::fixture",
    {
      status: "didopen_source_transfer_completed",
      updatedAt: "2026-07-10T00:00:00.000Z",
      workspace: { id: "fixture", name: "LSP Fixture", path: "/tmp/openclaw" },
      language: "typescript",
      sourceTaskId: "task-didopen",
      sourceApprovalId: "approval-didopen",
      boundaries: {
        sourceContentTransferred: true,
        jsonRpcOperationalRequestsEnabled: false,
      },
      process: {
        protocolHandshake: {
          sourceTransfer: {
            relativePath: "src/app.ts",
            uri: "file:///tmp/openclaw/src/app.ts",
            languageId: "typescript",
            textBytes: 32,
            textSha256: "a".repeat(64),
          },
        },
      },
    },
  ]]);
  const builders = createSymbolRequestHarness(records);

  const proposal = builders.buildNativeEngineeringLspSymbolRequestProposal({
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    action: "definition",
    relativePath: "src/app.ts",
    line: 2,
    character: 14,
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.registry, NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_REGISTRY);
  assert.equal(proposal.mode, "lsp-symbol-request-proposal-only");
  assert.equal(proposal.capability.id, "plan.openclaw.engineering_tool.lsp_symbol_request");
  assert.equal(proposal.prerequisite.found, true);
  assert.equal(proposal.prerequisite.sourceTaskId, "task-didopen");
  assert.equal(proposal.proposedJsonRpc.method, "textDocument/definition");
  assert.equal(proposal.proposedJsonRpc.sent, false);
  assert.equal(proposal.proposedJsonRpc.params.textDocument.uri, "file:///tmp/openclaw/src/app.ts");
  assert.deepEqual(proposal.proposedJsonRpc.params.position, { line: 1, character: 14 });
  assert.equal(proposal.governance.canSendSymbolRequest, false);
  assert.equal(proposal.governance.futureSymbolRequestRequiresApproval, true);
  assert.equal(proposal.bounds.noSymbolRequestSent, true);
  assert.equal(proposal.summary.symbolRequestSent, false);

  const references = builders.buildNativeEngineeringLspSymbolRequestProposal({
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    action: "references",
    relativePath: "src/app.ts",
    line: 2,
    character: 14,
  });
  assert.equal(references.proposedJsonRpc.method, "textDocument/references");
  assert.equal(references.proposedJsonRpc.params.context.includeDeclaration, true);

  const hover = builders.buildNativeEngineeringLspSymbolRequestProposal({
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    action: "hover",
    relativePath: "src/app.ts",
    line: 2,
    character: 14,
  });
  assert.equal(hover.proposedJsonRpc.method, "textDocument/hover");
  assert.equal(hover.proposedJsonRpc.params.context, undefined);
});

test("native engineering LSP symbol request proposal stays blocked without didOpen state", () => {
  const builders = createSymbolRequestHarness(new Map());

  const proposal = builders.buildNativeEngineeringLspSymbolRequestProposal({
    language: "hover",
    action: "hover",
    relativePath: "src/app.ts",
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.registry, NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_REGISTRY);
  assert.equal(proposal.prerequisite.found, false);
  assert.equal(proposal.proposedJsonRpc.params, null);
  assert.equal(proposal.governance.readyForApprovalTask, false);
  assert.equal(proposal.governance.canSendSymbolRequest, false);
});
