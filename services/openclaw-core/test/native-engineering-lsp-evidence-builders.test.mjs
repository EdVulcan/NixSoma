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
} from "../src/native-engineering-lsp-evidence-builders.mjs";

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
