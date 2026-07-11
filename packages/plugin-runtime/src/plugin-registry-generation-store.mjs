import { createHash } from "node:crypto";

import {
  createOpenClawNativePluginRegistry,
  validateOpenClawNativePluginRegistry,
} from "./plugin-registry.mjs";

export const OPENCLAW_NATIVE_PLUGIN_GENERATION_STORE_VERSION =
  "openclaw-native-plugin-registry-generation-store-v0";

function buildGeneration(registry, sequence, activatedAt) {
  const canonical = JSON.stringify({ ...registry, generatedAt: null });
  return Object.freeze({
    id: `native-registry-generation-${sequence}`,
    sequence,
    activatedAt,
    hash: createHash("sha256").update(canonical).digest("hex"),
    registry,
  });
}

export function createOpenClawNativePluginRegistryGenerationStore({
  registryFactory = createOpenClawNativePluginRegistry,
  validateRegistry = validateOpenClawNativePluginRegistry,
  now = () => new Date().toISOString(),
} = {}) {
  let sequence = 1;
  const initialRegistry = registryFactory({ generatedAt: now() });
  if (!validateRegistry(initialRegistry).ok) {
    throw new Error("Initial native plugin registry generation is invalid.");
  }

  let active = buildGeneration(initialRegistry, sequence, now());
  let previous = null;

  function refresh() {
    const candidateRegistry = registryFactory({ generatedAt: now() });
    const validation = validateRegistry(candidateRegistry);
    if (!validation.ok) {
      return { ok: false, swapped: false, active, previous, validation };
    }

    sequence += 1;
    const candidate = buildGeneration(candidateRegistry, sequence, now());
    previous = active;
    active = candidate;
    return { ok: true, swapped: true, active, previous, validation };
  }

  return {
    getActiveGeneration: () => active,
    describe: () => ({
      store: OPENCLAW_NATIVE_PLUGIN_GENERATION_STORE_VERSION,
      active,
      previous,
      retainedGenerations: previous ? 2 : 1,
      persistence: "deterministic_process_lifetime",
    }),
    refresh,
  };
}
