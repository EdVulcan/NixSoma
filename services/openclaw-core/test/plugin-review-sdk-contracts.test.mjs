import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { createPluginReviewSdkContracts } from "../src/plugin-review-sdk-contracts.mjs";
import { createPluginReviewSourceMigration } from "../src/plugin-review-source-migration.mjs";
import { createPluginReviewWorkspaceDiscovery } from "../src/plugin-review-workspace-discovery.mjs";

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonFileIfPresent(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function createSdkFixture() {
  const rootPath = mkdtempSync(path.join(os.tmpdir(), "openclaw-plugin-sdk-"));
  for (const relativePath of [
    ".openclaw",
    "packages/plugin-sdk/src",
    "packages/plugin-sdk/types",
    "src/plugin-sdk",
  ]) {
    mkdirSync(path.join(rootPath, relativePath), { recursive: true });
  }
  writeJson(path.join(rootPath, "package.json"), {
    name: "openclaw",
    private: true,
  });
  writeFileSync(path.join(rootPath, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  writeJson(path.join(rootPath, "packages/plugin-sdk/package.json"), {
    name: "@openclaw/plugin-sdk",
    private: false,
    types: "./types/index.d.ts",
    exports: {
      ".": "./dist/index.js",
    },
    scripts: {
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      example: "0.0.0",
    },
  });
  writeFileSync(path.join(rootPath, "packages/plugin-sdk/src/index.ts"), [
    "export interface PluginCapabilityManifest {",
    "  capability: string;",
    "  policy: string;",
    "  approval: boolean;",
    "}",
    "export function createPluginRuntimeManifest(): PluginCapabilityManifest {",
    "  return { capability: 'sense.plugin.manifest_profile', policy: 'audit', approval: false };",
    "}",
  ].join("\n"));
  writeFileSync(path.join(rootPath, "packages/plugin-sdk/types/index.d.ts"), [
    "export type PluginRuntimeContract = {",
    "  capability: string;",
    "  runtime: string;",
    "  manifest: string;",
    "};",
  ].join("\n"));
  writeFileSync(path.join(rootPath, "src/plugin-sdk/native.ts"), [
    "export const nativeCapabilityPolicy = {",
    "  capability: 'act.plugin.capability.invoke',",
    "  plugin: 'openclaw.native.plugin-sdk',",
    "  permission: 'approval-gated-runtime',",
    "  approval: true,",
    "  runtime: 'openclaw_on_nixos',",
    "  manifest: 'native',",
    "};",
  ].join("\n"));
  return rootPath;
}

function createSdkContractsHarness(workspacePath) {
  const discovery = createPluginReviewWorkspaceDiscovery({
    workspaceRoots: [workspacePath],
    readJsonFileIfPresent,
  });
  const migration = createPluginReviewSourceMigration({
    buildWorkspaceRegistry: discovery.buildWorkspaceRegistry,
  });
  return createPluginReviewSdkContracts({
    buildOpenClawMigrationPlan: migration.buildOpenClawMigrationPlan,
    readJsonFileIfPresent,
  });
}

test("plugin review SDK contracts preserve read-only review and native contract outputs", () => {
  const workspacePath = createSdkFixture();
  try {
    const contracts = createSdkContractsHarness(workspacePath);

    const contractReview = contracts.buildOpenClawPluginSdkContractReview();
    const selected = contracts.selectReviewedPluginSdkPackage();
    const sourceScope = contracts.buildOpenClawPluginSdkSourceReviewScope();
    const contentReview = contracts.buildOpenClawPluginSdkSourceContentReview();
    const nativeTests = contracts.buildOpenClawPluginSdkNativeContractTests();
    const implementation = contracts.buildOpenClawNativePluginSdkContractImplementation();
    const registry = contracts.buildOpenClawNativePluginRegistryResponse();

    assert.equal(contractReview.registry, "openclaw-plugin-sdk-contract-review-v0");
    assert.equal(contractReview.summary.total, 1);
    assert.equal(contractReview.summary.governance.canReadSourceFileContent, false);
    assert.equal(selected.item.packageManifest.name, "@openclaw/plugin-sdk");
    assert.equal(sourceScope.registry, "openclaw-plugin-sdk-source-review-scope-v0");
    assert.equal(sourceScope.summary.canReadSourceFileContent, false);
    assert.equal(sourceScope.files.every((file) => file.contentRead === false), true);
    assert.equal(contentReview.registry, "openclaw-plugin-sdk-source-content-review-v0");
    assert.equal(contentReview.summary.contentRead > 0, true);
    assert.equal(contentReview.summary.exposesSourceFileContent, false);
    assert.equal(nativeTests.registry, "openclaw-plugin-sdk-native-contract-tests-v0");
    assert.equal(nativeTests.ok, true);
    assert.equal(nativeTests.summary.nativeContractReadyForImplementation, true);
    assert.equal(implementation.registry, "openclaw-native-plugin-sdk-contract-implementation-v0");
    assert.equal(implementation.ok, true);
    assert.equal(implementation.summary.readyForFirstReadOnlyAbsorption, true);
    assert.equal(registry.validation.ok, true);
  } finally {
    rmSync(workspacePath, { recursive: true, force: true });
  }
});
