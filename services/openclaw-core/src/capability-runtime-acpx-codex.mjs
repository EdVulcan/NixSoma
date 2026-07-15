const CAPABILITY_ID = "sense.openclaw.acpx_codex_bridge.compatibility";
const SESSION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;

function requireBuilder(builder) {
  if (typeof builder !== "function") {
    throw new Error("Native ACPX/Codex compatibility builder is not configured.");
  }
  return builder;
}

function validateSessionKey(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    return "ACPX/Codex compatibility sessionKey must be a string.";
  }
  const sessionKey = value.trim();
  if (!SESSION_KEY_PATTERN.test(sessionKey) || sessionKey.includes("..")) {
    return "ACPX/Codex compatibility sessionKey is invalid.";
  }
  return null;
}

export function createAcpxCodexCompatibilityCapabilityHandlers({
  buildNativeAcpxCodexBridgeCompatibility,
} = {}) {
  function callBackend(capability, request) {
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }
    return {
      handled: true,
      result: requireBuilder(buildNativeAcpxCodexBridgeCompatibility)({
        sessionKey: request.params?.sessionKey ?? null,
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id !== CAPABILITY_ID) return null;
    const persistence = result?.persistence ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "acpx_codex_bridge.compatibility",
      ok: result?.ok === true,
      storeReady: persistence.storeReady === true,
      totalRecords: persistence.totalRecords ?? 0,
      selectedSessionRequested: persistence.selectedSessionKey !== null,
      selectedRecordFound: persistence.selectedRecord !== null,
      missingSessionReturnsNull: persistence.missingSessionReturnsNull === true,
      noCredentialAccess: governance.canReadCredentialValue === false
        && governance.canCopyAuthMaterial === false,
      noWrapperMutation: governance.canWriteWrapper === false,
      noProcessSpawn: governance.canExecuteWrapper === false
        && governance.canSpawnCodexAcp === false,
      noProviderEgress: governance.canCallProvider === false
        && governance.canUseNetwork === false,
    };
  }

  function validateRequest(capability, request) {
    if (capability.id !== CAPABILITY_ID) return null;
    return validateSessionKey(request.params?.sessionKey);
  }

  return { callBackend, summariseResult, validateRequest };
}
