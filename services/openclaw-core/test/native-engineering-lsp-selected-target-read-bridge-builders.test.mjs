import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createNativeEngineeringLspSelectedTargetReadBridgeBuilders,
  NATIVE_ENGINEERING_LSP_SELECTED_TARGET_READ_BRIDGE_REGISTRY,
  NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_PROPOSAL_SEED_REGISTRY,
} from "../src/native-engineering-lsp-selected-target-read-bridge-builders.mjs";
import { createNativeEngineeringEditProposalBuilders } from "../src/native-engineering-edit-proposal-builders.mjs";
import { createNativeEngineeringReadSearchBuilders } from "../src/native-engineering-read-search-builders.mjs";

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-lsp-selected-target-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "app.ts"), [
    "export const first = true;",
    "export const selectedSymbol = 'OpenClawSelectedTarget';",
    "export const after = true;",
  ].join("\n"));
  return root;
}

function createHarness(root, records) {
  const selectOpenClawToolCatalogWorkspace = () => ({
    registry: { registry: "openclaw-source-workspace-v0" },
    item: {
      id: "fixture",
      name: "LSP Selected Target Fixture",
      path: root,
    },
  });
  const readSearch = createNativeEngineeringReadSearchBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace,
  });
  const editProposal = createNativeEngineeringEditProposalBuilders({
    buildNativeEngineeringReadFile: readSearch.buildNativeEngineeringReadFile,
  });
  return createNativeEngineeringLspSelectedTargetReadBridgeBuilders({
    records,
    selectOpenClawToolCatalogWorkspace,
    buildNativeEngineeringReadFile: readSearch.buildNativeEngineeringReadFile,
    buildNativeEngineeringEditProposal: editProposal.buildNativeEngineeringEditProposal,
  });
}

function createRecords(root, overrides = {}) {
  const uri = pathToFileURL(path.join(root, "src", "app.ts")).href;
  return new Map([
    ["typescript::fixture", {
      sourceTaskId: "task-symbol",
      sourceApprovalId: "approval-symbol",
      status: "symbol_request_completed",
      language: "typescript",
      lifecycleAction: "symbol_request",
      updatedAt: "2026-07-10T00:00:00.000Z",
      workspace: { id: "fixture", name: "LSP Selected Target Fixture", path: root },
      server: {
        symbolResponseSummary: {
          observed: true,
          method: "textDocument/definition",
          resultKind: "array",
          resultCount: 1,
          targetCount: 1,
          targets: [{
            uri,
            range: { start: { line: 1, character: 13 }, end: { line: 1, character: 27 } },
          }],
          selectedTarget: {
            uri,
            range: { start: { line: 1, character: 13 }, end: { line: 1, character: 27 } },
          },
          rawResultIncluded: false,
          rawTargetsIncluded: false,
        },
      },
      ...overrides,
    }],
  ]);
}

test("LSP selected-target read bridge builds explicit bounded read follow-up", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root, createRecords(root));

  const bridge = builders.buildNativeEngineeringLspSelectedTargetReadBridge({
    workspacePath: root,
    language: "typescript",
    taskId: "task-symbol",
    contextLines: 1,
  });

  assert.equal(bridge.ok, true);
  assert.equal(bridge.registry, NATIVE_ENGINEERING_LSP_SELECTED_TARGET_READ_BRIDGE_REGISTRY);
  assert.equal(bridge.target.relativePath, "src/app.ts");
  assert.equal(bridge.target.startLine, 1);
  assert.equal(bridge.target.endLine, 3);
  assert.match(bridge.readRequest.url, /engineering-read-search\/read/u);
  assert.equal(bridge.readRequest.operatorActionRequired, true);
  assert.equal(bridge.readResult, null);
  assert.equal(bridge.governance.canReadWorkspaceContent, false);
  assert.equal(bridge.governance.canMutateWorkspace, false);
  assert.equal(bridge.sourceRecord.responseSummary.rawResultIncluded, false);
});

test("LSP selected-target read bridge can explicitly include native bounded read preview", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root, createRecords(root));

  const bridge = builders.buildNativeEngineeringLspSelectedTargetReadBridge({
    workspacePath: root,
    language: "typescript",
    taskId: "task-symbol",
    contextLines: 0,
    includeRead: true,
    maxOutputChars: 500,
  });

  assert.equal(bridge.ok, true);
  assert.equal(bridge.target.startLine, 2);
  assert.equal(bridge.target.endLine, 2);
  assert.equal(bridge.readRequest.operatorActionRequired, false);
  assert.equal(bridge.readResult.ok, true);
  assert.equal(bridge.readResult.operation, "read");
  assert.equal(bridge.readResult.target.relativePath, "src/app.ts");
  assert.equal(bridge.readResult.summary.lineCount, 1);
  assert.match(bridge.readResult.content, /OpenClawSelectedTarget/u);
  assert.equal(bridge.summary.contentExposed, true);
  assert.equal(bridge.bounds.noWorkspaceMutation, true);
});

test("LSP selected-target read bridge blocks non-file and outside-workspace targets", (t) => {
  const root = createFixture();
  const outside = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  t.after(() => rmSync(outside, { recursive: true, force: true }));

  const nonFileRecords = createRecords(root, {
    server: {
      symbolResponseSummary: {
        selectedTarget: {
          uri: "https://example.invalid/src/app.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        },
      },
    },
  });
  const nonFile = createHarness(root, nonFileRecords).buildNativeEngineeringLspSelectedTargetReadBridge({
    workspacePath: root,
    taskId: "task-symbol",
    includeRead: true,
  });
  assert.equal(nonFile.ok, false);
  assert.equal(nonFile.blocked, true);
  assert.equal(nonFile.reason, "non_file_target_uri");
  assert.equal(nonFile.readResult, null);

  const outsideRecords = createRecords(root, {
    server: {
      symbolResponseSummary: {
        selectedTarget: {
          uri: pathToFileURL(path.join(outside, "src", "app.ts")).href,
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        },
      },
    },
  });
  const outsideBridge = createHarness(root, outsideRecords).buildNativeEngineeringLspSelectedTargetReadBridge({
    workspacePath: root,
    taskId: "task-symbol",
  });
  assert.equal(outsideBridge.ok, false);
  assert.equal(outsideBridge.reason, "target_outside_workspace");
  assert.equal(outsideBridge.governance.canReadArbitrarySystemPath, false);
});

test("LSP selected-target edit proposal seed exposes bounded selected text without mutation", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root, createRecords(root));

  const seed = builders.buildNativeEngineeringLspSelectedTargetEditProposalSeed({
    workspacePath: root,
    language: "typescript",
    taskId: "task-symbol",
  });

  assert.equal(seed.ok, true);
  assert.equal(seed.registry, NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_PROPOSAL_SEED_REGISTRY);
  assert.equal(seed.seed.relativePath, "src/app.ts");
  assert.match(seed.seed.oldString, /OpenClawSelectedTarget/u);
  assert.equal(seed.seed.newStringProvided, false);
  assert.equal(seed.editProposal, null);
  assert.equal(seed.governance.canBuildEditProposal, false);
  assert.equal(seed.governance.canMutateWorkspace, false);
  assert.equal(seed.summary.nextRequiredStep, "operator_provides_replacement_text");
});

test("LSP selected-target edit proposal seed can build existing edit proposal draft with replacement", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root, createRecords(root));

  const seed = builders.buildNativeEngineeringLspSelectedTargetEditProposalSeed({
    workspacePath: root,
    language: "typescript",
    taskId: "task-symbol",
    newString: "export const selectedSymbol = 'OpenClawRenamedTarget';",
  });

  assert.equal(seed.ok, true);
  assert.equal(seed.seed.newStringProvided, true);
  assert.equal(seed.editProposal.registry, "openclaw-native-engineering-edit-proposal-v0");
  assert.equal(seed.editProposal.target.relativePath, "src/app.ts");
  assert.equal(seed.editProposal.summary.createsTask, false);
  assert.equal(seed.editProposal.summary.createsApproval, false);
  assert.equal(seed.editProposal.governance.canApplyPatch, false);
  assert.equal(seed.editProposal.diffPreview.lines.some((line) => line.type === "add" && line.text.includes("OpenClawRenamedTarget")), true);
  assert.equal(seed.governance.futureMutationRequiresApproval, true);
});
