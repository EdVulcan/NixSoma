import test from "node:test";
import assert from "node:assert/strict";

import { createAcpxCodexCompatibilityCapabilityHandlers } from "../src/capability-runtime-acpx-codex.mjs";

const capability = { id: "sense.openclaw.acpx_codex_bridge.compatibility" };

test("ACPX/Codex compatibility capability delegates to the existing read model", () => {
  const calls = [];
  const handlers = createAcpxCodexCompatibilityCapabilityHandlers({
    buildNativeAcpxCodexBridgeCompatibility: (input) => {
      calls.push(input);
      return {
        ok: true,
        persistence: {
          storeReady: true,
          totalRecords: 2,
          selectedSessionKey: "session-a",
          selectedRecord: { sessionKey: "session-a" },
          missingSessionReturnsNull: false,
        },
        governance: {
          canReadCredentialValue: false,
          canCopyAuthMaterial: false,
          canWriteWrapper: false,
          canExecuteWrapper: false,
          canSpawnCodexAcp: false,
          canCallProvider: false,
          canUseNetwork: false,
        },
      };
    },
  });

  const backend = handlers.callBackend(capability, { params: { sessionKey: "session-a" } });
  assert.equal(backend.handled, true);
  assert.deepEqual(calls, [{ sessionKey: "session-a" }]);
  assert.deepEqual(handlers.summariseResult(capability, backend.result), {
    kind: "acpx_codex_bridge.compatibility",
    ok: true,
    storeReady: true,
    totalRecords: 2,
    selectedSessionRequested: true,
    selectedRecordFound: true,
    missingSessionReturnsNull: false,
    noCredentialAccess: true,
    noWrapperMutation: true,
    noProcessSpawn: true,
    noProviderEgress: true,
  });
});

test("ACPX/Codex compatibility capability rejects unsafe session keys before dispatch", () => {
  const handlers = createAcpxCodexCompatibilityCapabilityHandlers({
    buildNativeAcpxCodexBridgeCompatibility: () => ({ ok: true }),
  });

  assert.equal(
    handlers.validateRequest(capability, { params: { sessionKey: "../secret" } }),
    "ACPX/Codex compatibility sessionKey is invalid.",
  );
  assert.equal(handlers.validateRequest(capability, { params: { sessionKey: "session-a" } }), null);
});
