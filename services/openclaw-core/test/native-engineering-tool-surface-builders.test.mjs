import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createNativeEngineeringToolSurfaceBuilders,
  NATIVE_ENGINEERING_TOOL_SURFACE_REGISTRY,
} from "../src/native-engineering-tool-surface-builders.mjs";

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function writeToolFixture(root) {
  const ccToolsRoot = path.join(root, "extensions", "cc-tools", "src");
  mkdirSync(path.join(ccToolsRoot, "tools"), { recursive: true });
  mkdirSync(path.join(ccToolsRoot, "lsp"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "openclaw", private: true }));
  writeFileSync(
    path.join(ccToolsRoot, "index.ts"),
    [
      "/*",
      " * Exported tools:",
      " * cc_read cc_edit cc_write cc_glob cc_grep",
      " * cc_plan_enter cc_plan_exit cc_todo_write cc_lsp cc_verify",
      " */",
      "export function createCCTools() {",
      "  const SECRET_ENGINEERING_TOOL_SURFACE_INDEX_BODY = 'must-not-leak';",
      "  return [];",
      "}",
    ].join("\n"),
  );
  for (const relativePath of [
    "tools/FileReadTool.ts",
    "tools/FileEditTool.ts",
    "tools/FileWriteTool.ts",
    "tools/GlobTool.ts",
    "tools/GrepTool.ts",
    "tools/PlanModeTool.ts",
    "tools/VerifyCodeTool.ts",
    "lsp/LSPTool.ts",
    "lsp/lsp-manager.ts",
  ]) {
    writeFileSync(path.join(ccToolsRoot, relativePath), `export const secret = "must-not-leak-${relativePath}";\n`);
  }
}

function createHarness(root) {
  return createNativeEngineeringToolSurfaceBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace: () => ({
      registry: {
        registry: "openclaw-source-workspace-v0",
      },
      item: {
        id: "fixture",
        name: "Fixture Enhanced Source",
        path: root,
      },
    }),
  });
}

test("native engineering tool surface maps cc-tools contracts without execution", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-engineering-tool-surface-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeToolFixture(root);
  const builders = createHarness(root);

  const inventory = builders.buildNativeEngineeringToolSurfaceInventory();
  const raw = JSON.stringify(inventory);

  assert.equal(inventory.ok, true);
  assert.equal(inventory.registry, NATIVE_ENGINEERING_TOOL_SURFACE_REGISTRY);
  assert.equal(inventory.mode, "read-only-tool-contract-mapping");
  assert.equal(inventory.identityLevel, "Level 1: stable user-space control plane");
  assert.equal(inventory.tools.length, 10);
  assert.equal(inventory.summary.coveredTools, 10);
  assert.equal(inventory.summary.canExecuteToolCode, false);
  assert.equal(inventory.summary.canRunVerification, false);
  assert.equal(inventory.summary.canStartLsp, false);
  assert.equal(inventory.summary.canMutate, false);
  assert.equal(inventory.summary.createsTask, false);
  assert.equal(inventory.summary.createsApproval, false);
  assert.equal(inventory.governance.observerVisible, true);
  assert.equal(inventory.sourceEvidence.indexFile.contentRead, true);
  assert.equal(inventory.sourceEvidence.indexFile.contentExposed, false);
  assert.equal(inventory.sourceEvidence.detectedSourceToolNames.includes("cc_read"), true);
  assert.equal(inventory.sourceEvidence.detectedSourceToolNames.includes("cc_verify"), true);

  const readContract = inventory.tools.find((tool) => tool.sourceToolName === "cc_read");
  assert.equal(readContract.intendedNativeCapabilityId, "sense.openclaw.engineering_tool.read");
  assert.equal(readContract.operationClass, "read_only_file_read");
  assert.equal(readContract.riskLevel, "low");
  assert.equal(readContract.sourceEvidence.indexMentioned, true);
  assert.equal(readContract.sourceEvidence.sourceFilesPresent, 1);

  const editContract = inventory.tools.find((tool) => tool.sourceToolName === "cc_edit");
  assert.equal(editContract.operationClass, "mutation_proposal");
  assert.equal(editContract.riskLevel, "high");
  assert.match(editContract.approvalExpectation, /approval_required/u);
  assert.match(editContract.deferredExecutionBoundary, /No patch is generated or applied by this inventory/i);

  const lspContract = inventory.tools.find((tool) => tool.sourceToolName === "cc_lsp");
  assert.equal(lspContract.sourceEvidence.sourceFilesPresent, 2);
  assert.match(lspContract.deferredExecutionBoundary, /no language server is started/i);

  for (const secret of [
    "SECRET_ENGINEERING_TOOL_SURFACE_INDEX_BODY",
    "must-not-leak-tools/FileReadTool.ts",
    "must-not-leak-lsp/LSPTool.ts",
  ]) {
    assert.equal(raw.includes(secret), false, `inventory leaked source text: ${secret}`);
  }
});
