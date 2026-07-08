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

import { createPluginReviewWorkspaceIntelligence } from "../src/plugin-review-workspace-intelligence.mjs";

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function createWorkspaceFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-workspace-intelligence-"));
  mkdirSync(path.join(root, "src", "agents", "tools"), { recursive: true });
  mkdirSync(path.join(root, "docs", "tools"), { recursive: true });
  mkdirSync(path.join(root, "src", "plugin-sdk"), { recursive: true });
  writeFileSync(
    path.join(root, "src", "agents", "tools", "web-search-tool.ts"),
    [
      "export function webSearchTool(query: string) {",
      "  return { query, tool: 'web-search' };",
      "}",
      "export const webSearchPolicy = { approval: true };",
    ].join("\n"),
  );
  writeFileSync(path.join(root, "docs", "tools", "web-search.md"), "# Web Search\n\nUse edit, patch, verify, and test checks.");
  writeFileSync(path.join(root, "src", "plugin-sdk", "contract.ts"), "export interface PluginContract { capability: string }\n");
  writeFileSync(path.join(root, "TOOLS.md"), "# Tools\n\nPlan edits, patch diffs, verify changes, run typecheck and test.");
  return root;
}

function createWorkspaceIntelligenceHarness(root) {
  const builders = createPluginReviewWorkspaceIntelligence({
    buildWorkspaceRegistry: () => ({
      registry: "openclaw-source-workspace-v0",
      items: [
        {
          id: "fixture",
          name: "Fixture",
          path: root,
          exists: true,
          readable: true,
          openclawProfile: true,
          scripts: ["typecheck", "test"],
        },
      ],
    }),
    buildOpenClawNativePluginSdkContractImplementation: () => ({
      registry: "openclaw-native-plugin-sdk-contract-implementation-v0",
      summary: {
        readyForFirstReadOnlyAbsorption: true,
      },
      contract: {
        capabilities: [
          {
            id: "sense.openclaw.tool_catalog",
            kind: "sense",
            risk: "low",
            approval: {
              required: false,
            },
            runtimeOwner: "openclaw_on_nixos",
          },
        ],
      },
    }),
    safeStat,
  });

  return builders;
}

test("plugin review workspace intelligence builds read-only workspace surfaces", (t) => {
  const root = createWorkspaceFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createWorkspaceIntelligenceHarness(root);

  assert.equal(builders.normalisePositiveLimit("999", 20, 80), 80);
  const selection = builders.selectOpenClawToolCatalogWorkspace();
  assert.equal(selection.item.path, root);

  const catalog = builders.buildOpenClawToolCatalog();
  assert.equal(catalog.registry, "openclaw-tool-catalog-v0");
  assert.equal(catalog.summary.exposesSourceFileContent, false);
  assert.equal(catalog.catalog.tools.some((tool) => tool.fileName === "web-search-tool.ts"), true);

  const profile = builders.buildNativeOpenClawToolCatalogProfile({ query: "web", limit: 5 });
  assert.equal(profile.registry, "openclaw-native-plugin-adapter-v0");
  assert.equal(profile.summary.exposesSourceFileContent, false);
  assert.equal(profile.tools.length, 1);

  const prompt = builders.buildNativeOpenClawPromptSemanticsProfile({ query: "edit", limit: 10 });
  assert.equal(prompt.registry, "openclaw-native-prompt-semantics-v0");
  assert.equal(prompt.summary.exposesPromptContent, false);
  assert.equal(prompt.derivedPlanSemantics.expectedChecks.includes("typecheck"), true);
  assert.equal(prompt.derivedPlanSemantics.expectedChecks.includes("test"), true);

  const semanticIndex = builders.buildNativeOpenClawWorkspaceSemanticIndex({ query: "web", limit: 10 });
  assert.equal(semanticIndex.mode, "workspace-semantic-index-only");
  assert.equal(semanticIndex.summary.exposesSourceFileContent, false);
  assert.equal(semanticIndex.files.some((file) => file.relativePath === "web-search-tool.ts"), true);

  const symbols = builders.buildNativeOpenClawWorkspaceSymbolLookup({ query: "web", limit: 10 });
  assert.equal(symbols.mode, "workspace-symbol-lookup-executable-read-only");
  assert.equal(symbols.summary.exposesFunctionBodies, false);
  assert.equal(symbols.matches.some((match) => match.symbolName === "webSearchTool"), true);

  const editTarget = builders.buildNativeOpenClawWorkspaceEditTargetSelection({ query: "web", limit: 5 });
  assert.equal(editTarget.registry, "openclaw-native-workspace-edit-target-selection-v0");
  assert.equal(editTarget.summary.exposesSourceFileContent, false);
  assert.equal(editTarget.summary.canFeedPatchProposal, true);
  assert.equal(editTarget.selectedTarget.relativePath, "src/agents/tools/web-search-tool.ts");
});
