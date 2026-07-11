import test from "node:test";
import assert from "node:assert/strict";

import {
  createOpenClawNativePluginContract,
  validateOpenClawNativePluginContract,
} from "../src/plugin-contract.mjs";
import {
  createOpenClawNativePluginRegistry,
  validateOpenClawNativePluginRegistry,
} from "../src/plugin-registry.mjs";
import { OPENCLAW_NATIVE_PLUGIN_CAPABILITY_IDS } from "../src/plugin-capability-descriptors.mjs";
import { createOpenClawNativePluginRegistryGenerationStore } from "../src/plugin-registry-generation-store.mjs";

test("creates and validates a governed native plugin contract", () => {
  const contract = createOpenClawNativePluginContract({
    plugin: {
      id: "openclaw.test.plugin",
      name: "OpenClaw Test Plugin",
      version: "0.1.0",
      summary: "Test contract.",
    },
    capabilities: [
      {
        id: "sense.test",
        title: "Sense Test",
        description: "Read-only test capability.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only unit test.",
        },
      },
    ],
  });

  assert.equal(validateOpenClawNativePluginContract(contract).ok, true);
  assert.equal(contract.governance.runtimeOwner, "openclaw_on_nixos");
  assert.equal(contract.governance.externalRuntimeDependencyAllowed, false);
});

test("creates a valid native plugin registry envelope", () => {
  const registry = createOpenClawNativePluginRegistry({
    generatedAt: "2026-07-08T00:00:00.000Z",
  });

  assert.equal(validateOpenClawNativePluginRegistry(registry).ok, true);
  assert.equal(registry.runtimeOwner, "openclaw_on_nixos");
  assert.equal(registry.items.length, 1);
});

test("preserves the native plugin capability id surface", () => {
  const registry = createOpenClawNativePluginRegistry({
    generatedAt: "2026-07-08T00:00:00.000Z",
  });
  const capabilityIds = registry.items[0].contract.capabilities.map((capability) => capability.id);

  assert.deepEqual(capabilityIds, [
    "sense.plugin.manifest_profile",
    "sense.openclaw.tool_catalog",
    "sense.openclaw.workspace_semantic_index",
    "sense.openclaw.workspace_symbol_lookup",
    "sense.openclaw.workspace_edit_target_select",
    "act.openclaw.workspace_text_write",
    "act.openclaw.workspace_patch_apply",
    "sense.openclaw.prompt_pack",
    "sense.openclaw.plugin_manifest_map",
    "plan.openclaw.plugin_capability",
    "act.plugin.capability.invoke",
  ]);
  assert.deepEqual(capabilityIds, [...OPENCLAW_NATIVE_PLUGIN_CAPABILITY_IDS]);
});

test("atomically swaps valid registry generations and retains the previous generation", () => {
  let tick = 0;
  const store = createOpenClawNativePluginRegistryGenerationStore({
    now: () => `2026-07-11T00:00:0${tick++}.000Z`,
  });
  const initial = store.getActiveGeneration();
  const result = store.refresh();

  assert.equal(result.ok, true);
  assert.equal(result.swapped, true);
  assert.equal(result.previous.id, initial.id);
  assert.equal(result.active.sequence, initial.sequence + 1);
  assert.equal(store.describe().retainedGenerations, 2);
});

test("keeps the active generation when candidate validation fails", () => {
  let builds = 0;
  const store = createOpenClawNativePluginRegistryGenerationStore({
    registryFactory: (options) => {
      const registry = createOpenClawNativePluginRegistry(options);
      builds += 1;
      return builds === 1 ? registry : { ...registry, runtimeOwner: "external" };
    },
  });
  const initial = store.getActiveGeneration();
  const result = store.refresh();

  assert.equal(result.ok, false);
  assert.equal(result.swapped, false);
  assert.equal(store.getActiveGeneration(), initial);
  assert.equal(store.describe().previous, null);
});
